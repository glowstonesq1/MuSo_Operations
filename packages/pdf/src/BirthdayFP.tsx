import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { fmt12h } from "@muso/logic";
import { styles, Footer, na } from "./common";
import { TYPE_BADGES } from "./theme";

/** Matches Birthday_Fp_July_04-07-26.csv: rows are fields, one column per slot. */

export interface BirthdayFPProps {
  dateLabel: string;
  bookings: any[]; // birthday bookings for the day, ordered by slot_start
}

const ROWS: { label: string; value: (b: any) => string }[] = [
  { label: "Slot", value: (b) => `${fmt12h(b.slot_start)} - ${fmt12h(b.slot_end)}` },
  { label: "Host Name", value: (b) => na(b.name) },
  { label: "Entry at Commons", value: (b) => fmt12h(b.entry_commons_time) },
  { label: "Age Group", value: (b) => na(b.age_group) },
  { label: "Entry Inside Museum", value: (b) => fmt12h(b.entry_museum_time) },
  { label: "Orientation", value: (b) => na(b.welcome_service === "NA" ? "Commons" : "Commons") },
  { label: "Welcome Service Commons", value: (b) => na(b.welcome_service) },
  {
    label: "Cake Cutting & Food",
    value: (b) =>
      b.cake_cutting_start
        ? `${fmt12h(b.cake_cutting_start)} - ${fmt12h(b.cake_cutting_end)} (${na(b.cake_cutting_location)})`
        : "NA",
  },
  { label: "# Children", value: (b) => na(b.children_planned) },
  { label: "# Adults", value: (b) => na(b.adults_planned) },
  { label: "Total", value: (b) => String((b.children_planned ?? 0) + (b.adults_planned ?? 0)) },
  { label: "Complimentary Adults", value: (b) => na(b.complimentary_adults || "NA") },
  { label: "Entry Band Color", value: (b) => na(b.entry_band_color) },
  { label: "Welcome Note", value: (b) => na(b.welcome_note) },
  { label: "Decor", value: (b) => na(b.decor_type) },
  { label: "Photography Package/Tattoo", value: (b) => na(b.photography_package) },
  { label: "F&B Menu", value: (b) => na(b.fnb_menu) },
  { label: "Decor Setup & Information", value: (b) => na(b.decor_setup_info) },
  { label: "Chef & Team", value: (b) => na(b.chef_team) },
  { label: "Remark", value: (b) => na(b.remarks) },
];

export function BirthdayFP({ dateLabel, bookings }: BirthdayFPProps) {
  const ordinals = ["1st Slot", "2nd Slot", "3rd Slot", "4th Slot"];
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={[styles.h1, { color: TYPE_BADGES.birthday }]}>
          Birthday Floor Plan | {dateLabel}
        </Text>
        <View style={styles.gridRow}>
          <Text style={[styles.gridCell, { flex: 1.4, backgroundColor: "#f5f5f5", fontFamily: "Helvetica-Bold" }]}> </Text>
          {bookings.map((b, i) => (
            <Text key={b.id} style={[styles.gridCell, { backgroundColor: TYPE_BADGES.birthday, color: "#fff", fontFamily: "Helvetica-Bold" }]}>
              {dateLabel} ({ordinals[i] ?? `${i + 1}th Slot`})
            </Text>
          ))}
        </View>
        {ROWS.map((row) => (
          <View key={row.label} style={styles.gridRow}>
            <Text style={[styles.gridCell, { flex: 1.4, textAlign: "left", backgroundColor: "#f5f5f5", fontFamily: "Helvetica-Bold" }]}>
              {row.label}
            </Text>
            {bookings.map((b) => (
              <Text key={b.id} style={styles.gridCell}>
                {row.value(b)}
              </Text>
            ))}
          </View>
        ))}
        <Footer />
      </Page>
    </Document>
  );
}
