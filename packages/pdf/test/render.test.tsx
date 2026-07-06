import React from "react";
import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { SchoolFP, BirthdayFP, EventFP, DailyMemo, DeptBrief } from "../src";

const school = {
  booking_type: "school",
  name: "Singhania School",
  location: "Thane",
  slot_start: "09:30",
  slot_end: "14:30",
  children_planned: 211,
  teachers_planned: 20,
  escorts_planned: 10,
  buses: 5,
  grade: "3",
  jain_kids: 5,
  ops_poc_name: "Aniket",
  sales_rep_name: "Faiz",
  travel_agent: "Adventure",
  poc_travel_agent: "Mr. Astad",
  bus_reporting_time: "09:30",
  orientation_time: "09:45",
  kids_menu: "Pav Bhaji, Fried Rice, Manchurian Gravy, 1pc Gulab Jamun",
  kids_lunch_time: "12:30",
  teachers_menu: "Pav Bhaji, Fried Rice, Manchurian Gravy, 1pc Gulab Jamun",
  teachers_breakfast_time: "10:00",
  food_vendor: "Urban Pantry",
  food_location: "3rd floor",
  exit_time: "14:30",
  custom_fields: {},
};

const plan = {
  numGroups: 3,
  groupSizes: [
    { label: "A", size: 71 },
    { label: "B", size: 70 },
    { label: "C", size: 70 },
  ],
  sessions: [1, 2, 3].map((n) => ({
    sessionNumber: n,
    fromTime: ["10:05", "11:20", "13:40"][n - 1],
    toTime: ["11:15", "12:30", "14:50"][n - 1],
    assignments: ["Play Lab", "Discover Lab", "Make Lab"].map((lab, i) => ({
      groupLabel: "ABC"[(i + n - 1) % 3],
      labName: lab,
      headcount: 70,
    })),
  })),
  lunch: { fromTime: "12:35", toTime: "13:35" },
  exitTime: "14:50",
  tasks: [{ task: "Bus Deboarding & Parking", timing_text: "9:30 AM", person_names: "Aniket | Sawood" }],
};

describe("PDF templates render", () => {
  it("SchoolFP", async () => {
    const buf = await renderToBuffer(
      <SchoolFP booking={school} plan={plan} dateLabel="2nd July 2026" dayColumnLabel="Morning" />
    );
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("BirthdayFP", async () => {
    const buf = await renderToBuffer(
      <BirthdayFP
        dateLabel="4th July 2026"
        bookings={[
          { id: "1", name: "Ms. Neha", slot_start: "10:00", slot_end: "14:00", age_group: "10 Years", children_planned: 30, adults_planned: 10, decor_type: "Standard", fnb_menu: "Buffet", entry_commons_time: "09:30", cake_cutting_start: "13:00", cake_cutting_end: "14:00", cake_cutting_location: "6th Floor", remarks: "Mission Activity" },
          { id: "2", name: "Ms. Poorna", slot_start: "13:30", slot_end: "16:30", age_group: "5 Years", children_planned: 40, adults_planned: 30, decor_type: "Standard", fnb_menu: "Buffet" },
        ]}
      />
    );
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("EventFP", async () => {
    const buf = await renderToBuffer(
      <EventFP
        dateLabel="4th July 2026"
        booking={{ name: "FBI Workshop", slot_start: "11:00", slot_end: "13:00", is_ticketed: true, ticket_price: 1500, partner_name: "The Whole Truth", event_location: "9th Floor MPA", ideal_ages: "7-11 years", children_planned: 15, adults_planned: 15, custom_fields: {} }}
        asks={[
          { department: "housekeeping", asks_text: "Tables-8, Stools-15", poc_name: "Aashish" },
          { department: "technical", asks_text: "TV screens, Mic-1", poc_name: "Sameer" },
        ]}
      />
    );
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("DailyMemo", async () => {
    const buf = await renderToBuffer(
      <DailyMemo
        dateLabel="04/07/2026, Saturday"
        settings={{ muso_hours: "10:00 AM to 7:00 PM", subko_weekday_hours: "10.00 AM to 7.00 PM", subko_weekend_hours: "10.00 AM to 7.00 PM", liso_open: "9:30 AM", shop_open: "9:30 AM", shop_poc: "Sawood", slot_1: "10:00", slot_2: "14:00", slot_3: "16:00" }}
        bookings={[{ id: "1", booking_type: "birthday", name: "Ms. Neha", slot_start: "10:00", slot_end: "14:00", children_planned: 30, adults_planned: 10, ops_poc_name: "Rohan" }]}
        floorPocs={[{ floor_role: "Play Lab", staff_names: "Simran | Neelam" }]}
        visitCounts={[{ slot_label: "10:00", children: 2, adults: 3 }, { slot_label: "Flexi Pass", children: 3, adults: 3 }]}
        contacts={[{ name: "Shrikant Patil", extension: "4001" }]}
      />
    );
    expect(buf.length).toBeGreaterThan(2000);
  });

  it("DeptBrief", async () => {
    const buf = await renderToBuffer(
      <DeptBrief
        dateLabel="04/07/2026, Saturday"
        department="housekeeping"
        asks={[{ booking_name: "FBI Workshop", slot_start: "11:00", slot_end: "13:00", asks_text: "Tables-8", poc_name: "Aashish", status: "pending" }]}
      />
    );
    expect(buf.length).toBeGreaterThan(1000);
  });
});
