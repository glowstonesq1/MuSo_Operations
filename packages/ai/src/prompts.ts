/** Prompt templates from spec Section 8. AI output is ALWAYS a suggestion —
 *  nothing returned here is saved without explicit user confirmation. */

export type AiFeature = "auto_fill" | "resolution" | "remarks" | "narrative";

export function autoFillPrompt(booking: {
  name: string;
  grade?: string | null;
  location?: string | null;
  booking_type: string;
}, pastBookingsJson: string): string {
  return `You are an operations assistant for Museum of Solutions (MuSo), a children's
museum in Mumbai run by JSW Foundation.

New booking:
- School: ${booking.name}
- Grade: ${booking.grade ?? "NA"}
- Location: ${booking.location ?? "NA"}
- Booking type: ${booking.booking_type}

Past bookings from the same school (or similar profile) — up to 5:
${pastBookingsJson}

Suggest values for these fields, based ONLY on patterns in the past data:
- kids_menu
- teachers_menu
- food_vendor
- orientation_time (HH:MM)
- exit_time (HH:MM)
- num_groups (integer)

Rules:
- Return JSON with exactly these six keys.
- If a field cannot be inferred from data, return null for that field.
- Do NOT invent values.
- Do NOT hallucinate menus that don't appear in past data.

Return only valid JSON, no prose.`;
}

export function narrativePrompt(movementPlanJson: string): string {
  return `Generate a movement plan description for a school visit to MuSo, addressed
to the visiting teacher.

Input JSON:
${movementPlanJson}

Requirements:
- 4 to 6 sentences.
- English only.
- Warm but factual tone.
- Mention group names (A/B/C), lab names, timings, and lunch slot.
- No emojis.
- No em dashes or long dashes.
- Do NOT use marketing language ("exciting", "immersive", "unforgettable").

Return only the description text, no preamble.`;
}

export function clashResolutionPrompt(clashJson: string, dayBookingsJson: string, availableResourcesJson: string): string {
  return `You are an ops assistant. A resource booking clash has been detected.

Clash details:
${clashJson}

Other bookings on this day:
${dayBookingsJson}

Available resources with their capacities and current bookings:
${availableResourcesJson}

Suggest 3 resolution options, ranked from least to most disruptive.
For each option, output:
- option: short label
- changes: what specifically changes (which bookings, which resources, which times)
- tradeoff: what is lost or delayed
- disruption_score: integer 1 (minimal) to 5 (major)

Rules:
- Do NOT suggest options that violate hard constraints
  (exceeding capacity, using closed floors, overlapping with fixed events).
- Prefer shifting time over changing resource.
- Prefer changing one booking over changing many.

Return JSON array of exactly 3 objects.`;
}

export function remarksPrompt(bookingJson: string, pastRemarksExamples: string): string {
  return `Draft a single-sentence remark for the ops team about this booking.

Booking context:
${bookingJson}

Focus on anything non-standard: partial floor access, pre/post assessments,
parent involvement, dietary requirements (Jain, vegetarian counts), workshops,
group special needs.

Style reference — match the tone of these past remarks:
${pastRemarksExamples}

Rules:
- One sentence only.
- No emojis, no em dashes.
- English or Hinglish, matching the input's language.
- Do NOT invent facts not in the booking context.
- If nothing non-standard exists, return empty string.

Return only the sentence text.`;
}
