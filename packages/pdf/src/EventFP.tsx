import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { fmt12h } from "@muso/logic";
import { styles, KV, Footer, na } from "./common";
import { TYPE_BADGES } from "./theme";

/** Matches Events_and_Experiences_FP (FBI Workshop): event details +
 *  department-wise ops asks with MuSo POC column. */

export interface EventFPProps {
  dateLabel: string;
  booking: any;
  asks: { department: string; asks_text: string; poc_name?: string | null }[];
  customFieldDefs?: { field_key: string; label: string }[];
}

const DEPT_LABELS: Record<string, string> = {
  housekeeping: "Ops support required from HK",
  it: "Ops support required from IT",
  front_desk: "Ops support required from Front Desk",
  security: "Ops support required from Security",
  technical: "Ops support required from Technical",
  fnb: "Ops support required from F&B",
  ops: "Ops support required from Ops",
  visitor_experience: "Ops support required from Visitor Experience",
};

export function EventFP({ dateLabel, booking: b, asks, customFieldDefs }: EventFPProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={[styles.h1, { color: TYPE_BADGES.workshop }]}>
          Events & Experiences Floor Plan | {dateLabel}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.cellLabel, { width: "30%" }]}> </Text>
          <Text style={[styles.cellValue, { width: "50%", fontFamily: "Helvetica-Bold" }]}>Details</Text>
          <Text style={{ width: "20%", padding: 3, fontFamily: "Helvetica-Bold" }}>MuSo POC</Text>
        </View>
        <KV label="Event Name" value={b.name} />
        <KV label="Event Date" value={dateLabel} />
        <KV label="Event Time" value={`${fmt12h(b.slot_start)} to ${fmt12h(b.slot_end)}`} />
        <KV label="Event Location" value={b.event_location} />
        <KV label="Type of Event" value={[b.is_ticketed ? "Ticketed" : "Free", b.partner_name ? `Collaboration (${b.partner_name})` : null].filter(Boolean).join(", ")} />
        <KV label="Ticketed (Cost) / Free (RSVP)" value={b.is_ticketed ? `${na(b.ticket_price)} (+ GST)` : "Free (RSVP)"} />
        <KV label="Ticketing Platform" value={b.ticketing_platform} />
        <KV label="Event Set up Instructions for Internal Teams" value={b.setup_instructions_internal} />
        <KV label="Event Set up Instructions for External Teams" value={b.setup_instructions_external} />
        <KV label="MuSo PoC" value={b.ops_poc_name} />
        <KV label="Partner / Collaboration PoC" value={b.partner_poc} />
        <KV label="Ideal for ages to attend" value={b.ideal_ages} />
        <KV label="Expected No. Visitors (Adults and Children)" value={`${(b.children_planned ?? 0) + (b.adults_planned ?? 0)} approx`} />
        <KV label="About the Event" value={b.about_event} />

        <Text style={styles.h2}>Department Ops Asks</Text>
        {asks.map((a, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.cellLabel, { width: "30%" }]}>{DEPT_LABELS[a.department] ?? a.department}</Text>
            <Text style={[styles.cellValue, { width: "50%" }]}>{na(a.asks_text)}</Text>
            <Text style={{ width: "20%", padding: 3 }}>{na(a.poc_name)}</Text>
          </View>
        ))}

        <KV label="Other Notes" value={b.other_notes} />
        <KV label="List of set up team and returnable material - External Team" value={b.returnable_materials} />
        {customFieldDefs?.map((def) => (
          <KV key={def.field_key} label={def.label} value={b.custom_fields?.[def.field_key]} />
        ))}
        <Footer />
      </Page>
    </Document>
  );
}
