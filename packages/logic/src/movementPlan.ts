import { addMinutes, toMinutes, toHM } from "./time";

/**
 * N-group rotation generator.
 *
 * Model (assumptions, stated per spec Section 3.4):
 * - num_groups always equals the number of labs used, so the rotation is a
 *   cyclic latin square: in session s, group g visits lab (g + s) mod n.
 *   Every group sees every lab exactly once in n sessions.
 * - Group sizes are children split as evenly as possible; the remainder goes
 *   to the earlier groups (A first).
 * - If children / defaultLabs.length exceeds the smallest lab capacity and an
 *   extra lab is available, the generator widens to 4 labs / 4 groups before
 *   reporting an overflow (Case 5).
 * - Timeline: sessions of sessionMinutes separated by switchMinutes, starting
 *   5 minutes after orientation ends; a lunch break is inserted after the
 *   session that ends closest to the requested lunch start.
 */

export interface Lab {
  id: string;
  name: string;
  capacity: number | null;
}

export interface PlanInput {
  children: number;
  slotStart: string; // "HH:MM"
  slotEnd: string;
  orientationTime?: string | null; // orientation START; sessions begin orientation + orientationMinutes + buffer
  orientationMinutes?: number; // default 15
  labs: Lab[]; // labs to rotate through (preferred order)
  extraLabs?: Lab[]; // labs that can be pulled in if capacity is short
  /** one number for equal sessions, or an array (per session slot) when a
   *  workshop session needs more time than the lab sessions */
  sessionMinutes?: number | number[]; // default 70
  switchMinutes?: number; // default 5
  lunchStart?: string | null; // preferred lunch start ("12:35"); null = no seated lunch
  lunchMinutes?: number; // default 60
  /** one-way walk to the lunch floor (3rd floor food court); added before AND after lunch */
  lunchTravelMinutes?: number; // default 0
}

export interface SessionAssignment {
  groupLabel: string;
  labId: string;
  labName: string;
  headcount: number;
}

export interface PlanSession {
  sessionNumber: number;
  fromTime: string;
  toTime: string;
  assignments: SessionAssignment[];
}

export type PlanWarningCode =
  | "capacity_exceeded" // Case 5 — group bigger than lab capacity
  | "overruns_slot" // sessions end after slot_end
  | "no_lunch_fit";

export interface PlanWarning {
  code: PlanWarningCode;
  message: string;
  /** for capacity_exceeded: the options offered to the user (Case 5 UX) */
  options?: string[];
}

export interface PlanResult {
  numGroups: number;
  groupSizes: { label: string; size: number }[];
  sessions: PlanSession[];
  lunch: { fromTime: string; toTime: string } | null;
  exitTime: string;
  warnings: PlanWarning[];
  labsUsed: Lab[];
}

const GROUP_LABELS = "ABCDEFGH".split("");

export function splitIntoGroups(children: number, numGroups: number): number[] {
  const base = Math.floor(children / numGroups);
  const rem = children % numGroups;
  return Array.from({ length: numGroups }, (_, i) => base + (i < rem ? 1 : 0));
}

export function generateMovementPlan(input: PlanInput): PlanResult {
  const switchMinutes = input.switchMinutes ?? 5;
  const lunchMinutes = input.lunchMinutes ?? 60;
  const lunchTravel = input.lunchTravelMinutes ?? 0;
  const orientationMinutes = input.orientationMinutes ?? 15;
  const warnings: PlanWarning[] = [];
  const sessionLen = (s: number): number =>
    Array.isArray(input.sessionMinutes)
      ? input.sessionMinutes[s] ?? input.sessionMinutes[input.sessionMinutes.length - 1] ?? 70
      : input.sessionMinutes ?? 70;

  // 1) pick labs / group count
  let labs = [...input.labs];
  const minCap = (ls: Lab[]) => Math.min(...ls.map((l) => l.capacity ?? Infinity));
  if (
    input.children / labs.length > minCap(labs) &&
    input.extraLabs &&
    input.extraLabs.length > 0
  ) {
    labs = [...labs, ...input.extraLabs.slice(0, 1)];
  }
  const numGroups = labs.length;
  const sizes = splitIntoGroups(input.children, numGroups);
  const groupSizes = sizes.map((size, i) => ({ label: GROUP_LABELS[i], size }));

  // Case 5 — capacity check per lab (every group visits every lab, so the
  // largest group vs the smallest lab is the binding constraint)
  const largest = Math.max(...sizes);
  for (const lab of labs) {
    if (lab.capacity != null && largest > lab.capacity) {
      warnings.push({
        code: "capacity_exceeded",
        message: `Group of ${largest} exceeds ${lab.name} capacity of ${lab.capacity}.`,
        options: [
          `Split the largest group into two sub-groups (needs an extra facilitator)`,
          `Reduce to ${numGroups - 1} rotations so each group skips one lab`,
          `Accept overflow at ${lab.name} (logged as a risk)`,
        ],
      });
    }
  }

  // 2) timeline
  const orientationStart = input.orientationTime ?? addMinutes(input.slotStart, 15);
  let cursor = addMinutes(orientationStart, orientationMinutes + 5); // 5 min to move to first lab
  const lunchTarget = input.lunchStart ? toMinutes(input.lunchStart) : null;
  let lunch: { fromTime: string; toTime: string } | null = null;

  const sessions: PlanSession[] = [];
  for (let s = 0; s < numGroups; s++) {
    // insert lunch before this session if the target time has been reached
    if (lunchTarget != null && lunch == null && toMinutes(cursor) + sessionLen(s) > lunchTarget + lunchMinutes / 2) {
      const lunchFrom = toHM(Math.max(toMinutes(cursor) + lunchTravel, lunchTarget));
      lunch = { fromTime: lunchFrom, toTime: addMinutes(lunchFrom, lunchMinutes) };
      cursor = addMinutes(lunch.toTime, lunchTravel + switchMinutes);
    }
    const from = cursor;
    const to = addMinutes(from, sessionLen(s));
    sessions.push({
      sessionNumber: s + 1,
      fromTime: from,
      toTime: to,
      // cyclic rotation: group g is at lab (g + s) mod n
      assignments: labs.map((lab, labIdx) => {
        const g = ((labIdx - s) % numGroups + numGroups) % numGroups;
        return {
          groupLabel: GROUP_LABELS[g],
          labId: lab.id,
          labName: lab.name,
          headcount: sizes[g],
        };
      }),
    });
    cursor = addMinutes(to, switchMinutes);
  }

  if (lunchTarget != null && lunch == null) {
    warnings.push({
      code: "no_lunch_fit",
      message: "Lunch window did not fit between sessions; schedule it manually.",
    });
  }

  const exitTime = sessions.length ? sessions[sessions.length - 1].toTime : input.slotStart;
  if (toMinutes(exitTime) > toMinutes(input.slotEnd) + 30) {
    const overrun = toMinutes(exitTime) - toMinutes(input.slotEnd);
    warnings.push({
      code: "overruns_slot",
      message: `Plan ends at ${exitTime}, ${overrun} min past the ${input.slotEnd} slot end. Shorten sessions to ~${maxSessionMinutes(input)} min or drop a rotation.`,
    });
  }

  return { numGroups, groupSizes, sessions, lunch, exitTime, warnings, labsUsed: labs };
}

/** Largest session length that fits n rotations + lunch inside the slot. */
export function maxSessionMinutes(input: PlanInput): number {
  const n = input.labs.length;
  const switchMinutes = input.switchMinutes ?? 5;
  const lunchMinutes = input.lunchStart ? input.lunchMinutes ?? 60 : 0;
  const orientationStart = input.orientationTime ?? addMinutes(input.slotStart, 15);
  const start = toMinutes(orientationStart) + (input.orientationMinutes ?? 15) + 5;
  const available = toMinutes(input.slotEnd) - start - lunchMinutes - switchMinutes * n;
  return Math.max(0, Math.floor(available / n));
}

/** Case 3 — shift every session (and lunch) by N minutes. */
export function shiftPlan(plan: PlanResult, minutes: number): PlanResult {
  return {
    ...plan,
    sessions: plan.sessions.map((s) => ({
      ...s,
      fromTime: addMinutes(s.fromTime, minutes),
      toTime: addMinutes(s.toTime, minutes),
    })),
    lunch: plan.lunch
      ? {
          fromTime: addMinutes(plan.lunch.fromTime, minutes),
          toTime: addMinutes(plan.lunch.toTime, minutes),
        }
      : null,
    exitTime: addMinutes(plan.exitTime, minutes),
  };
}

/** Case 4 — recompute group sizes for an actual headcount, keeping the grid. */
export function recalcHeadcounts(plan: PlanResult, actualChildren: number): PlanResult {
  const sizes = splitIntoGroups(actualChildren, plan.numGroups);
  const byLabel = new Map(sizes.map((s, i) => [GROUP_LABELS[i], s]));
  return {
    ...plan,
    groupSizes: plan.groupSizes.map((g) => ({ ...g, size: byLabel.get(g.label) ?? g.size })),
    sessions: plan.sessions.map((s) => ({
      ...s,
      assignments: s.assignments.map((a) => ({
        ...a,
        headcount: byLabel.get(a.groupLabel) ?? a.headcount,
      })),
    })),
  };
}
