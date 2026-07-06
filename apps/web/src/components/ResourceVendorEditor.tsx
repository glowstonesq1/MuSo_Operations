"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Fully editable resources (spaces/labs) and vendors for admins & ops. */

function ResourceRow({ r, canWrite }: { r: any; canWrite: boolean }) {
  const router = useRouter();
  const [row, setRow] = useState({
    name: r.name,
    capacity: r.capacity ?? "",
    floor: r.floor ?? "",
    is_exclusive: r.is_exclusive,
    is_bookable: r.is_bookable,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    const { error } = await createClient()
      .from("resources")
      .update({
        name: row.name,
        capacity: row.capacity === "" ? null : Number(row.capacity),
        floor: row.floor || null,
        is_exclusive: row.is_exclusive,
        is_bookable: row.is_bookable,
      })
      .eq("id", r.id);
    setBusy(false);
    if (error) setErr(error.message);
    else router.refresh();
  }

  if (!canWrite) {
    return (
      <tr className="border-t border-slate-100">
        <td className="py-1 pr-2 font-medium">{r.name}</td>
        <td className="py-1 pr-2 text-slate-500">{r.capacity ?? "—"}</td>
        <td className="py-1 pr-2 text-slate-500">{r.floor ?? "—"}</td>
        <td className="py-1 text-xs text-slate-400">{r.is_exclusive ? "exclusive" : "shared"}{r.is_bookable ? "" : " · off"}</td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1 pr-1"><input className="input" value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} /></td>
      <td className="py-1 pr-1 w-20"><input className="input" type="number" value={row.capacity} onChange={(e) => setRow({ ...row, capacity: e.target.value })} /></td>
      <td className="py-1 pr-1 w-28"><input className="input" value={row.floor} onChange={(e) => setRow({ ...row, floor: e.target.value })} /></td>
      <td className="py-1 pr-1 whitespace-nowrap text-xs">
        <label className="mr-2"><input type="checkbox" checked={!row.is_exclusive} onChange={(e) => setRow({ ...row, is_exclusive: !e.target.checked })} /> shared</label>
        <label><input type="checkbox" checked={row.is_bookable} onChange={(e) => setRow({ ...row, is_bookable: e.target.checked })} /> bookable</label>
      </td>
      <td className="py-1">
        <button className="btn-outline text-xs" disabled={busy} onClick={save}>Save</button>
        {err && <span className="ml-1 text-xs text-red-600">{err}</span>}
      </td>
    </tr>
  );
}

function VendorRow({ v, canWrite }: { v: any; canWrite: boolean }) {
  const router = useRouter();
  const [row, setRow] = useState({ name: v.name, daily_threshold: v.daily_threshold, contact: v.contact ?? "", is_active: v.is_active });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    const { error } = await createClient()
      .from("vendors")
      .update({ name: row.name, daily_threshold: Number(row.daily_threshold), contact: row.contact || null, is_active: row.is_active })
      .eq("id", v.id);
    setBusy(false);
    if (error) setErr(error.message);
    else router.refresh();
  }

  if (!canWrite) {
    return (
      <tr className="border-t border-slate-100">
        <td className="py-1 pr-2 font-medium">{v.name}</td>
        <td className="py-1 text-slate-500">threshold {v.daily_threshold}</td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1 pr-1"><input className="input" value={row.name} onChange={(e) => setRow({ ...row, name: e.target.value })} /></td>
      <td className="py-1 pr-1 w-24"><input className="input" type="number" value={row.daily_threshold} onChange={(e) => setRow({ ...row, daily_threshold: Number(e.target.value) })} /></td>
      <td className="py-1 pr-1"><input className="input" placeholder="contact" value={row.contact} onChange={(e) => setRow({ ...row, contact: e.target.value })} /></td>
      <td className="py-1 pr-1 text-xs"><label><input type="checkbox" checked={row.is_active} onChange={(e) => setRow({ ...row, is_active: e.target.checked })} /> active</label></td>
      <td className="py-1">
        <button className="btn-outline text-xs" disabled={busy} onClick={save}>Save</button>
        {err && <span className="ml-1 text-xs text-red-600">{err}</span>}
      </td>
    </tr>
  );
}

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
      setRCap("");
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
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="card">
        <h2 className="mb-2 text-sm font-bold">Resources (spaces & labs)</h2>
        {canWrite && (
          <p className="mb-2 text-xs text-slate-500">
            Edit any field and hit Save. Capacity drives movement-plan limits; "shared" spaces skip the
            hard double-booking block; un-tick "bookable" to retire a space.
          </p>
        )}
        <table className="mb-3 w-full text-sm">
          <tbody>
            {resources.map((r) => <ResourceRow key={r.id} r={r} canWrite={canWrite} />)}
          </tbody>
        </table>
        {canWrite && (
          <div className="flex flex-wrap items-end gap-2">
            <input className="input max-w-40" placeholder="New space name" value={rName} onChange={(e) => setRName(e.target.value)} />
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
            {vendors.map((v) => <VendorRow key={v.id} v={v} canWrite={canWrite} />)}
          </tbody>
        </table>
        {canWrite && (
          <div className="flex flex-wrap items-end gap-2">
            <input className="input max-w-40" placeholder="New vendor name" value={vName} onChange={(e) => setVName(e.target.value)} />
            <input className="input w-24" placeholder="Threshold" type="number" value={vThresh} onChange={(e) => setVThresh(e.target.value)} />
            <button className="btn-outline" disabled={!vName} onClick={addVendor}>Add</button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600 xl:col-span-2">{error}</p>}
    </div>
  );
}
