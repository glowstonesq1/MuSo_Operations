"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Case 3 (delay cascade), Case 4 (headcount actuals) and delete. */
export function BookingActions({ booking }: { booking: any }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(30);
  const [delayPreview, setDelayPreview] = useState<any>(null);
  const [actual, setActual] = useState<string>(booking.children_actual ?? "");
  const [actualsPreview, setActualsPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function previewDelay() {
    setBusy(true);
    const res = await fetch(`/api/bookings/${booking.id}/delay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    });
    setDelayPreview(await res.json());
    setBusy(false);
  }

  async function confirmDelay() {
    setBusy(true);
    await fetch(`/api/bookings/${booking.id}/delay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes, confirm: true, description: `Reported delay of ${minutes} min` }),
    });
    setBusy(false);
    setDelayPreview(null);
    router.refresh();
  }

  async function previewActuals() {
    setBusy(true);
    const res = await fetch(`/api/bookings/${booking.id}/actuals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ children_actual: Number(actual) }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.dropped) setActualsPreview(data);
    else {
      // no significant drop — just save
      await fetch(`/api/bookings/${booking.id}/actuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ children_actual: Number(actual), confirm: true }),
      });
      setMsg("Actual headcount saved.");
      router.refresh();
    }
  }

  async function confirmActuals(recalc: boolean) {
    setBusy(true);
    await fetch(`/api/bookings/${booking.id}/actuals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ children_actual: Number(actual), confirm: true, recalc }),
    });
    setBusy(false);
    setActualsPreview(null);
    setMsg(recalc ? "Actuals saved; movement plan and food counts recalculated." : "Actuals saved without recalculation.");
    router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete booking "${booking.name}"? Resource holds, movement plan and asks are removed; the audit trail is kept.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
    if (error) setMsg(error.message);
    else {
      router.push("/bookings");
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Report delay (min)</label>
          <input type="number" className="input w-24" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        </div>
        <button className="btn-outline" disabled={busy} onClick={previewDelay}>Preview shift</button>
        <div className="ml-4">
          <label className="label">Children actual</label>
          <input type="number" className="input w-24" value={actual} onChange={(e) => setActual(e.target.value)} />
        </div>
        <button className="btn-outline" disabled={busy || actual === ""} onClick={previewActuals}>Save actuals</button>
        <button className="btn-danger ml-auto" onClick={remove}>Delete booking</button>
      </div>

      {delayPreview && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-900">
            Delay of {minutes} min — shift these downstream events?
          </p>
          <table className="mt-1 text-xs">
            <tbody>
              {(delayPreview.diff ?? []).map((d: any) => (
                <tr key={d.field}>
                  <td className="pr-3 font-semibold">{d.field.replace(/_/g, " ")}</td>
                  <td className="pr-2 line-through text-slate-500">{d.old}</td>
                  <td className="font-semibold">{d.new}</td>
                </tr>
              ))}
              {(delayPreview.sessionDiff ?? []).map((d: any, i: number) => (
                <tr key={i}>
                  <td className="pr-3 font-semibold">Session {d.session} ({d.group})</td>
                  <td className="pr-2 line-through text-slate-500">{d.old}</td>
                  <td className="font-semibold">{d.new}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={confirmDelay}>Confirm shift</button>
            <button className="btn-outline" onClick={() => setDelayPreview(null)}>Cancel</button>
          </div>
        </div>
      )}

      {actualsPreview && (
        <div className="rounded-md border border-pink-300 bg-pink-50 p-3 text-sm">
          <p className="font-semibold text-pink-900">{actualsPreview.message}</p>
          <p className="text-pink-800">
            New groups: {actualsPreview.newGroupSizes.join(" / ")} · food count {actualsPreview.foodCount}
          </p>
          <div className="mt-2 flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => confirmActuals(true)}>Recalculate</button>
            <button className="btn-outline" disabled={busy} onClick={() => confirmActuals(false)}>Save without recalc</button>
            <button className="btn-outline" onClick={() => setActualsPreview(null)}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
    </div>
  );
}
