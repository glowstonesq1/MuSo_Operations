"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ResourceVendorEditor({ resources, vendors, canWrite }: { resources: any[]; vendors: any[]; canWrite: boolean }) {
  const router = useRouter();
  const [rName, setRName] = useState("");
  const [rCap, setRCap] = useState("");
  const [rShared, setRShared] = useState(false);
  const [vName, setVName] = useState("");
  const [vThresh, setVThresh] = useState("400");
  const [error, setError] = useState<string | null>(null);

  async function addResource() {
    const { error } = await createClient().from("resources").insert({
      name: rName,
      capacity: rCap ? Number(rCap) : null,
      is_exclusive: !rShared,
    });
    if (error) setError(error.message);
    else {
      setRName("");
      router.refresh();
    }
  }

  async function addVendor() {
    const { error } = await createClient().from("vendors").insert({ name: vName, daily_threshold: Number(vThresh) });
    if (error) setError(error.message);
    else {
      setVName("");
      router.refresh();
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h2 className="mb-2 text-sm font-bold">Resources (spaces & labs)</h2>
        <table className="mb-3 w-full text-sm">
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-1 pr-2 font-medium">{r.name}</td>
                <td className="py-1 pr-2 text-slate-500">cap {r.capacity ?? "—"}</td>
                <td className="py-1 text-xs text-slate-400">{r.is_exclusive ? "exclusive" : "shared"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canWrite && (
          <div className="flex flex-wrap items-end gap-2">
            <input className="input max-w-40" placeholder="Name" value={rName} onChange={(e) => setRName(e.target.value)} />
            <input className="input w-20" placeholder="Cap" type="number" value={rCap} onChange={(e) => setRCap(e.target.value)} />
            <label className="flex items-center gap-1 text-xs text-slate-500">
              <input type="checkbox" checked={rShared} onChange={(e) => setRShared(e.target.checked)} /> shared space
            </label>
            <button className="btn-outline" disabled={!rName} onClick={addResource}>Add</button>
          </div>
        )}
      </div>
      <div className="card">
        <h2 className="mb-2 text-sm font-bold">Food vendors</h2>
        <table className="mb-3 w-full text-sm">
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="py-1 pr-2 font-medium">{v.name}</td>
                <td className="py-1 text-slate-500">daily threshold {v.daily_threshold}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {canWrite && (
          <div className="flex flex-wrap items-end gap-2">
            <input className="input max-w-40" placeholder="Name" value={vName} onChange={(e) => setVName(e.target.value)} />
            <input className="input w-24" placeholder="Threshold" type="number" value={vThresh} onChange={(e) => setVThresh(e.target.value)} />
            <button className="btn-outline" disabled={!vName} onClick={addVendor}>Add</button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
    </div>
  );
}
