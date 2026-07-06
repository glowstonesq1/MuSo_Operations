import { createClient } from "@/lib/supabase/server";
import { BookingForm } from "@/components/BookingForm";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({ searchParams }: { searchParams: { date?: string } }) {
  const supabase = createClient();
  const [{ data: staff }, { data: resources }, { data: vendors }, { data: defs }] = await Promise.all([
    supabase.from("staff").select("id, name").eq("is_active", true).order("name"),
    supabase.from("resources").select("id, name, capacity").eq("is_bookable", true).order("name"),
    supabase.from("vendors").select("id, name").eq("is_active", true),
    supabase.from("custom_field_defs").select("*").eq("is_active", true).order("sort_order"),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">New booking</h1>
      <BookingForm
        staff={staff ?? []}
        resources={resources ?? []}
        vendors={vendors ?? []}
        fieldDefs={(defs ?? []) as any}
        defaultDate={searchParams.date}
      />
    </div>
  );
}
