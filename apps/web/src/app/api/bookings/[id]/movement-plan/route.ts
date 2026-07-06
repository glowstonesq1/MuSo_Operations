import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateMovementPlan, isExclusionViolation, type PlanResult } from "@muso/logic";

const DEFAULT_LAB_NAMES = ["Play Lab", "Discover Lab", "Make Lab"];
const EXTRA_LAB_NAMES = ["Grow Lab"];

async function buildPlan(supabase: any, bookingId: string): Promise<{ plan?: PlanResult; booking?: any; error?: string }> {
  const { data: b } = await supabase.from("bookings").select("*").eq("id", bookingId).single();
  if (!b) return { error: "Booking not found" };
  const { data: resources } = await supabase.from("resources").select("*").eq("is_bookable", true);
  const byName = new Map((resources ?? []).map((r: any) => [r.name, r]));
  const labs = DEFAULT_LAB_NAMES.map((n) => byName.get(n)).filter(Boolean) as any[];
  const extra = EXTRA_LAB_NAMES.map((n) => byName.get(n)).filter(Boolean) as any[];
  if (labs.length < 2) return { error: "Lab resources missing; seed Play/Discover/Make Lab first." };
  const plan = generateMovementPlan({
    children: b.children_actual ?? b.children_planned ?? 0,
    slotStart: b.slot_start.slice(0, 5),
    slotEnd: b.slot_end.slice(0, 5),
    orientationTime: b.orientation_time?.slice(0, 5) ?? null,
    labs: labs.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity })),
    extraLabs: extra.map((l) => ({ id: l.id, name: l.name, capacity: l.capacity })),
    lunchStart: b.kids_lunch_time ? add5(b.kids_lunch_time.slice(0, 5)) : null,
  });
  return { plan, booking: b };
}

function add5(t: string) {
  const [h, m] = t.split(":").map(Number);
  const mins = h * 60 + m + 5;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

/** POST -> preview (no writes). Returns plan + warnings (Case 5 options). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { plan, error } = await buildPlan(supabase, params.id);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ plan });
}

/** PUT -> confirm & save: movement_plans + sessions + resource_bookings.
 *  Body may carry { accepted_warnings: string[], reason } (Case 5 logging). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { plan, booking, error } = await buildPlan(supabase, params.id);
  if (error || !plan || !booking) return NextResponse.json({ error }, { status: 400 });

  // replace existing plan
  await supabase.from("movement_plans").delete().eq("booking_id", params.id);
  const { data: mp, error: mpError } = await supabase
    .from("movement_plans")
    .insert({
      booking_id: params.id,
      num_groups: plan.numGroups,
      session_duration_minutes: 70,
      switch_duration_minutes: 5,
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

  // default task rows (editable later)
  await supabase.from("movement_plan_tasks").insert([
    { movement_plan_id: mp.id, sort_order: 1, task: "Bus Deboarding & Parking", timing_text: booking.bus_reporting_time?.slice(0, 5) ?? null },
    { movement_plan_id: mp.id, sort_order: 2, task: "Transportation to Commons", timing_text: null },
    { movement_plan_id: mp.id, sort_order: 3, task: "Welcoming & Orientation", timing_text: booking.orientation_time?.slice(0, 5) ?? null },
    { movement_plan_id: mp.id, sort_order: 4, task: "Lunch", timing_text: plan.lunch ? `${plan.lunch.fromTime} to ${plan.lunch.toTime}` : null },
    { movement_plan_id: mp.id, sort_order: 5, task: "Feedback & Exit", timing_text: `${plan.exitTime} onwards` },
  ]);

  // rebuild resource reservations for the rotation (Case 1 enforced by DB)
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
            "A lab in this rotation is already reserved by another booking in the same window. Resolve the clash (shift this booking, or free the lab) and regenerate.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: rbErr.message }, { status: 400 });
  }

  if (body.accepted_warnings?.length) {
    await supabase.from("booking_history").insert({
      booking_id: params.id,
      booking_name: booking.name,
      visit_date: booking.visit_date,
      changed_by: user.id,
      change_type: "capacity_override",
      reason: `${body.accepted_warnings.join("; ")}${body.reason ? ` — ${body.reason}` : ""}`,
    });
  }

  return NextResponse.json({ ok: true, plan });
}
