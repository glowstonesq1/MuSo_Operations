import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { headcountDropped, splitIntoGroups } from "@muso/logic";

/**
 * Case 4 — headcount reduction.
 * POST { children_actual, adults_actual?, teachers_actual?, preview: true }
 *   -> whether recalculation is suggested + new group sizes / food count
 * POST { ..., confirm: true, recalc: true } -> save actuals and rewrite
 *   movement plan headcounts.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { children_actual, adults_actual, teachers_actual, confirm, recalc } = await req.json();
  const { data: b } = await supabase.from("bookings").select("*").eq("id", params.id).single();
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const { data: mp } = await supabase
    .from("movement_plans")
    .select("id, num_groups, movement_plan_sessions(id, group_label)")
    .eq("booking_id", params.id)
    .maybeSingle();

  const dropped = headcountDropped(b.children_planned ?? 0, children_actual);
  const numGroups = mp?.num_groups ?? 3;
  const newSizes = splitIntoGroups(children_actual ?? b.children_planned ?? 0, numGroups);
  const foodCount =
    (children_actual ?? b.children_planned ?? 0) +
    (teachers_actual ?? b.teachers_planned ?? 0) +
    (adults_actual ?? b.adults_planned ?? 0);

  if (!confirm) {
    return NextResponse.json({
      dropped,
      message: dropped
        ? `Planned ${b.children_planned}, actual ${children_actual}. Recalculate groups (${numGroups} x ~${newSizes[0]} instead of ${numGroups} x ~${Math.ceil((b.children_planned ?? 0) / numGroups)}), food count (${foodCount}) and buses?`
        : null,
      newGroupSizes: newSizes,
      foodCount,
    });
  }

  const { error } = await supabase
    .from("bookings")
    .update({ children_actual, adults_actual, teachers_actual, updated_by: user.id })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (recalc && mp) {
    const labels = "ABCDEFGH".split("").slice(0, numGroups);
    const sizeByLabel = Object.fromEntries(labels.map((l, i) => [l, newSizes[i]]));
    for (const s of mp.movement_plan_sessions ?? []) {
      await supabase
        .from("movement_plan_sessions")
        .update({ headcount: sizeByLabel[s.group_label] ?? null })
        .eq("id", s.id);
    }
    await supabase
      .from("resource_bookings")
      .update({ headcount: null })
      .eq("booking_id", params.id)
      .not("group_label", "is", null);
    await supabase.from("booking_history").insert({
      booking_id: params.id,
      booking_name: b.name,
      visit_date: b.visit_date,
      changed_by: user.id,
      change_type: "headcount_recalc",
      reason: `children_actual ${children_actual} vs planned ${b.children_planned}; groups now ${newSizes.join("/")}, food count ${foodCount}`,
    });
  }

  return NextResponse.json({ ok: true, newGroupSizes: newSizes, foodCount });
}
