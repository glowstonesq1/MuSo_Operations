# Think Before You Build — Decision Points (Section 3)

Posted before any code was written; implemented as described.

## 1. Row-per-slot vs date-with-children

**Decision: row-per-slot (each Morning/Afternoon/Evening column = one `bookings` row).**

- **Clash queries:** each row has its own `slot_start`/`slot_end`, so overlap checks and the
  `resource_bookings` EXCLUDE constraint stay one-level joins. A parent/child model would force
  every clash query through a join to children.
- **Reporting:** footfall/utilisation aggregates are plain `GROUP BY visit_date` — no unnesting.
- **Update semantics:** a delay to the Morning school must not touch the Evening CSR row.
  Row-per-slot isolates the cascade (Case 3) to a single row and its children.
- **Cost:** the multi-column FP sheet is a *presentation* concern — the PDF/day views group rows
  by `visit_date` at render time. A `day_slot` enum ('morning'/'afternoon'/'evening') preserves
  the column label from the reference sheets.

## 2. Slot vs time-range unification

`slot_start`/`slot_end TIME` are **always required** and are the single source of truth for
scheduling logic. Fixed public slots are a UI preset layer that fills the range and stamps
`slot_color`:

```
slot_start TIME NOT NULL,
slot_end   TIME NOT NULL,
slot_color slot_color NULL,  -- blue/green/purple/yellow: set => "this is a fixed public slot"
day_slot   day_slot NULL,    -- morning/afternoon/evening: FP column label
```

The distinction survives (colour set = fixed slot; null = arbitrary range) without a second
scheduling mechanism. Clash logic never needs to know which kind it is.

## 3. Resource-booking granularity

**One `resource_bookings` row per continuous occupancy** (Play Lab 10:05–11:15 for Group A is one
row; Group C 11:20–12:30 is another). This is exactly the shape `EXCLUDE USING gist
(resource_id WITH =, tstzrange(from_time, to_time) WITH &&)` wants: no sub-slot unpacking, the
5-minute switch gaps are honestly free time (a quick 11:16 walk-through by another group is
legitimately non-clashing), and deleting/regenerating a movement plan is a delete-by-booking_id.
A single row with sub-slots would make the constraint see phantom conflicts across the whole
10:05–2:50 span.

One deviation: `resources.is_exclusive` (denormalised into `resource_bookings.exclusive`, and the
constraint is `WHERE (exclusive)`) — Commons and the Food Court host several groups at once by
design and must not hard-clash.

## 4. N-group movement plan

**Assumptions (encoded in `packages/logic/src/movementPlan.ts`):**
- `num_groups == number of labs used` so the rotation is a cyclic latin square — every group
  visits every lab exactly once in N sessions. (In session s, group g is at lab (g+s) mod N.)
- Group sizes = children split evenly, remainder to earlier groups (211 → 71/70/70, matching the
  reference file).
- Timeline = orientation end + 5 min, then N sessions of 70 min separated by 5-min switches, with
  a 60-min lunch inserted at the session boundary nearest the requested lunch time.

**240 students:** prefer widening to a 4th lab (Grow Lab) → 4 groups of 60, because 3×80 breaches
the 70-person lab capacity. If no 4th lab is free, the generator returns a `capacity_exceeded`
warning with the three Case-5 options (split largest group / drop a rotation / accept overflow,
logged) and the user chooses — the tool never silently overflows a lab.

## 5. AI scope boundary

Confirmed and enforced in code: Gemini is used only for (a) auto-fill suggestions, (b) clash
resolution suggestions, (c) draft remarks, (d) movement-plan narrative. Every response is a
suggestion that pre-fills UI state and requires the user to press Save; nothing AI-generated is
written to the database directly. No PII is sent (bookings hold aggregate counts only). No
approval, authorisation or financial logic touches the AI path. Guardrails: response cache keyed
by `(feature, sha256(prompt))`, daily budget cap (`AI_DAILY_BUDGET_CALLS`, default 500) with
rule-based fallback, and every call logged to `ai_call_log` with token counts.

---

# Fields found in the reference files that were NOT in the Section-4 schema

From `FP_School_2nd_July_2026.xlsx` / `July_26-School_CSR_FP.xlsx`:
- **Duration** ("5 Hours", orange fill) — derived from slot range; computed at render, not stored.
- **Day-slot column header** (Morning / Afternoon / Evening) — added `bookings.day_slot`.
- **"List of Learner"** — student names. Excluded deliberately (PII rule); revisit after JSW clearance.
- Movement-plan **task rows** (Bus Deboarding & Parking, Transportation to Commons, Welcoming &
  Orientation, per-lab staffing, Lunch, Feedback & Exit — each with timing + person names) —
  added `movement_plan_tasks`.
- **School Summary Report sheet** (arrival/departure, orientation conducted-by & language,
  planned vs actual students, plan followed/revised, lunch as-per-plan, teacher/student feedback
  by floor/exhibit/facilitation/food, manager/staff observations, incidents) — rendered as the
  blank third section of the FP PDF in v0; a `visit_summaries` table is the v2 home for the data.

From `Birthday_Fp_July_04-07-26.csv`:
- Entry at Commons / Entry Inside Museum times → `entry_commons_time`, `entry_museum_time`
- Age group → `age_group`; Complimentary adults → `complimentary_adults`
- Welcome Service Commons → `welcome_service`; Welcome note → `welcome_note`
- Cake cutting **location** (6th Floor) → `cake_cutting_location`
- Photography Package/Tattoo → `photography_package`; Chef & Team → `chef_team`
- F&B Menu → `fnb_menu`; Decor Setup & Information → `decor_setup_info`
- **Kid Name** — excluded (PII rule).

From `Events_and_Experiences_FP (FBI Workshop).csv`:
- Event Location, Ticketing Platform, Setup instructions (internal/external), Partner &
  Partner PoC, Ideal ages, About the Event, Other Notes (T&C), setup team / returnable
  materials list → all added as columns (`event_location`, `ticketing_platform`,
  `setup_instructions_internal/external`, `partner_name`, `partner_poc`, `ideal_ages`,
  `about_event`, `other_notes`, `returnable_materials`).

From `Daily_Ops_2026-2027.xlsx`:
- Venue hours block (MuSo / Subko weekday / weekend, LiSo & Shop opening, shop POC) →
  `venue_day_settings` (per-date, defaults applied).
- Per-date floor POC roster (Ops POC, Birthday, Reception, Play/Discover/Make/Grow Lab) →
  `floor_poc_assignments`.
- Ticketed walk-in counts per slot (children/adults per 10 AM / 2 PM / 4 PM / Flexi) →
  `daily_visit_counts`.
- Contact extension table → `staff.extension` (seeded: 4001, 4066, 4079, 4083, 4091, 4093).
- Naming inconsistencies observed and handled: trailing spaces ("Aniket "), "NA" vs blank vs
  "N/A", "Vrushalo/Vrushali", "Rohan/Rohann", Excel time fractions vs strings ("9:30am to
  2:30pm"), inconsistent 12/24-hour mixes. The app stores canonical types (TIME, FKs to staff)
  so these cannot recur; `excelFractionToTime()` handles imports.

# Schema disagreements (changed vs the spec)

1. **`booking_history.booking_id ON DELETE CASCADE` contradicted acceptance test 5** ("history
   must retain the deletion event") — a cascade would wipe the audit trail with the booking.
   Changed to `ON DELETE SET NULL` + denormalised `booking_name`/`visit_date` + full snapshot in
   `before_data`. Tradeoff: orphaned history rows need their own retention policy eventually.
2. **Unconditional EXCLUDE constraint** would block Commons / Food Court sharing. Added
   `resources.is_exclusive` and made the constraint partial (`WHERE (exclusive)`), synced by
   trigger. Tradeoff: shared-space over-capacity is only a soft warning.
3. **No extensibility path** for new workshop formats. Added `bookings.custom_fields JSONB` +
   `custom_field_defs` (admin-editable field definitions per booking type, rendered dynamically
   in the form and FP PDFs). Tradeoff: JSONB values aren't strongly typed — acceptable for
   remarks-grade fields.
4. `staff.department` added — `department_head` RLS is impossible without knowing which
   department a user heads.
5. `incidents.delay_minutes` added — Case 3 needs the shift magnitude, not just free text.

# v0 estimates vs actual

| Feature | Est. LOC | Est. hours (human) | Shipped |
|---|---|---|---|
| Auth + roles + staff pages | ~600 | 10–14 | ✅ (email/pw + Google + Azure buttons, RLS, admin role editor) |
| Booking form (all types + custom fields) | ~900 | 16–20 | ✅ |
| School FP PDF | ~450 | 8–10 | ✅ (3 sections incl. summary template) |
| Movement plan generator | ~250 | 8–12 | ✅ (+14 unit tests) |
| Daily Memo view + PDF | ~600 | 10–12 | ✅ |
| Clash detection (6 cases) | ~700 | 14–18 | ✅ (DB constraint + API + UI panels) |
| History log | ~150 | 3–4 | ✅ (trigger-based) |
| WhatsApp copy | ~200 | 3–4 | ✅ |
| **Total v0** | **~3,900** | **~75–95 h** | ~5,300 LOC actual |
