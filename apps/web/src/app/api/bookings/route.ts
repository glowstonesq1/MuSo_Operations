import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectStaffOverload, isExclusionViolation } from "@muso/logic";

/**
 * POST /api/bookings — create (or update with { id }).
 * Handles:
 *  - Case 1: resource hard clash -> 409 with clashing booking details
 *  - Case 2: staff overload -> 409 warning unless override:true (+ reason logged)
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json();
  const { id, resource_id, override_staff_warning, override_reason, ...fields } = body;

  // Case 2 — staff overload (soft clash, warn + override)
  if (fields.ops_poc_id && !override_staff_warning) {
    const { data: sameDay } = await supabase
      .from("bookings")
      .select("id, name, slot_start, slot_end, ops_poc_id, staff:staff!bookings_ops_poc_id_fkey(name)")
      .eq("visit_date", fields.visit_date)
      .eq("ops_poc_id", fields.ops_poc_id)
      .neq("status", "cancelled");
    const windows = (sameDay ?? [])
      .filter((b: any) => b.id !== id)
      .map((b: any) => ({
        staffId: b.ops_poc_id,
        staffName: b.staff?.name ?? "Staff",
        bookingId: b.id,
        bookingName: b.name,
        slotStart: b.slot_start,
        slotEnd: b.slot_end,
      }));
    const overload = detectStaffOverload(windows, {
      staffId: fields.ops_poc_id,
      staffName: windows[0]?.staffName ?? "Staff",
      bookingId: id ?? "new",
      bookingName: fields.name,
      slotStart: fields.slot_start,
      slotEnd: fields.slot_end,
    });
    if (overload) {
      return NextResponse.json(
        {
          warning: "staff_overload",
          message: `${overload.staffName} already has ${overload.count - 1} overlapping assignment(s): ${overload.bookings
            .map((b) => b.bookingName)
            .join(", ")}. Continue with override?`,
        },
        { status: 409 }
      );
    }
  }

  let bookingId = id;
  if (id) {
    const { error } = await supabase
      .from("bookings")
      .update({ ...fields, updated_by: user.id })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { data, error } = await supabase
      .from("bookings")
      .insert({ ...fields, created_by: user.id, updated_by: user.id })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    bookingId = data.id;
  }

  if (override_staff_warning && override_reason) {
    await supabase.from("booking_history").insert({
      booking_id: bookingId,
      booking_name: fields.name,
      visit_date: fields.visit_date,
      changed_by: user.id,
      change_type: "staff_overload_override",
      reason: override_reason,
    });
  }

  // Optional direct space reservation (birthday/workshop). Case 1 lives here.
  if (resource_id) {
    // replace this booking's whole-slot reservation
    await supabase.from("resource_bookings").delete().eq("booking_id", bookingId).is("group_label", null);
    const { error: rbError } = await supabase.from("resource_bookings").insert({
      booking_id: bookingId,
      resource_id,
      from_time: `${fields.visit_date}T${fields.slot_start}:00+05:30`,
      to_time: `${fields.visit_date}T${fields.slot_end}:00+05:30`,
      headcount: (fields.children_planned ?? 0) + (fields.adults_planned ?? 0),
    });
    if (rbError) {
      if (isExclusionViolation(rbError.message)) {
        const clash = await describeClash(supabase, resource_id, fields.visit_date);
        return NextResponse.json(
          { warning: "resource_clash", booking_id: bookingId, ...clash },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: rbError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ id: bookingId });
}

async function describeClash(supabase: any, resourceId: string, date: string) {
  const [{ data: resource }, { data: holders }, { data: alternates }] = await Promise.all([
    supabase.from("resources").select("name").eq("id", resourceId).single(),
    supabase
      .from("resource_bookings")
      .select("from_time, to_time, booking:bookings(id, name, slot_start, slot_end, ops_poc:staff!bookings_ops_poc_id_fkey(name))")
      .eq("resource_id", resourceId)
      .gte("from_time", `${date}T00:00:00+05:30`)
      .lte("to_time", `${date}T23:59:59+05:30`),
    supabase.from("resources").select("id, name, capacity").eq("is_bookable", true).neq("id", resourceId),
  ]);
  return {
    message: `${resource?.name ?? "Resource"} is already booked in that window.`,
    resource_name: resource?.name,
    holders: (holders ?? []).map((h: any) => ({
      booking_id: h.booking?.id,
      booking_name: h.booking?.name,
      ops_poc: h.booking?.ops_poc?.name,
      from_time: h.from_time,
      to_time: h.to_time,
    })),
    alternates: alternates ?? [],
    options: [
      "Shift your slot to a free window",
      "Use an alternate resource",
      "Contact the holder of the clashing booking",
    ],
  };
}
