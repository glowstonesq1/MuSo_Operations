import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "@/components/BookingForm";

export const dynamic = "force-dynamic";

export default async function EditBookingPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: booking }, { data: staff }, { data: resources }, { data: vendors }, { data: defs }] =
    await Promise.all([
      supabase.from("bookings").select("*").eq("id", params.id).maybeSingle(),
      supabase.from("staff").select("id, name").eq("is_active", true).order("name"),
      supabase.from("resources").select("id, name, capacity").eq("is_bookable", true).order("name"),
      supabase.from("vendors").select("id, name").eq("is_active", true),
      supabase.from("custom_field_defs").select("*").eq("is_active", true).order("sort_order"),
    ]);
  if (!booking) notFound();

  // trim seconds off TIME fields for <input type=time>
  const initial: any = { ...booking };
  for (const [k, v] of Object.entries(initial)) {
    if (typeof v === "string" && /^\d{2}:\d{2}:\d{2}$/.test(v)) initial[k] = v.slice(0, 5);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Edit — {booking.name}</h1>
      <BookingForm
        staff={staff ?? []}
        resources={resources ?? []}
        vendors={vendors ?? []}
        fieldDefs={(defs ?? []) as any}
        initial={initial}
      />
    </div>
  );
}
