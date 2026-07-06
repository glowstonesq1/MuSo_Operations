"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEPARTMENTS } from "@/lib/labels";

export function AsksEditor({ bookingId, staff }: { bookingId: string; staff: { id: string; name: string }[] }) {
  const router = useRouter();
  const [dept, setDept] = useState("housekeeping");
  const [text, setText] = useState("");
  const [pocId, setPocId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    const { error } = await createClient().from("department_asks").insert({
      booking_id: bookingId,
      department: dept,
      asks_text: text,
      department_poc_id: pocId || null,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setText("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="label">Department</label>
        <select className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}
        </select>
      </div>
      <div className="flex-1 min-w-48">
        <label className="label">Ask</label>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Tables-8, Stools-15" />
      </div>
      <div>
        <label className="label">POC</label>
        <select className="input" value={pocId} onChange={(e) => setPocId(e.target.value)}>
          <option value="">—</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <button className="btn-outline" disabled={busy || !text} onClick={add}>Add ask</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
