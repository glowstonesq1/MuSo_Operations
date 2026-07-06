"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DEPARTMENTS, ROLES } from "@/lib/labels";

export function StaffRoleEditor({ member }: { member: any }) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [dept, setDept] = useState(member.department ?? "");
  const [ext, setExt] = useState(member.extension ?? "");
  const [busy, setBusy] = useState(false);

  async function saveIt() {
    setBusy(true);
    await createClient()
      .from("staff")
      .update({ role, department: dept || null, extension: ext || null })
      .eq("id", member.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      <select className="input w-auto text-xs" value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => <option key={r}>{r}</option>)}
      </select>
      <select className="input w-auto text-xs" value={dept} onChange={(e) => setDept(e.target.value)}>
        <option value="">no dept</option>
        {DEPARTMENTS.map((d) => <option key={d} value={d}>{d.replace(/_/g, " ")}</option>)}
      </select>
      <input className="input w-16 text-xs" placeholder="ext" value={ext} onChange={(e) => setExt(e.target.value)} />
      <button className="btn-outline text-xs" disabled={busy} onClick={saveIt}>Save</button>
    </div>
  );
}
