"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = [
  { value: "pending", label: "Pending", cls: "bg-slate-100 text-slate-600" },
  { value: "working_on", label: "Working on", cls: "bg-amber-100 text-amber-700" },
  { value: "done", label: "Done", cls: "bg-emerald-100 text-emerald-700" },
];

/** Status stepper for a department ask: pending -> working on -> done.
 *  Department heads can update their own department's asks (RLS-enforced);
 *  writers can update all. Read-only roles just see the pill. */
export function AskStatus({ askId, status, canEdit }: { askId: string; status: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const current = STATUSES.find((s) => s.value === (status ?? "pending")) ?? STATUSES[0];

  if (!canEdit) {
    return <span className={`pill ${current.cls}`}>{current.label}</span>;
  }

  async function setStatus(value: string) {
    setBusy(true);
    await createClient().from("department_asks").update({ status: value }).eq("id", askId);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex gap-1">
      {STATUSES.map((s) => (
        <button
          key={s.value}
          disabled={busy}
          onClick={() => setStatus(s.value)}
          className={`pill transition-all ${
            s.value === current.value ? s.cls + " ring-1 ring-slate-400" : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
