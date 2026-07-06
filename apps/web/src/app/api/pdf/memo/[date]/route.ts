import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { DailyMemo } from "@muso/pdf";
import { dateLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { date: string } }) {
  const supabase = createClient();
  const date = params.date;
  const [{ data: bookings }, { data: settings }, { data: pocs }, { data: counts }, { data: contacts }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("*, ops_poc:staff!bookings_ops_poc_id_fkey(name)")
        .eq("visit_date", date)
        .neq("status", "cancelled")
        .order("slot_start"),
      supabase.from("venue_day_settings").select("*").eq("visit_date", date).maybeSingle(),
      supabase.from("floor_poc_assignments").select("*").eq("visit_date", date).order("sort_order"),
      supabase.from("daily_visit_counts").select("*").eq("visit_date", date),
      supabase.from("staff").select("name, extension").not("extension", "is", null).eq("is_active", true),
    ]);

  const buffer = await renderToBuffer(
    React.createElement(DailyMemo, {
      dateLabel: dateLabel(date),
      settings: {
        muso_hours: settings?.muso_hours ?? "10:00 AM to 7:00 PM",
        subko_weekday_hours: settings?.subko_weekday_hours ?? "10.00 AM to 7.00 PM",
        subko_weekend_hours: settings?.subko_weekend_hours ?? "10.00 AM to 7.00 PM",
        liso_open: settings?.liso_open ?? "9:30 AM",
        shop_open: settings?.shop_open ?? "9:30 AM",
        shop_poc: settings?.shop_poc ?? null,
        slot_1: settings?.slot_1?.slice(0, 5) ?? "10:00",
        slot_2: settings?.slot_2?.slice(0, 5) ?? "14:00",
        slot_3: settings?.slot_3?.slice(0, 5) ?? "16:00",
      },
      bookings: (bookings ?? []).map((b: any) => ({ ...b, ops_poc_name: b.ops_poc?.name })),
      floorPocs: pocs ?? [],
      visitCounts: (counts ?? []).map((c: any) => ({
        ...c,
        slot_label: c.slot_label === "Flexi Pass" ? "Flexi Pass" : c.slot_label.slice(0, 5),
      })),
      contacts: contacts ?? [],
    }) as any
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Daily_Memo_${date}.pdf"`,
    },
  });
}
