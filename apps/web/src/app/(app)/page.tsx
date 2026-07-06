import Link from "next/link";
import { createClient, getCurrentStaff } from "@/lib/supabase/server";
import { dateLabel, TYPE_COLORS, TYPE_LABELS, SLOT_COLORS } from "@/lib/labels";
import { fmt12h, dailyMemoWhatsApp, aggregateVendorLoad } from "@muso/logic";
import { CopyButton } from "@/components/CopyButton";
import { DateNav } from "@/components/DateNav";

export const dynamic = "force-dynamic";

export default async function DailyMemoPage({ searchParams }: { searchParams: { date?: string } }) {
  const supabase = createClient();
  const staff = await getCurrentStaff();
  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);

  const [{ data: bookings }, { data: settings }, { data: pocs }, { data: counts }, { data: contacts }, { data: vendors }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("*, ops_poc:staff!bookings_ops_poc_id_fkey(name)")
        .eq("visit_date", date)
        .neq("status", "cancelled")
        .order("slot_start"),
      supabase.from("venue_day_settings").select("*").eq("visit_date", date).maybeSingle(),
      supabase.from("floor_poc_assignments").select("*").eq("visit_date", date).order("sort_order"),
      supabase.from("daily_visit_counts").select("*").eq("visit_date", date),
      supabase.from("staff").select("name, extension").not("extension", "is", null).eq("is_active", true),
      supabase.from("vendors").select("name, daily_threshold"),
    ]);

  const rows = bookings ?? [];
  const label = dateLabel(date);

  // Case 6 — vendor aggregation warning
  const vendorLoads = aggregateVendorLoad(
    rows.map((b: any) => ({
      bookingId: b.id,
      bookingName: b.name,
      vendor: b.food_vendor ?? "",
      headcount:
        (b.children_actual ?? b.children_planned ?? 0) +
        (b.teachers_actual ?? b.teachers_planned ?? 0) +
        (b.adults_actual ?? b.adults_planned ?? 0),
    })),
    Object.fromEntries((vendors ?? []).map((v: any) => [v.name, v.daily_threshold]))
  );

  const whatsapp = dailyMemoWhatsApp({
    dateLabel: label,
    musoHours: settings?.muso_hours ?? "10:00 AM to 7:00 PM",
    bookings: rows.map((b: any) => ({
      type: TYPE_LABELS[b.booking_type] ?? b.booking_type,
      name: b.name,
      timing: `${fmt12h(b.slot_start)} to ${fmt12h(b.slot_end)}`,
      opsPoc: b.ops_poc?.name ?? "NA",
      total: (b.children_planned ?? 0) + (b.adults_planned ?? 0) + (b.teachers_planned ?? 0) + (b.escorts_planned ?? 0),
    })),
    floorPocs: (pocs ?? []).map((p: any) => ({ role: p.floor_role, names: p.staff_names })),
    slotCounts: (counts ?? []).map((c: any) => ({ slot: c.slot_label, children: c.children, adults: c.adults })),
    contacts: (contacts ?? []).map((c: any) => ({ name: c.name, extension: c.extension })),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold">Daily Memo — {label}</h1>
        <div className="flex items-center gap-2">
          <DateNav date={date} />
          <a className="btn-outline" href={`/api/pdf/memo/${date}`} target="_blank">
            Memo PDF
          </a>
          <CopyButton text={whatsapp} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries({ "10 AM": "blue", "2 PM": "green", "4 PM": "purple", "Flexi": "yellow" }).map(([l, c]) => (
          <span key={l} className="badge" style={{ backgroundColor: SLOT_COLORS[c] }}>
            {l}
          </span>
        ))}
        <span className="ml-auto text-slate-500">MuSo hours: {settings?.muso_hours ?? "10:00 AM to 7:00 PM"}</span>
      </div>

      {vendorLoads.filter((v) => v.exceedsThreshold).map((v) => (
        <div key={v.vendor} className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          F&B load warning: {v.vendor} has {v.bookingCount} orders today totalling ~{v.totalHeadcount} covers
          (threshold {v.threshold}). F&B lead should confirm capacity.
        </div>
      ))}

      {rows.length === 0 ? (
        <div className="card text-sm text-slate-500">No bookings for this date.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((b: any) => (
            <Link key={b.id} href={`/bookings/${b.id}`} className="card block hover:border-slate-400">
              <div className="mb-1 flex items-center gap-2">
                <span className="badge" style={{ backgroundColor: TYPE_COLORS[b.booking_type] ?? "#475569" }}>
                  {TYPE_LABELS[b.booking_type] ?? b.booking_type}
                </span>
                {b.slot_color && (
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: SLOT_COLORS[b.slot_color] }} />
                )}
                <span className="ml-auto text-xs uppercase text-slate-400">{b.status}</span>
              </div>
              <div className="font-semibold">{b.name}</div>
              <div className="text-sm text-slate-600">
                {fmt12h(b.slot_start)} to {fmt12h(b.slot_end)} · POC {b.ops_poc?.name ?? "NA"}
              </div>
              <div className="text-sm text-slate-500">
                {b.children_planned ?? 0} children · {b.teachers_planned ?? 0} teachers · {b.adults_planned ?? 0} adults
                {b.children_actual != null && <span className="text-pink-600"> · actual {b.children_actual}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="card">
          <h2 className="mb-2 text-sm font-bold">Floor POCs</h2>
          {(pocs ?? []).map((p: any) => (
            <div key={p.id} className="flex justify-between border-b border-slate-100 py-1 text-sm">
              <span className="text-slate-500">{p.floor_role}</span>
              <span>{p.staff_names}</span>
            </div>
          ))}
          {(pocs ?? []).length === 0 && <p className="text-sm text-slate-400">Not set for this date.</p>}
        </div>
        <div className="card">
          <h2 className="mb-2 text-sm font-bold">Ticketed Visitors</h2>
          {(counts ?? []).map((c: any) => (
            <div key={c.id} className="flex justify-between border-b border-slate-100 py-1 text-sm">
              <span className="text-slate-500">{c.slot_label === "Flexi Pass" ? "Flexi Pass" : fmt12h(c.slot_label)}</span>
              <span>{c.children} children · {c.adults} adults</span>
            </div>
          ))}
          {(counts ?? []).length === 0 && <p className="text-sm text-slate-400">No walk-in counts entered.</p>}
        </div>
        <div className="card">
          <h2 className="mb-2 text-sm font-bold">Contacts (Extensions)</h2>
          {(contacts ?? []).map((c: any) => (
            <div key={c.name} className="flex justify-between border-b border-slate-100 py-1 text-sm">
              <span>{c.name}</span>
              <span className="text-slate-500">ext {c.extension}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a className="btn-outline" href={`/api/pdf/birthday/${date}`} target="_blank">Birthday FP PDF</a>
        {staff?.role !== "viewer" && (
          <Link className="btn-primary" href={`/bookings/new?date=${date}`}>
            + New booking
          </Link>
        )}
      </div>
    </div>
  );
}
