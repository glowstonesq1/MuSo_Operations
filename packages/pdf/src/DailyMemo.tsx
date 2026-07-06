import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { fmt12h } from "@muso/logic";
import { styles, Footer, na } from "./common";
import { SLOT_COLORS, TYPE_BADGES, TYPE_LABELS, XL } from "./theme";

/** Matches Daily_Ops_2026-2027.xlsx: header with hours + colour-coded slots,
 *  per-type booking columns, visitor counts, floor POCs, contact extensions. */

export interface DailyMemoProps {
  dateLabel: string; // "04/07/2026, Saturday"
  settings: {
    muso_hours: string;
    subko_weekday_hours: string;
    subko_weekend_hours: string;
    liso_open: string;
    shop_open: string;
    shop_poc: string | null;
    slot_1: string;
    slot_2: string;
    slot_3: string;
  };
  bookings: any[];
  floorPocs: { floor_role: string; staff_names: string }[];
  visitCounts: { slot_label: string; children: number; adults: number }[];
  contacts: { name: string; extension: string | null }[];
}

const SLOT_ROWS: [string, keyof typeof SLOT_COLORS][] = [];

export function DailyMemo({ dateLabel, settings: s, bookings, floorPocs, visitCounts, contacts }: DailyMemoProps) {
  const groups: Record<string, any[]> = {};
  for (const b of bookings) {
    const key = b.booking_type.startsWith("csr") ? "csr" : b.booking_type;
    (groups[key] ??= []).push(b);
  }
  const slotBand = (time: string, color: string, label: string) => (
    <View key={label} style={[styles.gridRow]}>
      <Text style={[styles.gridCell, { backgroundColor: color, color: "#fff", fontFamily: "Helvetica-Bold" }]}>
        {label}
      </Text>
      <Text style={styles.gridCell}>{time}</Text>
    </View>
  );
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>DAILY MEMO | {dateLabel}</Text>
        <Text style={[styles.band, { backgroundColor: XL.memoHeader, textAlign: "left" }]}>
          Visitor Experience & Operations — What's on! at MuSo
        </Text>

        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={{ width: "55%", paddingRight: 8 }}>
            <Text>MuSo: {s.muso_hours}</Text>
            <Text>Subko Weekdays: {s.subko_weekday_hours}</Text>
            <Text>Subko Weekends: {s.subko_weekend_hours}</Text>
            <Text>LiSo: {s.liso_open}   Shop: {s.shop_open} {s.shop_poc ? `(${s.shop_poc})` : ""}</Text>
          </View>
          <View style={{ width: "45%" }}>
            {slotBand(fmt12h(s.slot_1), SLOT_COLORS.blue, "Slot 1")}
            {slotBand(fmt12h(s.slot_2), SLOT_COLORS.green, "Slot 2")}
            {slotBand(fmt12h(s.slot_3), SLOT_COLORS.purple, "Slot 3")}
            {slotBand("Anytime", SLOT_COLORS.yellow, "Flexi Pass")}
          </View>
        </View>

        <Text style={[styles.band, { backgroundColor: XL.memoSubHeader, textAlign: "left", marginTop: 8 }]}>
          Today's Bookings
        </Text>
        {Object.entries(groups).map(([type, list]) => (
          <View key={type} style={{ marginTop: 4 }}>
            <Text style={{ backgroundColor: TYPE_BADGES[type] ?? "#475569", color: "#fff", padding: 3, fontFamily: "Helvetica-Bold" }}>
              {TYPE_LABELS[type] ?? (type === "csr" ? "CSR" : type)}
            </Text>
            <View style={styles.gridRow}>
              {["Name", "Paid/Free", "Timing", "Ops POC", "Total"].map((h) => (
                <Text key={h} style={[styles.gridCell, { backgroundColor: XL.memoCell, fontFamily: "Helvetica-Bold" }]}>{h}</Text>
              ))}
            </View>
            {list.map((b) => (
              <View key={b.id} style={styles.gridRow}>
                <Text style={styles.gridCell}>{b.name}</Text>
                <Text style={styles.gridCell}>{b.is_ticketed || b.ticket_price ? "Paid" : b.booking_type.startsWith("csr") ? "Sponsored" : "Paid"}</Text>
                <Text style={styles.gridCell}>{fmt12h(b.slot_start)} to {fmt12h(b.slot_end)}</Text>
                <Text style={styles.gridCell}>{na(b.ops_poc_name)}</Text>
                <Text style={styles.gridCell}>
                  {(b.children_planned ?? 0) + (b.adults_planned ?? 0) + (b.teachers_planned ?? 0) + (b.escorts_planned ?? 0) || "NA"}
                </Text>
              </View>
            ))}
          </View>
        ))}

        <View style={{ flexDirection: "row", marginTop: 8 }}>
          <View style={{ width: "50%", paddingRight: 6 }}>
            <Text style={[styles.band, { backgroundColor: XL.memoSubHeader, textAlign: "left" }]}>Visitor Experience POC</Text>
            {floorPocs.map((p) => (
              <View key={p.floor_role} style={styles.row}>
                <Text style={[styles.cellLabel, { width: "45%" }]}>{p.floor_role}</Text>
                <Text style={[styles.cellValue, { width: "55%" }]}>{p.staff_names}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: "50%" }}>
            <Text style={[styles.band, { backgroundColor: XL.memoSubHeader, textAlign: "left" }]}>Museum Visitors (Ticketed)</Text>
            <View style={styles.gridRow}>
              {["Slot", "Children", "Adults"].map((h) => (
                <Text key={h} style={[styles.gridCell, { backgroundColor: XL.memoCell, fontFamily: "Helvetica-Bold" }]}>{h}</Text>
              ))}
            </View>
            {visitCounts.map((v) => {
              const color =
                v.slot_label === "Flexi Pass" ? SLOT_COLORS.yellow :
                v.slot_label <= "12:00" ? SLOT_COLORS.blue :
                v.slot_label < "15:00" ? SLOT_COLORS.green : SLOT_COLORS.purple;
              return (
                <View key={v.slot_label} style={styles.gridRow}>
                  <Text style={[styles.gridCell, { backgroundColor: color, color: "#fff" }]}>
                    {v.slot_label === "Flexi Pass" ? "Flexi Pass" : fmt12h(v.slot_label)}
                  </Text>
                  <Text style={styles.gridCell}>{v.children}</Text>
                  <Text style={styles.gridCell}>{v.adults}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={[styles.band, { backgroundColor: XL.memoHeader, textAlign: "left", marginTop: 8 }]}>
          Essential Contact Information (Emergency & Operational)
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {contacts.filter((c) => c.extension).map((c) => (
            <View key={c.name} style={{ width: "33%", flexDirection: "row" }}>
              <Text style={[styles.gridCell, { textAlign: "left" }]}>{c.name}</Text>
              <Text style={[styles.gridCell, { maxWidth: 60 }]}>{c.extension}</Text>
            </View>
          ))}
        </View>
        <Footer />
      </Page>
    </Document>
  );
}
