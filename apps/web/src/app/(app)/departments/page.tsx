import { createClient, getCurrentStaff } from "@/lib/supabase/server";
import { DEPARTMENTS, dateLabel } from "@/lib/labels";
import { fmt12h, deptBriefWhatsApp, aggregateVendorLoad } from "@muso/logic";
import { CopyButton } from "@/components/CopyButton";
import { DateNav } from "@/components/DateNav";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage({
  searchParams,
}: {
  searchParams: { date?: string; dept?: string };
}) {
  const supabase = createClient();
  const me = await getCurrentStaff();
  const date = searchParams.date ?? new Date().toISOString().slice(0, 10);
  // department heads are locked to their own department by RLS anyway
  const dept = me?.role === "department_head" && me.department ? me.department : searchParams.dept ?? "housekeeping";

  const { data: asks } = await supabase
    .from("department_asks")
    .select("*, poc:staff(name), booking:bookings!inner(id, name, visit_date, slot_start, slot_end, food_vendor, children_planned, adults_planned, teachers_planned)")
    .eq("department", dept)
    .eq("booking.visit_date", date);

  // Case 6 — F&B dashboard shows aggregated vendor orders
  let vendorLoads: ReturnType<typeof aggregateVendorLoad> = [];
  if (dept === "fnb") {
    const [{ data: dayBookings }, { data: vendors }] = await Promise.all([
      supabase.from("bookings").select("id, name, food_vendor, children_planned, adults_planned, teachers_planned, children_actual").eq("visit_date", date).neq("status", "cancelled"),
      supabase.from("vendors").select("name, daily_threshold"),
    ]);
    vendorLoads = aggregateVendorLoad(
      (dayBookings ?? []).map((b: any) => ({
        bookingId: b.id,
        bookingName: b.name,
        vendor: b.food_vendor ?? "",
        headcount: (b.children_actual ?? b.children_planned ?? 0) + (b.adults_planned ?? 0) + (b.teachers_planned ?? 0),
      })),
      Object.fromEntries((vendors ?? []).map((v: any) => [v.name, v.daily_threshold]))
    );
  }

  const whatsapp = deptBriefWhatsApp(
    dept.replace(/_/g, " "),
    dateLabel(date),
    (asks ?? []).map((a: any) => ({
      bookingName: a.booking.name,
      timing: `${fmt12h(a.booking.slot_start)} to ${fmt12h(a.booking.slot_end)}`,
      asksText: a.asks_text,
      poc: a.poc?.name,
      status: a.status,
    }))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Department briefs — {dateLabel(date)}</h1>
        <div className="flex gap-2">
          <DateNav date={date} />
          <a className="btn-outline" target="_blank" href={`/api/pdf/dept-brief/${date}/${dept}`}>Brief PDF</a>
          <CopyButton text={whatsapp} />
        </div>
      </div>

      {me?.role !== "department_head" && (
        <div className="flex flex-wrap gap-1">
          {DEPARTMENTS.map((d) => (
            <Link
              key={d}
              href={`/departments?date=${date}&dept=${d}`}
              className={`btn-outline text-xs ${d === dept ? "!bg-slate-900 !text-white" : ""}`}
            >
              {d.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      )}

      <div className="card">
        <h2 className="mb-2 text-sm font-bold uppercase">{dept.replace(/_/g, " ")} asks</h2>
        {(asks ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No asks for this department on this date.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr><th className="py-1 pr-3">Booking</th><th className="py-1 pr-3">Timing</th><th className="py-1 pr-3">Ask</th><th className="py-1 pr-3">POC</th><th>Status</th></tr>
            </thead>
            <tbody>
              {(asks ?? []).map((a: any) => (
                <tr key={a.id} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 pr-3 font-medium">{a.booking.name}</td>
                  <td className="py-1.5 pr-3 whitespace-nowrap">{fmt12h(a.booking.slot_start)}–{fmt12h(a.booking.slot_end)}</td>
                  <td className="py-1.5 pr-3 whitespace-pre-wrap">{a.asks_text}</td>
                  <td className="py-1.5 pr-3">{a.poc?.name ?? "—"}</td>
                  <td className="py-1.5 text-xs uppercase text-slate-500">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dept === "fnb" && (
        <div className="card">
          <h2 className="mb-2 text-sm font-bold">Vendor order aggregation (Case 6)</h2>
          {vendorLoads.length === 0 ? (
            <p className="text-sm text-slate-400">No vendor orders today.</p>
          ) : (
            vendorLoads.map((v) => (
              <div key={v.vendor} className={`mb-2 rounded-md border p-3 text-sm ${v.exceedsThreshold ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
                <p className="font-semibold">
                  {v.vendor}: {v.totalHeadcount} covers across {v.bookingCount} booking(s)
                  {v.exceedsThreshold && <span className="text-red-700"> — exceeds daily threshold of {v.threshold}!</span>}
                </p>
                <ul className="list-disc pl-5 text-slate-600">
                  {v.bookings.map((b) => <li key={b.bookingId}>{b.bookingName}: ~{b.headcount}</li>)}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
