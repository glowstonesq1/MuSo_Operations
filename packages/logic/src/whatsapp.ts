import { fmt12h } from "./time";
import type { PlanResult } from "./movementPlan";

/**
 * "Copy as WhatsApp message" formatters.
 * Plain text, no emojis, space-aligned columns (monospace friendly),
 * section separators using ---.
 */

const NA = (v: unknown) => (v === null || v === undefined || v === "" ? "NA" : String(v));

function kv(label: string, value: unknown, width = 22): string {
  return `${label.padEnd(width)}: ${NA(value)}`;
}

export interface SchoolFPData {
  name: string;
  visitDate: string; // display string e.g. "2nd July 2026"
  slot: string; // "9:30 AM to 2:30 PM"
  bookingType: string;
  location?: string | null;
  pocExternal?: string | null;
  opsPoc?: string | null;
  salesRep?: string | null;
  students: number;
  teachers: number;
  escorts: number;
  buses: number;
  grade?: string | null;
  jainKids?: number | null;
  travelAgent?: string | null;
  pocTravelAgent?: string | null;
  busReportingTime?: string | null;
  orientationTime?: string | null;
  kidsMenu?: string | null;
  kidsLunchTime?: string | null;
  teachersBreakfastTime?: string | null;
  teachersMenu?: string | null;
  foodVendor?: string | null;
  foodLocation?: string | null;
  exitTime?: string | null;
  remarks?: string | null;
}

export function schoolFPWhatsApp(d: SchoolFPData, plan?: PlanResult | null): string {
  const lines: string[] = [];
  lines.push(`SCHOOL FLOOR PLAN | ${d.visitDate}`);
  lines.push("---");
  lines.push(kv("School", d.name));
  lines.push(kv("Location", d.location));
  lines.push(kv("Slot", d.slot));
  lines.push(kv("Booking Type", d.bookingType));
  lines.push(kv("Ops POC", d.opsPoc));
  lines.push(kv("Sales Rep", d.salesRep));
  lines.push("---");
  lines.push(kv("Students", d.students));
  lines.push(kv("Teachers", d.teachers));
  lines.push(kv("Escorts", d.escorts));
  lines.push(kv("Total", d.students + d.teachers + d.escorts));
  lines.push(kv("Buses", d.buses));
  lines.push(kv("Grade", d.grade));
  lines.push(kv("Jain Kids", d.jainKids));
  lines.push("---");
  lines.push(kv("Bus Reporting", fmt12h(d.busReportingTime)));
  lines.push(kv("Orientation", fmt12h(d.orientationTime)));
  lines.push(kv("Kids Lunch", fmt12h(d.kidsLunchTime)));
  lines.push(kv("Teachers Breakfast", fmt12h(d.teachersBreakfastTime)));
  lines.push(kv("Exit", fmt12h(d.exitTime)));
  lines.push("---");
  lines.push(kv("Kids Food", d.kidsMenu));
  lines.push(kv("Teachers Food", d.teachersMenu));
  lines.push(kv("Food Vendor", d.foodVendor));
  lines.push(kv("Food Location", d.foodLocation));
  if (plan) {
    lines.push("---");
    lines.push(`MOVEMENT PLAN (${plan.numGroups} groups: ${plan.groupSizes.map((g) => `${g.label}-${g.size}`).join(", ")})`);
    for (const s of plan.sessions) {
      lines.push(`Session ${s.sessionNumber}  ${fmt12h(s.fromTime)} to ${fmt12h(s.toTime)}`);
      for (const a of s.assignments) {
        lines.push(`  ${a.labName.padEnd(14)} Group ${a.groupLabel} (${a.headcount})`);
      }
    }
    if (plan.lunch) lines.push(`Lunch      ${fmt12h(plan.lunch.fromTime)} to ${fmt12h(plan.lunch.toTime)}`);
    lines.push(`Exit       ${fmt12h(plan.exitTime)} onwards`);
  }
  if (d.remarks) {
    lines.push("---");
    lines.push(`Remarks: ${d.remarks}`);
  }
  return lines.join("\n");
}

export interface MemoBookingRow {
  type: string;
  name: string;
  timing: string;
  opsPoc: string;
  total: number;
}

export interface DailyMemoData {
  dateLabel: string; // "04/07/2026, Saturday"
  musoHours: string;
  bookings: MemoBookingRow[];
  floorPocs: { role: string; names: string }[];
  slotCounts: { slot: string; children: number; adults: number }[];
  contacts: { name: string; extension: string }[];
}

export function dailyMemoWhatsApp(d: DailyMemoData): string {
  const lines: string[] = [];
  lines.push(`DAILY MEMO | ${d.dateLabel}`);
  lines.push(`MuSo hours: ${d.musoHours}`);
  lines.push("---");
  lines.push("TODAY AT MUSO");
  for (const b of d.bookings) {
    lines.push(`${b.type.padEnd(12)} ${b.name}`);
    lines.push(`${"".padEnd(12)} ${b.timing} | POC ${b.opsPoc} | Total ${b.total || "NA"}`);
  }
  if (d.floorPocs.length) {
    lines.push("---");
    lines.push("FLOOR POCs");
    for (const p of d.floorPocs) lines.push(`${p.role.padEnd(14)} ${p.names}`);
  }
  if (d.slotCounts.length) {
    lines.push("---");
    lines.push("TICKETED VISITORS");
    lines.push(`${"Slot".padEnd(12)} ${"Children".padEnd(9)} Adults`);
    for (const s of d.slotCounts)
      lines.push(`${s.slot.padEnd(12)} ${String(s.children).padEnd(9)} ${s.adults}`);
  }
  if (d.contacts.length) {
    lines.push("---");
    lines.push("CONTACTS");
    for (const c of d.contacts) lines.push(`${c.name.padEnd(18)} ext ${c.extension}`);
  }
  return lines.join("\n");
}

export interface DeptBriefAsk {
  bookingName: string;
  timing: string;
  asksText: string;
  poc?: string | null;
  status?: string | null;
}

export function deptBriefWhatsApp(dept: string, dateLabel: string, asks: DeptBriefAsk[]): string {
  const lines: string[] = [];
  lines.push(`${dept.toUpperCase()} BRIEF | ${dateLabel}`);
  lines.push("---");
  if (!asks.length) lines.push("No asks for today.");
  for (const a of asks) {
    lines.push(`${a.bookingName} (${a.timing})`);
    lines.push(`  Ask: ${a.asksText}`);
    if (a.poc) lines.push(`  POC: ${a.poc}`);
    lines.push("---");
  }
  return lines.join("\n");
}
