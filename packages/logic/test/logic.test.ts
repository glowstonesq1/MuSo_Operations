import { describe, expect, it } from "vitest";
import {
  excelFractionToTime,
  fmt12h,
  overlaps,
  generateMovementPlan,
  recalcHeadcounts,
  shiftPlan,
  splitIntoGroups,
  detectStaffOverload,
  aggregateVendorLoad,
  headcountDropped,
  schoolFPWhatsApp,
} from "../src";

const LABS = [
  { id: "1", name: "Play Lab", capacity: 70 },
  { id: "2", name: "Discover Lab", capacity: 70 },
  { id: "3", name: "Make Lab", capacity: 70 },
];

describe("time", () => {
  it("converts Excel fractions (0.395833 = 9:30 AM)", () => {
    expect(excelFractionToTime(0.395833)).toBe("09:30");
    expect(excelFractionToTime(0.5)).toBe("12:00");
  });
  it("formats 12-hour", () => {
    expect(fmt12h("09:30")).toBe("9:30 AM");
    expect(fmt12h("14:50")).toBe("2:50 PM");
    expect(fmt12h("00:05")).toBe("12:05 AM");
    expect(fmt12h(null)).toBe("NA");
  });
  it("detects overlap on half-open ranges", () => {
    expect(overlaps("10:00", "11:00", "10:59", "12:00")).toBe(true);
    expect(overlaps("10:00", "11:00", "11:00", "12:00")).toBe(false);
  });
});

describe("movement plan generator", () => {
  // Reference: Singhania 2nd July — 211 kids, 9:30-14:30, orientation 9:45,
  // lunch ~12:35, three labs, 70-minute sessions, 5-minute switches.
  const input = {
    children: 211,
    slotStart: "09:30",
    slotEnd: "14:30",
    orientationTime: "09:45",
    labs: LABS,
    lunchStart: "12:35",
  };

  it("reproduces the reference 3x70 rotation", () => {
    const plan = generateMovementPlan(input);
    expect(plan.numGroups).toBe(3);
    expect(plan.groupSizes.map((g) => g.size)).toEqual([71, 70, 70]);
    expect(plan.sessions).toHaveLength(3);
    expect(plan.sessions[0].fromTime).toBe("10:05");
    expect(plan.sessions[0].toTime).toBe("11:15");
    expect(plan.sessions[1].fromTime).toBe("11:20");
    expect(plan.sessions[1].toTime).toBe("12:30");
    // lunch after session 2, then session 3
    expect(plan.lunch).toEqual({ fromTime: "12:35", toTime: "13:35" });
    expect(plan.sessions[2].fromTime).toBe("13:40");
    expect(plan.sessions[2].toTime).toBe("14:50");
  });

  it("gives every group every lab exactly once", () => {
    const plan = generateMovementPlan(input);
    for (const label of ["A", "B", "C"]) {
      const labsVisited = plan.sessions.map(
        (s) => s.assignments.find((a) => a.groupLabel === label)!.labName
      );
      expect(new Set(labsVisited).size).toBe(3);
    }
    // no lab hosts two groups in one session
    for (const s of plan.sessions) {
      expect(new Set(s.assignments.map((a) => a.labId)).size).toBe(3);
    }
  });

  it("240 students: widens to a 4th lab when available", () => {
    const plan = generateMovementPlan({
      ...input,
      children: 240,
      extraLabs: [{ id: "4", name: "Grow Lab", capacity: 70 }],
    });
    expect(plan.numGroups).toBe(4);
    expect(plan.groupSizes.map((g) => g.size)).toEqual([60, 60, 60, 60]);
    expect(plan.warnings.find((w) => w.code === "capacity_exceeded")).toBeUndefined();
  });

  it("240 students, no extra lab: reports Case 5 overflow with options", () => {
    const plan = generateMovementPlan({ ...input, children: 240 });
    const w = plan.warnings.find((w) => w.code === "capacity_exceeded");
    expect(w).toBeDefined();
    expect(w!.options).toHaveLength(3);
  });

  it("Case 4: recalculates 3x50 when actual drops to 150", () => {
    const plan = generateMovementPlan({ ...input, children: 210 });
    const revised = recalcHeadcounts(plan, 150);
    expect(revised.groupSizes.map((g) => g.size)).toEqual([50, 50, 50]);
    expect(revised.sessions[0].assignments.every((a) => a.headcount === 50)).toBe(true);
  });

  it("Case 3: shifts the whole plan by a delay", () => {
    const plan = generateMovementPlan(input);
    const shifted = shiftPlan(plan, 30);
    expect(shifted.sessions[0].fromTime).toBe("10:35");
    expect(shifted.lunch!.fromTime).toBe("13:05");
    expect(shifted.exitTime).toBe("15:20");
  });

  it("places lunch at the start when lunchAfterSession = 0", () => {
    const plan = generateMovementPlan({ ...input, lunchAfterSession: 0 });
    // orientation 9:45 + 15 + 5 = 10:05, lunch first, then sessions
    expect(plan.lunch!.fromTime).toBe("10:05");
    expect(plan.sessions[0].fromTime > plan.lunch!.toTime).toBe(true);
  });

  it("places lunch between S2 and S3 when lunchAfterSession = 2", () => {
    const plan = generateMovementPlan({ ...input, lunchAfterSession: 2 });
    expect(plan.lunch!.fromTime >= plan.sessions[1].toTime).toBe(true);
    expect(plan.sessions[2].fromTime >= plan.lunch!.toTime).toBe(true);
  });

  it("places lunch after the last session when lunchAfterSession = numGroups", () => {
    const plan = generateMovementPlan({ ...input, lunchAfterSession: 3 });
    expect(plan.lunch!.fromTime >= plan.sessions[2].toTime).toBe(true);
    expect(plan.exitTime).toBe(plan.lunch!.toTime);
  });

  it("adds travel buffer around a seated lunch", () => {
    const withTravel = generateMovementPlan({ ...input, lunchAfterSession: 2, lunchTravelMinutes: 10 });
    const without = generateMovementPlan({ ...input, lunchAfterSession: 2 });
    // 10 min before + 10 min after = session 3 starts 20 min later
    const diff =
      (Number(withTravel.sessions[2].fromTime.slice(0, 2)) * 60 + Number(withTravel.sessions[2].fromTime.slice(3))) -
      (Number(without.sessions[2].fromTime.slice(0, 2)) * 60 + Number(without.sessions[2].fromTime.slice(3)));
    expect(diff).toBe(20);
  });

  it("supports per-session durations (workshop slot longer)", () => {
    const plan = generateMovementPlan({ ...input, sessionMinutes: [70, 90, 70], lunchStart: null });
    const dur = (s: any) =>
      Number(s.toTime.slice(0, 2)) * 60 + Number(s.toTime.slice(3)) -
      (Number(s.fromTime.slice(0, 2)) * 60 + Number(s.fromTime.slice(3)));
    expect(dur(plan.sessions[0])).toBe(70);
    expect(dur(plan.sessions[1])).toBe(90);
    expect(dur(plan.sessions[2])).toBe(70);
  });

  it("splits remainders to earlier groups", () => {
    expect(splitIntoGroups(211, 3)).toEqual([71, 70, 70]);
    expect(splitIntoGroups(150, 3)).toEqual([50, 50, 50]);
  });
});

describe("clash helpers", () => {
  it("Case 2: flags a third overlapping assignment", () => {
    const windows = [
      { staffId: "s1", staffName: "Aniket", bookingId: "b1", bookingName: "School A", slotStart: "09:30", slotEnd: "14:30" },
      { staffId: "s1", staffName: "Aniket", bookingId: "b2", bookingName: "Birthday", slotStart: "10:00", slotEnd: "14:00" },
    ];
    const candidate = { staffId: "s1", staffName: "Aniket", bookingId: "b3", bookingName: "Workshop", slotStart: "11:00", slotEnd: "13:00" };
    const overload = detectStaffOverload(windows, candidate);
    expect(overload).not.toBeNull();
    expect(overload!.count).toBe(3);
  });

  it("Case 6: aggregates vendor load and flags threshold", () => {
    const loads = aggregateVendorLoad(
      [
        { bookingId: "1", bookingName: "A", vendor: "Urban Pantry", headcount: 230 },
        { bookingId: "2", bookingName: "B", vendor: "Urban Pantry", headcount: 150 },
        { bookingId: "3", bookingName: "C", vendor: "Urban Pantry", headcount: 100 },
        { bookingId: "4", bookingName: "D", vendor: "NA", headcount: 50 },
      ],
      { "Urban Pantry": 400 }
    );
    expect(loads).toHaveLength(1);
    expect(loads[0].totalHeadcount).toBe(480);
    expect(loads[0].exceedsThreshold).toBe(true);
  });

  it("Case 4 trigger fires below 90%", () => {
    expect(headcountDropped(210, 150)).toBe(true);
    expect(headcountDropped(210, 200)).toBe(false);
    expect(headcountDropped(210, null)).toBe(false);
  });
});

describe("whatsapp formatting", () => {
  it("is plain text with --- separators and no emojis", () => {
    const txt = schoolFPWhatsApp({
      name: "Singhania School",
      visitDate: "2nd July 2026",
      slot: "9:30 AM to 2:30 PM",
      bookingType: "School",
      students: 211,
      teachers: 20,
      escorts: 10,
      buses: 5,
      grade: "3",
    });
    expect(txt).toContain("---");
    expect(txt).toContain("Singhania School");
    expect(txt).toContain("Total");
    expect(txt).toMatch(/Students\s+: 211/);
    expect(/\p{Extended_Pictographic}/u.test(txt)).toBe(false);
  });
});
