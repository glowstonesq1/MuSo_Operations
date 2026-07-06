import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { addMinutes, fmt12h } from "@muso/logic";

/**
 * Case 3 — timing delay cascade.
 * POST { minutes, preview: true }  -> diff of old vs new schedule
 * POST { minutes, confirm: true, description } -> apply shift to booking times,
 *   movement_plan_sessions and resource_bookings; log incident + history.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { minutes, confirm, description } = await req.json();
  if (!minutes || typeof minutes !== "number") {
    return NextResponse.json({ error: "minutes (number) required" }, { status: 400 });
  }

  const { data: b } = await supabase.from("bookings").select("*").eq("id", params.id).single();
  if (!b) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  const { data: mp } = await supabase
    .from("movement_plans")
    .select("id, movement_plan_sessions(id, session_number, from_time, to_time, group_label)")
    .eq("booking_id", params.id)
    .maybeSingle();

  const shiftT = (t: string | null) => (t ? addMinutes(t.slice(0, 5), minutes) : null);
  const timeFields = ["slot_start", "slot_end", "orientation_time", "kids_lunch_time", "teachers_breakfast_time", "exit_time"] as const;

  const diff = timeFields
    .filter((f) => b[f])
    .map((f) => ({ field: f, old: fmt12h(b[f]), new: fmt12h(shiftT(b[f])!) }));
  const sessionDiff = (mp?.movement_plan_sessions ?? []).map((s: any) => ({
    session: s.session_number,
    group: s.group_label,
    old: `${fmt12h(s.from_time)} - ${fmt12h(s.to_time)}`,
    new: `${fmt12h(shiftT(s.from_time)!)} - ${fmt12h(shiftT(s.to_time)!)}`,
  }));

  if (!confirm) return NextResponse.json({ diff, sessionDiff });

  // apply — history snapshot happens automatically via the bookings audit trigger
  const updates: Record<string, string | null> = {};
  for (const f of timeFields) if (b[f]) updates[f] = shiftT(b[f]);
  const { error: upErr } = await supabase.from("bookings").update(updates).eq("id", params.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  for (const s of mp?.movement_plan_sessions ?? []) {
    await supabase
      .from("movement_plan_sessions")
      .update({ from_time: shiftT(s.from_time), to_time: shiftT(s.to_time) })
      .eq("id", s.id);
  }

  const { data: rbs } = await supabase.from("resource_bookings").select("id, from_time, to_time").eq("booking_id", params.id);
  for (const rb of rbs ?? []) {
    await supabase
      .from("resource_bookings")
      .update({
        from_time: new Date(new Date(rb.from_time).getTime() + minutes * 60000).toISOString(),
        to_time: new Date(new Date(rb.to_time).getTime() + minutes * 60000).toISOString(),
      })
      .eq("id", rb.id);
  }

  await supabase.from("incidents").insert({
    booking_id: params.id,
    incident_type: "delay",
    delay_minutes: minutes,
    description: description ?? `Delay of ${minutes} minutes; downstream schedule shifted.`,
    reported_by: user.id,
    resolved: true,
  });
  await supabase.from("booking_history").insert({
    booking_id: params.id,
    booking_name: b.name,
    visit_date: b.visit_date,
    changed_by: user.id,
    change_type: "delay_cascade",
    reason: `Shifted ${minutes} min: ${description ?? "delay reported"}`,
  });

  return NextResponse.json({ ok: true });
}
