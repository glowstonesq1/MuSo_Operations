"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Conditions -> Generate -> preview (with Case 5 capacity warnings) -> confirm.
 * Conditions cover the real-world cases: rain closes a floor, a school books
 * only a workshop or a dedicated lab, shorter sessions, no lunch, etc.
 */

const DEFAULT_LABS = ["Play Lab", "Discover Lab", "Make Lab"];

export function MovementPlanPanel({
  bookingId,
  hasPlan,
  spaces,
}: {
  bookingId: string;
  hasPlan: boolean;
  spaces: { id: string; name: string; capacity: number | null }[];
}) {
  const router = useRouter();
  const [showOptions, setShowOptions] = useState(false);
  const [selected, setSelected] = useState<string[]>(
    spaces.filter((s) => DEFAULT_LABS.includes(s.name)).map((s) => s.id)
  );
  const [sessionMin, setSessionMin] = useState(70);
  const [perSession, setPerSession] = useState(false);
  const [sessionMins, setSessionMins] = useState<number[]>([70, 70, 70]);
  const [switchMin, setSwitchMin] = useState(5);
  const [lunchMode, setLunchMode] = useState<"seated" | "takeaway" | "none">("seated");
  const [lunchMin, setLunchMin] = useState(60);
  const [lunchTravel, setLunchTravel] = useState(5);
  const [lunchPoc, setLunchPoc] = useState("");
  const [note, setNote] = useState("");

  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [narrative, setNarrative] = useState<string | null>(null);

  const options = () => ({
    lab_ids: selected,
    session_minutes: perSession ? sessionMins.slice(0, selected.length) : sessionMin,
    switch_minutes: switchMin,
    lunch_mode: lunchMode,
    lunch_minutes: lunchMin,
    lunch_travel_minutes: lunchMode === "seated" ? lunchTravel : 0,
    lunch_poc: lunchPoc || undefined,
    note: note || undefined,
  });

  async function generate() {
    if (selected.length === 0) {
      setError("Pick at least one space for the rotation.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/movement-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options()),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error);
    setPreview(data.plan);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    const accepted = (preview?.warnings ?? []).map((w: any) => w.message);
    const res = await fetch(`/api/bookings/${bookingId}/movement-plan`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...options(), accepted_warnings: accepted, reason }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.message ?? data.error);
    setPreview(null);
    router.refresh();
  }

  const toggleSpace = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" onClick={() => setShowOptions((v) => !v)}>
          {showOptions ? "Hide conditions" : "Set conditions"}
        </button>
        <button className="btn-primary" disabled={busy} onClick={generate}>
          {busy ? "Working…" : hasPlan ? "Regenerate movement plan" : "Generate movement plan"}
        </button>
        {hasPlan && (
          <button
            className="btn-outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await fetch(`/api/ai/narrative`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ booking_id: bookingId }),
              });
              const data = await res.json();
              setBusy(false);
              setNarrative(res.ok ? data.suggestion : data.error);
            }}
          >
            AI narrative for teacher
          </button>
        )}
      </div>

      {showOptions && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
          <p className="mb-2 font-semibold text-slate-700">
            Conditions for this visit <span className="font-normal text-slate-400">(rain, dedicated floor, workshop-only…)</span>
          </p>
          <div className="mb-3">
            <span className="label">Spaces in the rotation (groups = spaces picked)</span>
            <div className="flex flex-wrap gap-2">
              {spaces.map((s) => (
                <label
                  key={s.id}
                  className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    selected.includes(s.id)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input type="checkbox" className="hidden" checked={selected.includes(s.id)} onChange={() => toggleSpace(s.id)} />
                  {s.name}
                  {s.capacity ? <span className="opacity-60"> · {s.capacity}</span> : null}
                </label>
              ))}
            </div>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <span className="label">Session durations</span>
              <div className="flex flex-wrap items-center gap-2">
                {!perSession ? (
                  <input className="input w-24" type="number" min={20} value={sessionMin} onChange={(e) => setSessionMin(Number(e.target.value))} />
                ) : (
                  selected.map((_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">S{i + 1}</span>
                      <input
                        className="input w-20"
                        type="number"
                        min={20}
                        value={sessionMins[i] ?? sessionMin}
                        onChange={(e) =>
                          setSessionMins((prev) => {
                            const next = [...prev];
                            next[i] = Number(e.target.value);
                            return next;
                          })
                        }
                      />
                    </div>
                  ))
                )}
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input type="checkbox" checked={perSession} onChange={(e) => setPerSession(e.target.checked)} />
                  different per session (e.g. workshop needs longer)
                </label>
              </div>
            </div>
            <div>
              <span className="label">Switch between floors (min)</span>
              <input className="input w-24" type="number" min={0} value={switchMin} onChange={(e) => setSwitchMin(Number(e.target.value))} />
            </div>
          </div>

          <div className="mb-3 grid gap-3 sm:grid-cols-4">
            <div>
              <span className="label">Food arrangement</span>
              <select className="input" value={lunchMode} onChange={(e) => setLunchMode(e.target.value as any)}>
                <option value="seated">Seated lunch (food court)</option>
                <option value="takeaway">Food box takeaway at exit</option>
                <option value="none">No food break</option>
              </select>
            </div>
            {lunchMode === "seated" && (
              <>
                <div>
                  <span className="label">Lunch duration (min)</span>
                  <input className="input" type="number" min={15} value={lunchMin} onChange={(e) => setLunchMin(Number(e.target.value))} />
                </div>
                <div>
                  <span className="label">Walk to food floor (min, each way)</span>
                  <input className="input" type="number" min={0} value={lunchTravel} onChange={(e) => setLunchTravel(Number(e.target.value))} />
                </div>
              </>
            )}
            {lunchMode !== "none" && (
              <div>
                <span className="label">{lunchMode === "takeaway" ? "Takeaway responsible" : "Lunch responsible"}</span>
                <input className="input" placeholder="e.g. Aniket | Sawood" value={lunchPoc} onChange={(e) => setLunchPoc(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <span className="label">Conditions note (logged to history)</span>
            <input className="input" placeholder="e.g. raining — terrace closed; workshop needs 90 min" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {narrative && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
          <p className="mb-1 font-semibold text-sky-900">Suggested description (copy if you like it):</p>
          <p className="whitespace-pre-wrap">{narrative}</p>
        </div>
      )}
      {preview && (
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-sm">
          <p className="font-semibold">
            Preview — {preview.numGroups} group{preview.numGroups > 1 ? "s" : ""} (
            {preview.groupSizes.map((g: any) => `${g.label}: ${g.size}`).join(", ")})
          </p>
          <table className="mt-2 w-full text-xs">
            <tbody>
              {preview.sessions.map((s: any) => (
                <tr key={s.sessionNumber} className="border-t border-slate-200">
                  <td className="py-1 pr-2 font-semibold whitespace-nowrap">
                    S{s.sessionNumber} {s.fromTime}–{s.toTime}
                  </td>
                  <td className="py-1">
                    {s.assignments.map((a: any) => `${a.labName}: ${a.groupLabel} (${a.headcount})`).join("  ·  ")}
                  </td>
                </tr>
              ))}
              {preview.lunch && (
                <tr className="border-t border-slate-200">
                  <td className="py-1 pr-2 font-semibold">Lunch</td>
                  <td className="py-1">{preview.lunch.fromTime}–{preview.lunch.toTime}</td>
                </tr>
              )}
              <tr className="border-t border-slate-200">
                <td className="py-1 pr-2 font-semibold">Exit</td>
                <td className="py-1">{preview.exitTime} onwards</td>
              </tr>
            </tbody>
          </table>
          {(preview.warnings ?? []).length > 0 && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
              {preview.warnings.map((w: any, i: number) => (
                <div key={i} className="mb-1">
                  <p className="font-semibold text-amber-900">{w.message}</p>
                  {w.options && (
                    <ul className="list-disc pl-5 text-amber-800">
                      {w.options.map((o: string) => <li key={o}>{o}</li>)}
                    </ul>
                  )}
                </div>
              ))}
              <input
                className="input mt-1"
                placeholder="Reason for accepting (logged to history)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              className="btn-primary"
              disabled={busy || ((preview.warnings ?? []).length > 0 && !reason)}
              onClick={confirm}
            >
              Confirm & save (reserves spaces)
            </button>
            <button className="btn-outline" onClick={() => setPreview(null)}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
