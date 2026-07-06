"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Writer/admin editing for everything on the Daily Memo:
 *  venue hours & slots, floor POC roster, ticketed visitor counts. */

const FLOOR_ROLES = ["Ops POC", "Birthday", "Reception", "Play Lab", "Discover Lab", "Make Lab", "Grow Lab"];
const SLOT_LABELS = ["10:00", "14:00", "16:00", "Flexi Pass"];

export function DayOpsEditor({
  date,
  settings,
  pocs,
  counts,
}: {
  date: string;
  settings: any | null;
  pocs: any[];
  counts: any[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<any>({
    muso_hours: settings?.muso_hours ?? "10:00 AM to 7:00 PM",
    subko_weekday_hours: settings?.subko_weekday_hours ?? "10.00 AM to 7.00 PM",
    subko_weekend_hours: settings?.subko_weekend_hours ?? "10.00 AM to 7.00 PM",
    liso_open: settings?.liso_open ?? "9:30 AM",
    shop_open: settings?.shop_open ?? "9:30 AM",
    shop_poc: settings?.shop_poc ?? "",
    slot_1: settings?.slot_1?.slice(0, 5) ?? "10:00",
    slot_2: settings?.slot_2?.slice(0, 5) ?? "14:00",
    slot_3: settings?.slot_3?.slice(0, 5) ?? "16:00",
  });
  const [roster, setRoster] = useState<Record<string, string>>(
    Object.fromEntries(FLOOR_ROLES.map((r) => [r, pocs.find((p) => p.floor_role === r)?.staff_names ?? ""]))
  );
  const [visits, setVisits] = useState<Record<string, { children: number; adults: number }>>(
    Object.fromEntries(
      SLOT_LABELS.map((l) => {
        const row = counts.find((c) => c.slot_label === l || c.slot_label?.slice(0, 5) === l);
        return [l, { children: row?.children ?? 0, adults: row?.adults ?? 0 }];
      })
    )
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveAll() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const results = await Promise.all([
      supabase.from("venue_day_settings").upsert({ visit_date: date, ...s, shop_poc: s.shop_poc || null }),
      ...FLOOR_ROLES.filter((r) => roster[r].trim() !== "").map((r, i) =>
        supabase
          .from("floor_poc_assignments")
          .upsert({ visit_date: date, floor_role: r, staff_names: roster[r].trim(), sort_order: i }, { onConflict: "visit_date,floor_role" })
      ),
      ...SLOT_LABELS.map((l) =>
        supabase
          .from("daily_visit_counts")
          .upsert({ visit_date: date, slot_label: l, children: visits[l].children, adults: visits[l].adults }, { onConflict: "visit_date,slot_label" })
      ),
    ]);
    setBusy(false);
    const err = results.find((r: any) => r.error);
    if (err) setMsg((err as any).error.message);
    else {
      setMsg("Saved.");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button className="btn-outline" onClick={() => setOpen(true)}>
        Edit day settings (hours, POCs, visitor counts)
      </button>
    );
  }

  const field = (label: string, key: string, type = "text") => (
    <div key={key}>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={s[key] ?? ""}
        onChange={(e) => setS((prev: any) => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">Day settings — {date}</h2>
        <button className="text-xs text-slate-400 underline" onClick={() => setOpen(false)}>close</button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {field("MuSo hours", "muso_hours")}
        {field("Subko weekdays", "subko_weekday_hours")}
        {field("Subko weekends", "subko_weekend_hours")}
        {field("LiSo opens", "liso_open")}
        {field("Shop opens", "shop_open")}
        {field("Shop POC", "shop_poc")}
        {field("Slot 1 (Blue)", "slot_1", "time")}
        {field("Slot 2 (Green)", "slot_2", "time")}
        {field("Slot 3 (Purple)", "slot_3", "time")}
      </div>

      <div>
        <h3 className="label">Floor POCs</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {FLOOR_ROLES.map((r) => (
            <div key={r} className="flex items-center gap-2">
              <span className="w-28 text-sm text-slate-500">{r}</span>
              <input
                className="input"
                placeholder="e.g. Simran | Neelam"
                value={roster[r]}
                onChange={(e) => setRoster((prev) => ({ ...prev, [r]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="label">Ticketed visitor counts</h3>
        <div className="grid gap-2 md:grid-cols-4">
          {SLOT_LABELS.map((l) => (
            <div key={l} className="rounded border border-slate-200 p-2">
              <div className="mb-1 text-xs font-semibold text-slate-500">{l}</div>
              <div className="flex gap-1">
                <input
                  className="input"
                  type="number"
                  min={0}
                  title="Children"
                  value={visits[l].children}
                  onChange={(e) => setVisits((p) => ({ ...p, [l]: { ...p[l], children: Number(e.target.value) } }))}
                />
                <input
                  className="input"
                  type="number"
                  min={0}
                  title="Adults"
                  value={visits[l].adults}
                  onChange={(e) => setVisits((p) => ({ ...p, [l]: { ...p[l], adults: Number(e.target.value) } }))}
                />
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] text-slate-400"><span>children</span><span>adults</span></div>
            </div>
          ))}
        </div>
      </div>

      {msg && <p className={`text-sm ${msg === "Saved." ? "text-emerald-700" : "text-red-600"}`}>{msg}</p>}
      <button className="btn-primary" disabled={busy} onClick={saveAll}>
        {busy ? "Saving…" : "Save day settings"}
      </button>
    </div>
  );
}
