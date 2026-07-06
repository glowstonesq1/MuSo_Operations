import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { fmt12h } from "@muso/logic";
import { styles, KV, Footer, na } from "./common";
import { XL } from "./theme";

/** Matches FP_School_2nd_July_2026.xlsx: main info sheet, movement plan sheet,
 *  summary report template sheet — as three sections. */

export interface SchoolFPProps {
  booking: any; // bookings row (joined with staff names)
  plan?: {
    numGroups: number;
    groupSizes: { label: string; size: number }[];
    sessions: { sessionNumber: number; fromTime: string; toTime: string; assignments: { groupLabel: string; labName: string; headcount: number }[] }[];
    lunch: { fromTime: string; toTime: string } | null;
    exitTime: string;
    tasks?: { task: string; timing_text: string | null; person_names: string | null }[];
  } | null;
  narrative?: string | null;
  customFieldDefs?: { field_key: string; label: string }[];
  dateLabel: string;
  dayColumnLabel?: string; // "Morning" | "Afternoon" | "Evening"
}

export function SchoolFP({ booking: b, plan, narrative, customFieldDefs, dateLabel, dayColumnLabel }: SchoolFPProps) {
  const total =
    (b.children_planned ?? 0) + (b.teachers_planned ?? 0) + (b.escorts_planned ?? 0);
  const slot = `${fmt12h(b.slot_start)} to ${fmt12h(b.slot_end)}`;
  return (
    <Document>
      {/* Section 1 — main info (mirrors the Description / Morning column layout) */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>School Floor Plan | {dateLabel}{dayColumnLabel ? ` | ${dayColumnLabel}` : ""}</Text>
        <KV label="Date of Visit" value={dateLabel} />
        <KV label="Slot" value={slot} />
        <KV label="Booking Type" value={b.booking_type === "school" ? "School" : b.booking_type} />
        <KV label="Name of School" value={b.name} valueBg={XL.schoolName} />
        <KV label="Location" value={b.location} />
        <KV label="POC from School" value={b.poc_external_name} />
        <KV label="Contact Number" value={b.poc_external_contact} />
        <KV label="Duration" value={durationLabel(b.slot_start, b.slot_end)} valueBg={XL.duration} />
        <KV label="POC from Operation" value={b.ops_poc_name} />
        <KV label="No. of Students" value={b.children_planned} />
        <KV label="No. of Teachers" value={b.teachers_planned} />
        <KV label="No. of Escorts" value={b.escorts_planned} />
        <KV label="Total" value={total} />
        <KV label="No. of Buses" value={b.buses} />
        <KV label="Grade" value={b.grade} />
        <KV label="MuSo Sales Representative" value={b.sales_rep_name} />
        <KV label="Travel Agent" value={b.travel_agent} />
        <KV label="POC from TA" value={b.poc_travel_agent} />
        <KV label="Contact Number" value={b.travel_agent_contact} />
        <KV label="Bus Reporting Time" value={fmt12h(b.bus_reporting_time)} />
        <KV label="Orientation Time" value={fmt12h(b.orientation_time)} />
        <KV label="Kids Food" value={b.kids_menu} />
        <KV label="Kids Lunch Time" value={fmt12h(b.kids_lunch_time)} />
        <KV label="Jain Kids" value={b.jain_kids || "NA"} />
        <KV label="Teachers Breakfast" value={fmt12h(b.teachers_breakfast_time)} />
        <KV label="Teachers Lunch" value={b.teachers_menu} />
        <KV label="Food Vendor" value={b.food_vendor} />
        <KV label="Food Location" value={b.food_location} />
        <KV label="Workshop Name" value={b.workshop_name} />
        <KV label="Workshop Details" value={b.workshop_details} />
        <KV label="Exit Time" value={fmt12h(b.exit_time)} />
        <KV label="Remarks" value={b.remarks} />
        {customFieldDefs?.map((def) => (
          <KV key={def.field_key} label={def.label} value={b.custom_fields?.[def.field_key]} />
        ))}
        <Footer />
      </Page>

      {/* Section 2 — movement plan grid */}
      <Page size="A4" style={styles.page}>
        <Text style={[styles.band, { backgroundColor: XL.sectionYellow }]}>{b.name} — Movement Plan</Text>
        {plan?.tasks?.length ? (
          <View style={{ marginTop: 6 }}>
            {plan.tasks.map((t, i) => (
              <View key={i} style={styles.row}>
                <Text style={[styles.cellLabel, { width: "34%" }]}>{t.task}</Text>
                <Text style={{ width: "30%", padding: 3 }}>{na(t.timing_text)}</Text>
                <Text style={{ width: "36%", padding: 3 }}>{na(t.person_names)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {plan ? (
          <>
            <View style={[styles.band, { backgroundColor: XL.groupsBox, marginTop: 10 }]}>
              <Text>
                Groups: {plan.numGroups} — {plan.groupSizes.map((g) => `${g.label}: ${g.size}`).join("   ")}
              </Text>
            </View>
            {plan.sessions.map((s, idx) => (
              <View key={s.sessionNumber} wrap={false}>
                {plan.lunch && idx > 0 && plan.sessions[idx - 1].toTime <= plan.lunch.fromTime && s.fromTime >= plan.lunch.toTime ? (
                  <Text style={[styles.band, { backgroundColor: XL.lunch }]}>
                    Lunch {fmt12h(plan.lunch.fromTime)} to {fmt12h(plan.lunch.toTime)}
                  </Text>
                ) : idx > 0 ? (
                  <Text style={[styles.band, { backgroundColor: XL.switch }]}>
                    Switch {fmt12h(plan.sessions[idx - 1].toTime)} to {fmt12h(s.fromTime)}
                  </Text>
                ) : null}
                <Text style={[styles.band, { backgroundColor: XL.sessionTime }]}>
                  {fmt12h(s.fromTime)} to {fmt12h(s.toTime)}
                </Text>
                <View style={styles.gridRow}>
                  {s.assignments.map((a) => (
                    <Text key={a.labName} style={[styles.gridCell, { backgroundColor: XL.labHeader, fontFamily: "Helvetica-Bold" }]}>
                      {a.labName}
                    </Text>
                  ))}
                </View>
                <View style={styles.gridRow}>
                  {s.assignments.map((a) => (
                    <Text key={a.labName} style={styles.gridCell}>
                      Group {a.groupLabel} ({a.headcount})
                    </Text>
                  ))}
                </View>
              </View>
            ))}
            <Text style={[styles.band, { backgroundColor: XL.sessionTime }]}>
              Exit {fmt12h(plan.exitTime)} onwards
            </Text>
          </>
        ) : (
          <Text style={{ marginTop: 10 }}>No movement plan generated.</Text>
        )}
        {narrative ? (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.h2}>For the visiting teacher</Text>
            <Text>{narrative}</Text>
          </View>
        ) : null}
        <Footer />
      </Page>

      {/* Section 3 — summary report template (filled in after the visit) */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>School / Group Visit Summary</Text>
        <KV label="Package" value={slot} valueBg="#FFE599" />
        <KV label="Name of School" value={b.name} valueBg={XL.schoolName} />
        {[
          ["Arrival Details", ["Arrival Time", "Early or Late Arrival", "Departure Time", "Action Taken for Early or Late Arrival"]],
          ["Orientation", ["Orientation Time Allocated", "Actual Time Duration Taken", "Students Orientation Conducted By & Language", "Teacher's Orientation Conducted By & Language"]],
          ["Students' Details", ["Planned Number of Students", "Actual Number of Students"]],
          ["Movement Plan", ["Movement Plan Followed", "Revised Movement Plan"]],
          ["Lunch Details", ["Lunch as per plan for Students", "Lunch as per plan for Teachers"]],
          ["Teachers Feedback", ["Floors", "Exhibits", "Facilitation", "Food"]],
          ["Students Feedback", ["Floors", "Exhibits", "Facilitation", "Food"]],
          ["MuSo Team Observation", ["Feedback from Managers", "Feedback from Staff"]],
          ["Incidents", [""]],
          ["Any Other Remark", [""]],
        ].map(([section, rows]) => (
          <View key={section as string}>
            <Text style={[styles.band, { backgroundColor: XL.sectionYellow, textAlign: "left" }]}>{section}</Text>
            {(rows as string[]).map((r, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.cellLabel}>{r}</Text>
                <Text style={styles.cellValue}> </Text>
              </View>
            ))}
          </View>
        ))}
        <Footer />
      </Page>
    </Document>
  );
}

function durationLabel(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  const h = Math.round((mins / 60) * 10) / 10;
  return `${h} Hours`;
}
