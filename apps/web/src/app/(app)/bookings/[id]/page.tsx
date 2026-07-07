import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, getCurrentStaff } from "@/lib/supabase/server";
import { TYPE_COLORS, TYPE_LABELS, prettyDate } from "@/lib/labels";
import { fmt12h, schoolFPWhatsApp } from "@muso/logic";
import { CopyButton } from "@/components/CopyButton";
import { MovementPlanPanel } from "@/components/MovementPlanPanel";
import { BookingActions } from "@/components/BookingActions";
import { AsksEditor } from "@/components/AsksEditor";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const me = await getCurrentStaff();
  const { data: b } = await supabase
    .from("bookings")
    .select("*, ops_poc:staff!bookings_ops_poc_id_fkey(name), sales_rep:staff!bookings_sales_rep_id_fkey(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!b) notFound();

  const [{ data: mp }, { data: asks }, { data: history }, { data: staff }, { data: incidents }, { data: spaces }] = await Promise.all([
    supabase
      .from("movement_plans")
      .select("*, movement_plan_sessions(*, resource:resources(name)), movement_plan_tasks(*)")
      .eq("booking_id", params.id)
      .maybeSingle(),
    supabase.from("department_asks").select("*, poc:staff(name)").eq("booking_id", params.id),
    supabase.from("booking_history").select("*").eq("booking_id", params.id).order("changed_at", { ascending: false }).limit(25),
    supabase.from("staff").select("id, name").eq("is_active", true).order("name"),
    supabase.from("incidents").select("*").eq("booking_id", params.id).order("time_reported", { ascending: false }),
    supabase.from("resources").select("id, name, capacity").eq("is_bookable", true).order("name"),
  ]);

  const isSchoolish = ["school", "csr_general", "csr_stem", "csr_financial_literacy", "csr_future_makers", "summer_camp"].includes(b.booking_type);
  const canWrite = me && ["admin", "ops_poc", "sales"].includes(me.role);

  // group sessions for display
  const sessions = new Map<number, any[]>();
  for (const s of mp?.movement_plan_sessions ?? []) {
    sessions.set(s.session_number, [...(sessions.get(s.session_number) ?? []), s]);
  }

  const whatsapp = schoolFPWhatsApp(
    {
      name: b.name,
      visitDate: prettyDate(b.visit_date),
      slot: `${fmt12h(b.slot_start)} to ${fmt12h(b.slot_end)}`,
      bookingType: TYPE_LABELS[b.booking_type] ?? b.booking_type,
      location: b.location,
      opsPoc: b.ops_poc?.name,
      salesRep: b.sales_rep?.name,
      students: b.children_actual ?? b.children_planned ?? 0,
      teachers: b.teachers_actual ?? b.teachers_planned ?? 0,
      escorts: b.escorts_planned ?? 0,
      buses: b.buses ?? 0,
      grade: b.grade,
      jainKids: b.jain_kids,
      travelAgent: b.travel_agent,
      busReportingTime: b.bus_reporting_time,
      orientationTime: b.orientation_time,
      kidsMenu: b.kids_menu,
      kidsLunchTime: b.kids_lunch_time,
      teachersBreakfastTime: b.teachers_breakfast_time,
      teachersMenu: b.teachers_menu,
      foodVendor: b.food_vendor,
      foodLocation: b.food_location,
      exitTime: b.exit_time,
      remarks: b.remarks,
    },
    mp
      ? {
          numGroups: mp.num_groups,
          groupSizes: [...new Set((mp.movement_plan_sessions ?? []).map((s: any) => s.group_label))].sort().map((l: any) => ({
            label: l,
            size: (mp.movement_plan_sessions ?? []).find((s: any) => s.group_label === l)?.headcount ?? 0,
          })),
          sessions: [...sessions.entries()].sort((x, y) => x[0] - y[0]).map(([num, rows]) => ({
            sessionNumber: num,
            fromTime: rows[0].from_time.slice(0, 5),
            toTime: rows[0].to_time.slice(0, 5),
            assignments: rows.map((r: any) => ({
              groupLabel: r.group_label,
              labId: r.resource_id,
              labName: r.resource?.name ?? "Lab",
              headcount: r.headcount ?? 0,
            })),
          })),
          lunch: mp.lunch_start ? { fromTime: mp.lunch_start.slice(0, 5), toTime: mp.lunch_end?.slice(0, 5) ?? "" } : null,
          exitTime: b.exit_time?.slice(0, 5) ?? "",
          warnings: [],
          labsUsed: [],
        }
      : null
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge" style={{ backgroundColor: TYPE_COLORS[b.booking_type] }}>
          {TYPE_LABELS[b.booking_type]}
        </span>
        <h1 className="text-lg font-bold">{b.name}</h1>
        <span className="text-sm text-slate-500">
          {prettyDate(b.visit_date)} · {fmt12h(b.slot_start)} to {fmt12h(b.slot_end)} · {b.status}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {canWrite && <Link className="btn-outline" href={`/bookings/${b.id}/edit`}>Edit</Link>}
          <a
            className="btn-outline"
            target="_blank"
            href={
              b.booking_type === "birthday"
                ? `/api/pdf/birthday/${b.visit_date}`
                : isSchoolish
                  ? `/api/pdf/school-fp/${b.id}`
                  : `/api/pdf/event/${b.id}`
            }
          >
            Floor Plan PDF
          </a>
          <CopyButton text={whatsapp} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <h2 className="mb-2 text-sm font-bold">Details</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm md:grid-cols-3">
            {[
              ["Location", b.location],
              ["Ops POC", b.ops_poc?.name],
              ["Sales rep", b.sales_rep?.name],
              ["Children (planned)", b.children_planned],
              ["Children (actual)", b.children_actual],
              ["Teachers", b.teachers_planned],
              ["Adults", b.adults_planned],
              ["Escorts", b.escorts_planned],
              ["Buses", b.buses],
              ["Grade", b.grade],
              ["Jain kids", b.jain_kids],
              ["Bus reporting", fmt12h(b.bus_reporting_time)],
              ["Orientation", fmt12h(b.orientation_time)],
              ["Kids lunch", fmt12h(b.kids_lunch_time)],
              ["Exit", fmt12h(b.exit_time)],
              ["Food vendor", b.food_vendor],
              ["Food location", b.food_location],
              ["Kids menu", b.kids_menu],
              ["Teachers menu", b.teachers_menu],
              ["Remarks", b.remarks],
            ]
              .filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "NA")
              .map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs uppercase text-slate-400">{k}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
          </dl>
          {Object.keys(b.custom_fields ?? {}).length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-2 text-sm">
              <h3 className="mb-1 text-xs font-bold uppercase text-slate-400">Custom fields</h3>
              {Object.entries(b.custom_fields).map(([k, v]) => (
                <div key={k}><span className="text-slate-500">{k.replace(/_/g, " ")}:</span> {String(v)}</div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-2 text-sm font-bold">Incidents & history</h2>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
            {(incidents ?? []).map((i: any) => (
              <li key={i.id} className="rounded bg-amber-50 p-1.5">
                <b>{i.incident_type}</b> {i.delay_minutes ? `(${i.delay_minutes} min)` : ""} — {i.description}
              </li>
            ))}
            {(history ?? []).map((h: any) => (
              <li key={h.id} className="border-b border-slate-100 pb-1">
                <b>{h.change_type}</b> · {new Date(h.changed_at).toLocaleString("en-IN")}
                {h.reason && <span className="text-slate-500"> — {h.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {isSchoolish && (
        <div className="card">
          <h2 className="mb-2 text-sm font-bold">Movement plan</h2>
          {mp ? (
            <div className="mb-3 overflow-x-auto">
              <p className="mb-1 text-sm text-slate-600">
                {mp.num_groups} groups · {mp.session_duration_minutes} min sessions · lunch{" "}
                {mp.lunch_start ? `${fmt12h(mp.lunch_start)}–${fmt12h(mp.lunch_end)}` : "NA"}
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {[...sessions.entries()].sort((x, y) => x[0] - y[0]).map(([num, rows]) => (
                    <tr key={num} className="border-t border-slate-100">
                      <td className="py-1 pr-3 font-semibold whitespace-nowrap" style={{ backgroundColor: "#D9E1F2" }}>
                        &nbsp;S{num} {fmt12h(rows[0].from_time)}–{fmt12h(rows[0].to_time)}&nbsp;
                      </td>
                      {rows.map((r: any) => (
                        <td key={r.id} className="px-2 py-1 text-center" style={{ backgroundColor: "#FEF1CC" }}>
                          <div className="text-xs text-slate-500">{r.resource?.name}</div>
                          <div>Group {r.group_label} ({r.headcount})</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-3 text-sm text-slate-400">No movement plan yet.</p>
          )}
          {canWrite && <MovementPlanPanel bookingId={b.id} hasPlan={!!mp} spaces={spaces ?? []} />}
        </div>
      )}

      <div className="card">
        <h2 className="mb-2 text-sm font-bold">Department asks</h2>
        {(asks ?? []).length > 0 && (
          <table className="mb-3 w-full text-sm">
            <tbody>
              {(asks ?? []).map((a: any) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="py-1 pr-3 font-semibold">{a.department.replace(/_/g, " ")}</td>
                  <td className="py-1 pr-3">{a.asks_text}</td>
                  <td className="py-1 pr-3 text-slate-500">{a.poc?.name ?? "—"}</td>
                  <td className="py-1 text-xs uppercase text-slate-400">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canWrite && <AsksEditor bookingId={b.id} staff={staff ?? []} />}
      </div>

      {canWrite && (
        <div className="card">
          <h2 className="mb-2 text-sm font-bold">Live ops (delay / actuals / delete)</h2>
          <BookingActions booking={b} />
        </div>
      )}
    </div>
  );
}
