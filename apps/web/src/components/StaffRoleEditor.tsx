"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEPARTMENTS, ROLES } from "@/lib/labels";

export function StaffRoleEditor({ member }: { member: any }) {
  const router = useRouter();
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [dept, setDept] = useState(member.department ?? "");
  const [ext, setExt] = useState(member.extension ?? "");
  const [active, setActive] = useState(member.is_active !== false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function removeIt() {
    if (!window.confirm(`Delete ${member.name} from the staff directory? If they are linked to past bookings, deactivate instead.`)) return;
    setBusy(true);
    setErr(null);
    const { error } = await createClient().from("staff").delete().eq("id", member.id);
    setBusy(false);
    if (error) {
      if (error.code === "23503") {
        setErr("Linked to bookings — deactivated instead.");
        await createClient().from("staff").update({ is_active: false }).eq("id", member.id);
        router.refresh();
      } else setErr(error.message);
    } else router.refresh();
  }

  async function saveIt() {
    setBusy(true);
    await createClient()
      .from("staff")
      .update({ name, role, department: dept || null, extension: ext || null, is_active: active })
      .eq("id", member.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <input className="input w-28 text-xs" value={name} onChange={(e) => setName(e.target.value)} />
      <select className="input w-auto text-xs" value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => <option key={r}>{r}</option>)}
      </select>
      <select className="input w-auto text-xs" value={dept} onChange={(e) => setDept(e.target.value)}>
        <option value="">no dept</option>
        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}
      </select>
      <input className="input w-16 text-xs" placeholder="ext" value={ext} onChange={(e) => setExt(e.target.value)} />
      <label className="whitespace-nowrap text-xs text-slate-500">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> active
      </label>
      <button className="btn-outline text-xs" disabled={busy} onClick={saveIt}>Save</button>
      <button className="btn text-xs text-red-600 hover:bg-red-50" disabled={busy} onClick={removeIt} title="Delete staff member">
        Delete
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
