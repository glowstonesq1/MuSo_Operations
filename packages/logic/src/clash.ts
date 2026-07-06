import { overlaps } from "./time";

/** Case 2 — staff overload: more than `limit` overlapping assignments. */
export interface StaffWindow {
  staffId: string;
  staffName: string;
  bookingId: string;
  bookingName: string;
  slotStart: string;
  slotEnd: string;
}

export interface StaffOverload {
  staffId: string;
  staffName: string;
  count: number;
  bookings: { bookingId: string; bookingName: string }[];
}

export function detectStaffOverload(
  windows: StaffWindow[],
  candidate: StaffWindow,
  limit = 2
): StaffOverload | null {
  const overlapping = windows.filter(
    (w) =>
      w.staffId === candidate.staffId &&
      w.bookingId !== candidate.bookingId &&
      overlaps(w.slotStart, w.slotEnd, candidate.slotStart, candidate.slotEnd)
  );
  if (overlapping.length + 1 > limit) {
    return {
      staffId: candidate.staffId,
      staffName: candidate.staffName,
      count: overlapping.length + 1,
      bookings: overlapping.map((w) => ({ bookingId: w.bookingId, bookingName: w.bookingName })),
    };
  }
  return null;
}

/** Case 6 — vendor aggregation across a day. */
export interface VendorOrder {
  bookingId: string;
  bookingName: string;
  vendor: string;
  headcount: number;
}

export interface VendorLoad {
  vendor: string;
  totalHeadcount: number;
  bookingCount: number;
  bookings: VendorOrder[];
  exceedsThreshold: boolean;
  threshold: number;
}

export function aggregateVendorLoad(
  orders: VendorOrder[],
  thresholds: Record<string, number>,
  defaultThreshold = 400
): VendorLoad[] {
  const byVendor = new Map<string, VendorOrder[]>();
  for (const o of orders) {
    if (!o.vendor || o.vendor.trim().toUpperCase() === "NA") continue;
    const key = o.vendor.trim();
    byVendor.set(key, [...(byVendor.get(key) ?? []), o]);
  }
  return [...byVendor.entries()].map(([vendor, list]) => {
    const total = list.reduce((s, o) => s + o.headcount, 0);
    const threshold = thresholds[vendor] ?? defaultThreshold;
    return {
      vendor,
      totalHeadcount: total,
      bookingCount: list.length,
      bookings: list,
      exceedsThreshold: total > threshold,
      threshold,
    };
  });
}

/** Case 4 — headcount drop trigger: actual < 90% of planned. */
export function headcountDropped(planned: number, actual: number | null | undefined): boolean {
  if (actual == null || planned <= 0) return false;
  return actual < planned * 0.9;
}

/** Parse the Postgres exclusion-violation message into something helpful. */
export function isExclusionViolation(message: string | null | undefined): boolean {
  return !!message && (message.includes("no_resource_clash") || message.includes("23P01"));
}
