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
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {["Date", "Type", "Name", "Slot", "Headcount", "Ops POC", "Status"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((b: any) => (
              <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{b.visit_date}</td>
                <td className="px-3 py-2">
                  <span className="badge" style={{ backgroundColor: TYPE_COLORS[b.booking_type] }}>
                    {TYPE_LABELS[b.booking_type]}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">
                  <Link className="hover:underline" href={`/bookings/${b.id}`}>{b.name}</Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{fmt12h(b.slot_start)}–{fmt12h(b.slot_end)}</td>
                <td className="px-3 py-2">
                  {(b.children_planned ?? 0) + (b.adults_planned ?? 0) + (b.teachers_planned ?? 0)}
                  {b.children_actual != null && <span className="text-pink-600"> (act {b.children_actual})</span>}
                </td>
                <td className="px-3 py-2">{b.ops_poc?.name ?? "NA"}</td>
                <td className="px-3 py-2 text-xs uppercase text-slate-500">{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(bookings ?? []).length === 0 && <p className="p-4 text-sm text-slate-400">No bookings found.</p>}
      </div>
    </div>
  );
}
