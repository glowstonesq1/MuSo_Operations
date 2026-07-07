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
  const dept = me?.role === "department_head" && me.department ? me.department : searchParams.dept ?? "all";
  const showAll = dept === "all";

  let asksQuery = supabase
    .from("department_asks")
    .select("*, poc:staff(name), booking:bookings!inner(id, name, visit_date, slot_start, slot_end, food_vendor, children_planned, adults_planned, teachers_planned)")
    .eq("booking.visit_date", date);
  if (!showAll) asksQuery = asksQuery.eq("department", dept);
  const { data: asks } = await asksQuery.order("department");

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
    showAll ? "All Departments" : dept.replace(/_/g, " "),
    dateLabel(date),
    (asks ?? []).map((a: any) => ({
      bookingName: `${showAll ? `[${a.department.replace(/_/g, " ")}] ` : ""}${a.booking.name}`,
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
          {!showAll && (
            <a className="btn-outline" target="_blank" href={`/api/pdf/dept-brief/${date}/${dept}`}>Brief PDF</a>
          )}
          <CopyButton text={whatsapp} />
        </div>
      </div>

      {me?.role !== "department_head" && (
        <div className="flex flex-wrap gap-1">
          <Link
            href={`/departments?date=${date}&dept=all`}
            className={`btn-outline text-xs ${showAll ? "!bg-slate-900 !text-white" : ""}`}
          >
            All departments
          </Link>
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
        <h2 className="section-title uppercase">{showAll ? "All departments" : dept.replace(/_/g, " ")} — asks</h2>
        {(asks ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No asks on this date.</p>
        ) : (
          <table className="table-modern">
            <thead>
              <tr>
                {showAll && <th>Department</th>}
                <th>Booking</th><th>Timing</th><th>Ask</th><th>POC</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(asks ?? []).map((a: any) => (
                <tr key={a.id} className="align-top">
                  {showAll && (
                    <td><span className="pill bg-slate-100 text-slate-600">{a.department.replace(/_/g, " ")}</span></td>
                  )}
                  <td className="font-semibold">{a.booking.name}</td>
                  <td className="whitespace-nowrap">{fmt12h(a.booking.slot_start)}–{fmt12h(a.booking.slot_end)}</td>
                  <td className="whitespace-pre-wrap">{a.asks_text}</td>
                  <td>{a.poc?.name ?? "—"}</td>
                  <td><span className="pill bg-slate-100 uppercase tracking-wider text-slate-500">{a.status}</span></td>
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
