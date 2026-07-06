import Link from "next/link";
import { createClient, getCurrentStaff } from "@/lib/supabase/server";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/labels";
import { fmt12h } from "@muso/logic";

export const dynamic = "force-dynamic";

export default async function BookingsPage({ searchParams }: { searchParams: { q?: string; type?: string } }) {
  const supabase = createClient();
  const staff = await getCurrentStaff();
  let query = supabase
    .from("bookings")
    .select("*, ops_poc:staff!bookings_ops_poc_id_fkey(name)")
    .order("visit_date", { ascending: false })
    .order("slot_start")
    .limit(100);
  if (searchParams.q) query = query.ilike("name", `%${searchParams.q}%`);
  if (searchParams.type) query = query.eq("booking_type", searchParams.type);
  const { data: bookings } = await query;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Bookings</h1>
        {staff?.role !== "viewer" && staff?.role !== "department_head" && (
          <Link href="/bookings/new" className="btn-primary">+ New booking</Link>
        )}
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Search name…" className="input max-w-xs" />
        <select name="type" defaultValue={searchParams.type ?? ""} className="input max-w-xs">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button className="btn-outline">Filter</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table-modern">
          <thead>
            <tr>
              {["Date", "Type", "Name", "Slot", "Headcount", "Ops POC", "Status"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b: any) => (
              <tr key={b.id}>
                <td className="whitespace-nowrap tabular-nums">{b.visit_date}</td>
                <td>
                  <span className="badge" style={{ backgroundColor: TYPE_COLORS[b.booking_type] }}>
                    {TYPE_LABELS[b.booking_type]}
                  </span>
                </td>
                <td className="font-semibold">
                  <Link className="hover:underline" href={`/bookings/${b.id}`}>{b.name}</Link>
                </td>
                <td className="whitespace-nowrap">{fmt12h(b.slot_start)}–{fmt12h(b.slot_end)}</td>
                <td className="tabular-nums">
                  {(b.children_planned ?? 0) + (b.adults_planned ?? 0) + (b.teachers_planned ?? 0)}
                  {b.children_actual != null && <span className="font-semibold text-pink-600"> (act {b.children_actual})</span>}
                </td>
                <td>{b.ops_poc?.name ?? "NA"}</td>
                <td><span className="pill bg-slate-100 uppercase tracking-wider text-slate-500">{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(bookings ?? []).length === 0 && <p className="p-6 text-center text-sm text-slate-400">No bookings found.</p>}
      </div>
    </div>
  );
}
