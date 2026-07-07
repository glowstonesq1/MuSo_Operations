import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateMovementPlan, isExclusionViolation, type PlanResult } from "@muso/logic";

const DEFAULT_LAB_NAMES = ["Play Lab", "Discover Lab", "Make Lab"];
const EXTRA_LAB_NAMES = ["Grow Lab"];

/** Generation conditions chosen by the ops team before generating —
 *  rain, dedicated-floor requests, workshop-only visits etc. all reduce
 *  to: which spaces rotate, how long each session is, and whether lunch fits. */
interface PlanOptions {
  lab_ids?: string[];
  session_minutes?: number;
  switch_minutes?: number;
  include_lunch?: boolean;
  note?: string;
}

async function buildPlan(
  supabase: any,
  bookingId: string,
  opts: PlanOptions
): Promise<{ plan?: PlanResult; booking?: any; error?: string }> {
  const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (!b) return { error: "Booking not found" };
  const { data: resources } = await supabase.from("resources").select("*").eq("is_bookable", true);
  const all = resources ?? [];

  let labs: any[];
  let extra: any[] = [];
  if (opts.lab_ids?.length) {
    // explicit selection: rotate exactly these spaces, in the order given
    labs = opts.lab_ids.map((id) => all.find((r: any) => r.id === id)).filter(Boolean);
  } else {
    const byName = new Map(all.map((r: any) => [r.name, r]));
    labs = DEFAULT_LAB_NAMES.map((n) => byName.get(n)).filter(Boolean) as any[];
    extra = EXTRA_LAB_NAMES.map((n) => byName.get(n)).filter(Boolean) as any[];
  }
  if (labs.length < 1) return { error: "Select at least one space to rotate through." };

  const includeLunch = opts.include_lunch ?? !!b.kids_lunch_time;
  const plan = generateMovementPlan({
    children: b.children_actual ?? b.children_planned ?? 0,
    slotStart: b.slot_start.slice(0, 5),
    slotEnd: b.slot_end.slice(0, 5),
    orientationTime: b.orientation_time?.slice(0, 5) ?? null,
    labs: labs.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity })),
    extraLabs: extra.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity })),
    sessionMinutes: opts.session_minutes ?? 70,
    switchMinutes: opts.switch_minutes ?? 5,
    lunchStart: includeLunch && b.kids_lunch_time ? add5(b.kids_lunch_time.slice(0, 5)) : null,
  });
  return { plan, booking: b };
}

function add5(t: string) {
  const [h, m] = t.split(":").map(Number);
  const mins = h * 60 + m + 5;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** POST -> preview with conditions (no writes). */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const opts: PlanOptions = await req.json().catch(() => ({}));
  const { plan, error } = await buildPlan(supabase, params.id, opts);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ plan });
}

/** PUT -> confirm & save with the same conditions used for the preview. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body: PlanOptions & { accepted_warnings?: string[]; reason?: string } = await req
    .json()
    .catch(() => ({}));
  const { plan, booking, error } = await buildPlan(supabase, params.id, body);
  if (error || !plan || !booking) return NextResponse.json({ error }, { status: 400 });

  await supabase.from("movement_plans").delete().eq("booking_id", params.id);
  const { data: mp, error: mpError } = await supabase
    .from("movement_plans")
    .insert({
      booking_id: params.id,
      num_groups: plan.numGroups,
      session_duration_minutes: body.session_minutes ?? 70,
      switch_duration_minutes: body.switch_minutes ?? 5,
      lunch_start: plan.lunch?.fromTime ?? null,
      lunch_end: plan.lunch?.toTime ?? null,
      auto_generated: true,
    })
    .select("id")
    .single();
  if (mpError) return NextResponse.json({ error: mpError.message }, { status: 400 });

  const sessionRows = plan.sessions.flatMap((s) =>
    s.assignments.map((a) => ({
      movement_plan_id: mp.id,
      session_number: s.sessionNumber,
      from_time: s.fromTime,
      to_time: s.toTime,
      group_label: a.groupLabel,
      resource_id: a.labId,
      headcount: a.headcount,
    }))
  );
  const { error: sErr } = await supabase.from("movement_plan_sessions").insert(sessionRows);
  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

  await supabase.from("movement_plan_tasks").insert([
    { movement_plan_id: mp.id, sort_order: 1, task: "Bus Deboarding & Parking", timing_text: booking.bus_reporting_time?.slice(0, 5) ?? null },
    { movement_plan_id: mp.id, sort_order: 2, task: "Transportation to Commons", timing_text: null },
    { movement_plan_id: mp.id, sort_order: 3, task: "Welcoming & Orientation", timing_text: booking.orientation_time?.slice(0, 5) ?? null },
    { movement_plan_id: mp.id, sort_order: 4, task: "Lunch", timing_text: plan.lunch ? `${plan.lunch.fromTime} to ${plan.lunch.toTime}` : null },
    { movement_plan_id: mp.id, sort_order: 5, task: "Feedback & Exit", timing_text: `${plan.exitTime} onwards` },
  ]);

  await supabase.from("resource_bookings").delete().eq("booking_id", params.id).not("group_label", "is", null);
  const rbRows = plan.sessions.flatMap((s) =>
    s.assignments.map((a) => ({
      booking_id: params.id,
      resource_id: a.labId,
      from_time: `${booking.visit_date}T${s.fromTime}:00+05:30`,
      to_time: `${booking.visit_date}T${s.toTime}:00+05:30`,
      group_label: a.groupLabel,
      headcount: a.headcount,
    }))
  );
  const { error: rbErr } = await supabase.from("resource_bookings").insert(rbRows);
  if (rbErr) {
    if (isExclusionViolation(rbErr.message)) {
      return NextResponse.json(
        {
          warning: "resource_clash",
          message:
            "A space in this rotation is already reserved by another booking in the same window. Adjust the conditions (different spaces or times) and regenerate.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: rbErr.message }, { status: 400 });
  }

  const historyNotes = [
    body.note ? `Conditions: ${body.note}` : null,
    body.accepted_warnings?.length ? `Accepted: ${body.accepted_warnings.join("; ")}` : null,
    body.reason ? `Reason: ${body.reason}` : null,
  ].filter(Boolean);
  if (historyNotes.length) {
    await supabase.from("booking_history").insert({
      booking_id: params.id,
      booking_name: booking.name,
      visit_date: booking.visit_date,
      changed_by: user.id,
      change_type: "movement_plan_conditions",
      reason: historyNotes.join(" — "),
    });
  }

  return NextResponse.json({ ok: true, plan });
}
