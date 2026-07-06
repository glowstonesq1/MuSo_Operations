/** Time helpers. DB stores Postgres TIME ("HH:MM" / "HH:MM:SS"); UI shows 12-hour. */

/** Excel stores times as fractions of a day (0.395833 = 9:30 AM). Import-only. */
export function excelFractionToTime(f: number): string {
  const totalMinutes = Math.round(24 * 60 * f);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** "HH:MM" or "HH:MM:SS" -> minutes since midnight */
export function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** minutes since midnight -> "HH:MM" (24h) */
export function toHM(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "HH:MM[:SS]" -> "9:30 AM" */
export function fmt12h(t: string | null | undefined): string {
  if (!t) return "NA";
  const mins = toMinutes(t);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function addMinutes(t: string, delta: number): string {
  return toHM(toMinutes(t) + delta);
}

/** [aStart,aEnd) overlaps [bStart,bEnd) — all "HH:MM" */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}
