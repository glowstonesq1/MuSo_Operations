import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  autoFillPrompt,
  narrativePrompt,
  clashResolutionPrompt,
  remarksPrompt,
  callGemini,
  parseModelJson,
  type AiFeature,
} from "@muso/ai";

/**
 * POST /api/ai/auto_fill      { name, grade, location, booking_type }
 * POST /api/ai/narrative      { booking_id }
 * POST /api/ai/remarks        { booking_id } or { booking: {...} }
 * POST /api/ai/resolution     { clash, date }
 * All responses are SUGGESTIONS — the client must never auto-save them.
 */
export async function POST(req: Request, { params }: { params: { feature: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const feature = params.feature as AiFeature;
  const body = await req.json().catch(() => ({}));
  let prompt: string;
  let bookingId: string | null = body.booking_id ?? null;
  let expectJson = false;

  if (feature === "auto_fill") {
    const { data: past } = await supabase
      .from("bookings")
      .select("name, grade, location, kids_menu, teachers_menu, food_vendor, orientation_time, exit_time, visit_date")
      .ilike("name", `%${(body.name ?? "").split(" ")[0]}%`)
      .order("visit_date", { ascending: false })
      .limit(5);
    prompt = autoFillPrompt(body, JSON.stringify(past ?? [], null, 1));
    expectJson = true;
  } else if (feature === "narrative") {
    const { data: mp } = await supabase
      .from("movement_plans")
      .select("*, movement_plan_sessions(session_number, from_time, to_time, group_label, resource:resources(name), headcount)")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!mp) return NextResponse.json({ error: "Generate the movement plan first." }, { status: 400 });
    prompt = narrativePrompt(JSON.stringify(mp, null, 1));
  } else if (feature === "resolution") {
    const { data: dayBookings } = await supabase
      .from("bookings")
      .select("id, name, booking_type, slot_start, slot_end")
      .eq("visit_date", body.date);
    const { data: resources } = await supabase.from("resources").select("id, name, capacity, is_bookable");
    prompt = clashResolutionPrompt(
      JSON.stringify(body.clash ?? {}, null, 1),
      JSON.stringify(dayBookings ?? [], null, 1),
      JSON.stringify(resources ?? [], null, 1)
    );
    expectJson = true;
  } else if (feature === "remarks") {
    let booking = body.booking;
    if (!booking && bookingId) {
      const { data } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
      booking = data;
    }
    const { data: pastRemarks } = await supabase
      .from("bookings")
      .select("remarks")
      .not("remarks", "is", null)
      .neq("remarks", "")
      .limit(5);
    prompt = remarksPrompt(
      JSON.stringify(booking ?? {}, null, 1),
      (pastRemarks ?? []).map((r: any) => `- ${r.remarks}`).join("\n") || "- Mission Activity"
    );
  } else {
    return NextResponse.json({ error: "Unknown AI feature" }, { status: 404 });
  }

  const result = await callGemini({ db: supabase, feature, prompt, userId: user.id, bookingId, expectJson });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, budgetExceeded: result.budgetExceeded ?? false },
      { status: result.budgetExceeded ? 429 : 502 }
    );
  }
  const payload = expectJson ? parseModelJson(result.data!) : result.data;
  return NextResponse.json({ suggestion: payload, cached: result.cached });
}
