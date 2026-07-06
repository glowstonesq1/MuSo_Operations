import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { fmt12h } from "@muso/logic";
import { styles, Footer, na } from "./common";
import { XL } from "./theme";

/** One page per department per day: only that department's asks. */

export interface DeptBriefProps {
  dateLabel: string;
  department: string;
  asks: {
    booking_name: string;
    slot_start: string;
    slot_end: string;
    asks_text: string;
    poc_name?: string | null;
    status?: string | null;
  }[];
}

export function DeptBrief({ dateLabel, department, asks }: DeptBriefProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>
          {department.replace(/_/g, " ").toUpperCase()} — Department Brief | {dateLabel}
        </Text>
        {asks.length === 0 ? (
          <Text>No asks for this department today.</Text>
        ) : (
          <>
            <View style={styles.gridRow}>
              {["Booking", "Timing", "Asks", "POC", "Status"].map((h) => (
                <Text key={h} style={[styles.gridCell, { backgroundColor: XL.memoCell, fontFamily: "Helvetica-Bold", flex: h === "Asks" ? 2.5 : 1 }]}>
                  {h}
                </Text>
              ))}
            </View>
            {asks.map((a, i) => (
              <View key={i} style={styles.gridRow}>
                <Text style={styles.gridCell}>{a.booking_name}</Text>
                <Text style={styles.gridCell}>{fmt12h(a.slot_start)} to {fmt12h(a.slot_end)}</Text>
                <Text style={[styles.gridCell, { flex: 2.5, textAlign: "left" }]}>{na(a.asks_text)}</Text>
                <Text style={styles.gridCell}>{na(a.poc_name)}</Text>
                <Text style={styles.gridCell}>{na(a.status)}</Text>
              </View>
            ))}
          </>
        )}
        <Footer />
      </Page>
    </Document>
  );
}
