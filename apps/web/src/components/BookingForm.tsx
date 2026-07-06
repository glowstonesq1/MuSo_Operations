"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SLOT_PRESETS, TYPE_LABELS } from "@/lib/labels";

/**
 * One form for every booking type. Sections show/hide per type, and admins can
 * extend any type with their own fields (custom_field_defs) — so a brand-new
 * kind of workshop can get its own template without a code change.
 */

interface Option { id: string; name: string; capacity?: number | null }
interface FieldDef { id: string; booking_type: string | null; field_key: string; label: string; input_type: string; options: string[] | null; section: string }

export interface BookingFormProps {
  staff: Option[];
  resources: Option[];
  vendors: Option[];
  fieldDefs: FieldDef[];
  initial?: any;
  defaultDate?: string;
}

const F = {
  text: (props: any) => <input className="input" type="text" {...props} />,
  number: (props: any) => <input className="input" type="number" {...props} />,
  time: (props: any) => <input className="input" type="time" {...props} />,
  date: (props: any) => <input className="input" type="date" {...props} />,
  textarea: (props: any) => <textarea className="input" rows={2} {...props} />,
};

// Must live at module scope: defining this inside BookingForm gave it a new
// component identity on every keystroke, so React remounted the subtree and
// each input lost focus after a single character.
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="label">{label}</label>
    {children}
  </div>
);

export function BookingForm({ staff, resources, vendors, fieldDefs, initial, defaultDate }: BookingFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<any>(
    initial ?? {
      booking_type: "school",
      status: "draft",
      visit_date: defaultDate ?? new Date().toISOString().slice(0, 10),
      slot_start: "09:30",
      slot_end: "14:30",
      day_slot: "morning",
      custom_fields: {},
    }
  );
  const [resourceId, setResourceId] = useState<string>(initial?.resource_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clash, setClash] = useState<any>(null);
  const [staffWarning, setStaffWarning] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const t = form.booking_type as string;
  const isSchoolish = ["school", "csr_general", "csr_stem", "csr_financial_literacy", "csr_future_makers", "summer_camp"].includes(t);
  const isBirthday = t === "birthday";
  const isEvent = ["workshop", "collaboration", "ticketed_museum"].includes(t);

  const myDefs = useMemo(
    () => fieldDefs.filter((d) => d.booking_type === null || d.booking_type === t),
    [fieldDefs, t]
  );

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v === "" ? null : v }));
  const setCF = (k: string, v: any) =>
    setForm((f: any) => ({ ...f, custom_fields: { ...(f.custom_fields ?? {}), [k]: v } }));

  async function save(withOverride = false) {
    setBusy(true);
    setError(null);
    setClash(null);
    setStaffWarning(null);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        id: initial?.id,
        resource_id: resourceId || undefined,
        override_staff_warning: withOverride,
        override_reason: withOverride ? overrideReason : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.status === 409 && data.warning === "staff_overload") {
      setStaffWarning(data.message);
      return;
    }
    if (res.status === 409 && data.warning === "resource_clash") {
      setClash(data);
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    router.push(`/bookings/${data.id}`);
    router.refresh();
  }

  async function aiAutofill() {
    setAiBusy(true);
    setAiNote(null);
    const res = await fetch("/api/ai/auto_fill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, grade: form.grade, location: form.location, booking_type: t }),
    });
    const data = await res.json();
    setAiBusy(false);
    if (!res.ok) {
      setAiNote(data.error ?? "AI unavailable — fill manually.");
      return;
    }
    const s = data.suggestion ?? {};
    // Suggestions only prefill EMPTY fields; the user reviews before saving.
    setForm((f: any) => ({
      ...f,
      kids_menu: f.kids_menu ?? s.kids_menu,
      teachers_menu: f.teachers_menu ?? s.teachers_menu,
      food_vendor: f.food_vendor ?? s.food_vendor,
      orientation_time: f.orientation_time ?? s.orientation_time,
      exit_time: f.exit_time ?? s.exit_time,
    }));
    setAiNote(`AI suggestions applied to empty fields${data.cached ? " (cached)" : ""}. Review before saving — nothing is saved automatically.`);
  }

  return (
    <div className="space-y-4">
      {/* Type + slot */}
      <div className="card grid gap-3 md:grid-cols-4">
        <Row label="Booking type">
          <select className="input" value={t} onChange={(e) => set("booking_type", e.target.value)}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Row>
        <Row label="Status">
          <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
            {["draft", "confirmed", "in_progress", "completed", "cancelled"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Row>
        <Row label="Date">
          <F.date value={form.visit_date ?? ""} onChange={(e: any) => set("visit_date", e.target.value)} required />
        </Row>
        <Row label="Day slot (FP column)">
          <select className="input" value={form.day_slot ?? ""} onChange={(e) => set("day_slot", e.target.value)}>
            <option value="">—</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </Row>
        <Row label="Start">
          <F.time value={form.slot_start ?? ""} onChange={(e: any) => set("slot_start", e.target.value)} required />
        </Row>
        <Row label="End">
          <F.time value={form.slot_end ?? ""} onChange={(e: any) => set("slot_end", e.target.value)} required />
        </Row>
        <div className="md:col-span-2">
          <label className="label">Public slot presets</label>
          <div className="flex flex-wrap gap-1">
            {SLOT_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn-outline px-2 py-1 text-xs"
                onClick={() => setForm((f: any) => ({ ...f, slot_start: p.start, slot_end: p.end, slot_color: p.color }))}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Client info */}
      <div className="card grid gap-3 md:grid-cols-3">
        <Row label={isBirthday ? "Host name" : isEvent ? "Event name" : "School / Org name"}>
          <F.text value={form.name ?? ""} onChange={(e: any) => set("name", e.target.value)} required />
        </Row>
        <Row label="Location">
          <F.text value={form.location ?? ""} onChange={(e: any) => set("location", e.target.value)} />
        </Row>
        <Row label="External POC">
          <F.text value={form.poc_external_name ?? ""} onChange={(e: any) => set("poc_external_name", e.target.value)} />
        </Row>
        <Row label="External POC contact">
          <F.text value={form.poc_external_contact ?? ""} onChange={(e: any) => set("poc_external_contact", e.target.value)} />
        </Row>
        <Row label="Ops POC">
          <select className="input" value={form.ops_poc_id ?? ""} onChange={(e) => set("ops_poc_id", e.target.value)}>
            <option value="">—</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Row>
        <Row label="Sales rep">
          <select className="input" value={form.sales_rep_id ?? ""} onChange={(e) => set("sales_rep_id", e.target.value)}>
            <option value="">—</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Row>
        {isSchoolish && (
          <>
            <Row label="Travel agent"><F.text value={form.travel_agent ?? ""} onChange={(e: any) => set("travel_agent", e.target.value)} /></Row>
            <Row label="TA POC"><F.text value={form.poc_travel_agent ?? ""} onChange={(e: any) => set("poc_travel_agent", e.target.value)} /></Row>
            <Row label="TA contact"><F.text value={form.travel_agent_contact ?? ""} onChange={(e: any) => set("travel_agent_contact", e.target.value)} /></Row>
          </>
        )}
      </div>

      {/* Headcount */}
      <div className="card grid gap-3 md:grid-cols-4">
        <Row label={isBirthday ? "# Children" : "Students planned"}>
          <F.number value={form.children_planned ?? ""} onChange={(e: any) => set("children_planned", e.target.value === "" ? null : Number(e.target.value))} />
        </Row>
        <Row label="Adults planned">
          <F.number value={form.adults_planned ?? ""} onChange={(e: any) => set("adults_planned", e.target.value === "" ? null : Number(e.target.value))} />
        </Row>
        {isSchoolish && (
          <>
            <Row label="Teachers"><F.number value={form.teachers_planned ?? ""} onChange={(e: any) => set("teachers_planned", e.target.value === "" ? null : Number(e.target.value))} /></Row>
            <Row label="Escorts"><F.number value={form.escorts_planned ?? ""} onChange={(e: any) => set("escorts_planned", e.target.value === "" ? null : Number(e.target.value))} /></Row>
            <Row label="Buses"><F.number value={form.buses ?? ""} onChange={(e: any) => set("buses", e.target.value === "" ? null : Number(e.target.value))} /></Row>
            <Row label="Grade"><F.text value={form.grade ?? ""} onChange={(e: any) => set("grade", e.target.value)} /></Row>
            <Row label="Jain kids"><F.number value={form.jain_kids ?? ""} onChange={(e: any) => set("jain_kids", e.target.value === "" ? null : Number(e.target.value))} /></Row>
          </>
        )}
        {isBirthday && (
          <Row label="Age group"><F.text value={form.age_group ?? ""} onChange={(e: any) => set("age_group", e.target.value)} placeholder="e.g. 5 Years" /></Row>
        )}
      </div>

      {/* Food + timings */}
      {(isSchoolish || isBirthday) && (
        <div className="card grid gap-3 md:grid-cols-3">
          <Row label="Food vendor">
            <input className="input" list="vendors" value={form.food_vendor ?? ""} onChange={(e) => set("food_vendor", e.target.value)} />
            <datalist id="vendors">{vendors.map((v) => <option key={v.id} value={v.name} />)}</datalist>
          </Row>
          <Row label="Food location"><F.text value={form.food_location ?? ""} onChange={(e: any) => set("food_location", e.target.value)} /></Row>
          {isSchoolish ? (
            <>
              <Row label="Kids menu"><F.textarea value={form.kids_menu ?? ""} onChange={(e: any) => set("kids_menu", e.target.value)} /></Row>
              <Row label="Kids lunch time"><F.time value={form.kids_lunch_time ?? ""} onChange={(e: any) => set("kids_lunch_time", e.target.value)} /></Row>
              <Row label="Teachers menu"><F.textarea value={form.teachers_menu ?? ""} onChange={(e: any) => set("teachers_menu", e.target.value)} /></Row>
              <Row label="Teachers breakfast"><F.time value={form.teachers_breakfast_time ?? ""} onChange={(e: any) => set("teachers_breakfast_time", e.target.value)} /></Row>
              <Row label="Bus reporting"><F.time value={form.bus_reporting_time ?? ""} onChange={(e: any) => set("bus_reporting_time", e.target.value)} /></Row>
              <Row label="Orientation"><F.time value={form.orientation_time ?? ""} onChange={(e: any) => set("orientation_time", e.target.value)} /></Row>
              <Row label="Exit time"><F.time value={form.exit_time ?? ""} onChange={(e: any) => set("exit_time", e.target.value)} /></Row>
            </>
          ) : (
            <>
              <Row label="F&B menu"><F.text value={form.fnb_menu ?? ""} onChange={(e: any) => set("fnb_menu", e.target.value)} /></Row>
              <Row label="Entry at Commons"><F.time value={form.entry_commons_time ?? ""} onChange={(e: any) => set("entry_commons_time", e.target.value)} /></Row>
              <Row label="Entry inside museum"><F.time value={form.entry_museum_time ?? ""} onChange={(e: any) => set("entry_museum_time", e.target.value)} /></Row>
              <Row label="Cake cutting start"><F.time value={form.cake_cutting_start ?? ""} onChange={(e: any) => set("cake_cutting_start", e.target.value)} /></Row>
              <Row label="Cake cutting end"><F.time value={form.cake_cutting_end ?? ""} onChange={(e: any) => set("cake_cutting_end", e.target.value)} /></Row>
              <Row label="Cake cutting location"><F.text value={form.cake_cutting_location ?? ""} onChange={(e: any) => set("cake_cutting_location", e.target.value)} /></Row>
              <Row label="Decor"><F.text value={form.decor_type ?? ""} onChange={(e: any) => set("decor_type", e.target.value)} /></Row>
              <Row label="Decor setup info"><F.text value={form.decor_setup_info ?? ""} onChange={(e: any) => set("decor_setup_info", e.target.value)} /></Row>
              <Row label="Entry band color"><F.text value={form.entry_band_color ?? ""} onChange={(e: any) => set("entry_band_color", e.target.value)} /></Row>
              <Row label="Welcome note"><F.text value={form.welcome_note ?? ""} onChange={(e: any) => set("welcome_note", e.target.value)} /></Row>
              <Row label="Photography package"><F.text value={form.photography_package ?? ""} onChange={(e: any) => set("photography_package", e.target.value)} /></Row>
              <Row label="Chef & team"><F.text value={form.chef_team ?? ""} onChange={(e: any) => set("chef_team", e.target.value)} /></Row>
            </>
          )}
        </div>
      )}

      {/* Event/workshop section */}
      {isEvent && (
        <div className="card grid gap-3 md:grid-cols-3">
          <Row label="Workshop name"><F.text value={form.workshop_name ?? ""} onChange={(e: any) => set("workshop_name", e.target.value)} /></Row>
          <Row label="Event location"><F.text value={form.event_location ?? ""} onChange={(e: any) => set("event_location", e.target.value)} /></Row>
          <Row label="Partner / collaborator"><F.text value={form.partner_name ?? ""} onChange={(e: any) => set("partner_name", e.target.value)} /></Row>
          <Row label="Partner POC"><F.text value={form.partner_poc ?? ""} onChange={(e: any) => set("partner_poc", e.target.value)} /></Row>
          <Row label="Ideal ages"><F.text value={form.ideal_ages ?? ""} onChange={(e: any) => set("ideal_ages", e.target.value)} /></Row>
          <Row label="Ticketing platform"><F.text value={form.ticketing_platform ?? ""} onChange={(e: any) => set("ticketing_platform", e.target.value)} /></Row>
          <Row label="Ticketed?">
            <select className="input" value={form.is_ticketed ? "yes" : "no"} onChange={(e) => set("is_ticketed", e.target.value === "yes")}>
              <option value="no">Free (RSVP)</option>
              <option value="yes">Ticketed</option>
            </select>
          </Row>
          <Row label="Ticket price"><F.number value={form.ticket_price ?? ""} onChange={(e: any) => set("ticket_price", e.target.value === "" ? null : Number(e.target.value))} /></Row>
          <div className="md:col-span-3 grid gap-3 md:grid-cols-2">
            <Row label="About the event"><F.textarea value={form.about_event ?? ""} onChange={(e: any) => set("about_event", e.target.value)} /></Row>
            <Row label="Setup instructions (internal)"><F.textarea value={form.setup_instructions_internal ?? ""} onChange={(e: any) => set("setup_instructions_internal", e.target.value)} /></Row>
            <Row label="Setup instructions (external)"><F.textarea value={form.setup_instructions_external ?? ""} onChange={(e: any) => set("setup_instructions_external", e.target.value)} /></Row>
            <Row label="Other notes"><F.textarea value={form.other_notes ?? ""} onChange={(e: any) => set("other_notes", e.target.value)} /></Row>
          </div>
        </div>
      )}

      {/* Custom fields — the team's own template extensions */}
      {myDefs.length > 0 && (
        <div className="card grid gap-3 md:grid-cols-3">
          <div className="md:col-span-3 text-xs font-semibold uppercase text-slate-400">
            Custom fields for this template (add more in Settings)
          </div>
          {myDefs.map((d) => {
            const Input = (F as any)[d.input_type] ?? F.text;
            const v = form.custom_fields?.[d.field_key] ?? "";
            return (
              <Row key={d.id} label={d.label}>
                {d.input_type === "select" && d.options ? (
                  <select className="input" value={v} onChange={(e) => setCF(d.field_key, e.target.value)}>
                    <option value="">—</option>
                    {d.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : d.input_type === "checkbox" ? (
                  <input type="checkbox" checked={!!v} onChange={(e) => setCF(d.field_key, e.target.checked)} />
                ) : (
                  <Input value={v} onChange={(e: any) => setCF(d.field_key, e.target.value)} />
                )}
              </Row>
            );
          })}
        </div>
      )}

      {/* Space reservation + remarks */}
      <div className="card grid gap-3 md:grid-cols-2">
        <Row label="Reserve a space (hard clash check)">
          <select className="input" value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
            <option value="">— none (labs reserved via movement plan) —</option>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` (cap ${r.capacity})` : ""}</option>
            ))}
          </select>
        </Row>
        <Row label="Remarks">
          <div className="flex gap-2">
            <F.text value={form.remarks ?? ""} onChange={(e: any) => set("remarks", e.target.value)} />
            <button type="button" className="btn-outline whitespace-nowrap" disabled={aiBusy} onClick={async () => {
              setAiBusy(true);
              const res = await fetch("/api/ai/remarks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ booking: form }),
              });
              const data = await res.json();
              setAiBusy(false);
              if (res.ok && data.suggestion) set("remarks", String(data.suggestion).trim());
              else setAiNote(data.error ?? "AI unavailable");
            }}>
              AI draft
            </button>
          </div>
        </Row>
      </div>

      {/* Warnings / clash panel */}
      {staffWarning && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-900">Staff overload warning</p>
          <p className="text-amber-800">{staffWarning}</p>
          <div className="mt-2 flex gap-2">
            <input className="input max-w-sm" placeholder="Override reason (required)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
            <button className="btn-primary" disabled={!overrideReason || busy} onClick={() => save(true)}>
              Override & save
            </button>
          </div>
        </div>
      )}
      {clash && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">
          <p className="font-semibold text-red-900">Resource clash — booking not reserved</p>
          <p className="text-red-800">{clash.message}</p>
          <ul className="mt-1 list-disc pl-5 text-red-800">
            {(clash.holders ?? []).map((h: any, i: number) => (
              <li key={i}>
                Held by <b>{h.booking_name}</b> (POC {h.ops_poc ?? "NA"}){" "}
                {h.booking_id && <a className="underline" href={`/bookings/${h.booking_id}`}>view</a>}
              </li>
            ))}
          </ul>
          <p className="mt-2 font-semibold text-red-900">Options:</p>
          <ol className="list-decimal pl-5 text-red-800">
            {(clash.options ?? []).map((o: string) => <li key={o}>{o}</li>)}
          </ol>
          {(clash.alternates ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {clash.alternates.map((a: any) => (
                <button key={a.id} className="btn-outline text-xs" onClick={() => { setResourceId(a.id); setClash(null); }}>
                  Use {a.name}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-red-700">
            The booking itself was saved as draft; only the space reservation was blocked.
          </p>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {aiNote && <p className="text-sm text-sky-700">{aiNote}</p>}

      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy || !form.name} onClick={() => save(false)}>
          {busy ? "Saving…" : initial?.id ? "Save changes" : "Create booking"}
        </button>
        {isSchoolish && (
          <button className="btn-outline" type="button" disabled={aiBusy || !form.name} onClick={aiAutofill}>
            {aiBusy ? "Asking Gemini…" : "AI auto-fill from past visits"}
          </button>
        )}
      </div>
    </div>
  );
}
