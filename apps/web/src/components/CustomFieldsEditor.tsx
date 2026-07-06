"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TYPE_LABELS } from "@/lib/labels";

/** Admin tool: add your own fields to any booking type's template —
 *  this is how a brand-new workshop format gets extra fields without code. */
export function CustomFieldsEditor({ defs }: { defs: any[] }) {
  const router = useRouter();
  const [bookingType, setBookingType] = useState<string>("workshop");
  const [label, setLabel] = useState("");
  const [inputType, setInputType] = useState("text");
  const [options, setOptions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setError(null);
    const field_key = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const { error } = await createClient().from("custom_field_defs").insert({
      booking_type: bookingType || null,
      field_key,
      label,
      input_type: inputType,
      options: inputType === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : null,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setLabel("");
      router.refresh();
    }
  }

  async function toggle(def: any) {
    await createClient().from("custom_field_defs").update({ is_active: !def.is_active }).eq("id", def.id);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">Applies to</label>
          <select className="input" value={bookingType} onChange={(e) => setBookingType(e.target.value)}>
            <option value="">All booking types</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="min-w-48 flex-1">
          <label className="label">Field label</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder='e.g. "AV requirements"' />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={inputType} onChange={(e) => setInputType(e.target.value)}>
            {["text", "textarea", "number", "time", "date", "select", "checkbox"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        {inputType === "select" && (
          <div className="min-w-48">
            <label className="label">Options (comma separated)</label>
            <input className="input" value={options} onChange={(e) => setOptions(e.target.value)} />
          </div>
        )}
        <button className="btn-primary" disabled={busy || !label} onClick={add}>Add field</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr><th className="py-1 pr-3">Label</th><th className="py-1 pr-3">Key</th><th className="py-1 pr-3">Type</th><th className="py-1 pr-3">Applies to</th><th>Active</th></tr>
        </thead>
        <tbody>
          {defs.map((d) => (
            <tr key={d.id} className="border-t border-slate-100">
              <td className="py-1 pr-3">{d.label}</td>
              <td className="py-1 pr-3 font-mono text-xs">{d.field_key}</td>
              <td className="py-1 pr-3">{d.input_type}</td>
              <td className="py-1 pr-3">{d.booking_type ? TYPE_LABELS[d.booking_type] : "All"}</td>
              <td className="py-1">
                <button className="btn-outline text-xs" onClick={() => toggle(d)}>
                  {d.is_active ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
