import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { DeptBrief } from "@muso/pdf";
import { dateLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { date: string; dept: string } }) {
  const supabase = createClient();
  const { data: asks } = await supabase
    .from("department_asks")
    .select("asks_text, status, poc:staff(name), booking:bookings!inner(name, visit_date, slot_start, slot_end)")
    .eq("department", params.dept)
    .eq("booking.visit_date", params.date);

  const buffer = await renderToBuffer(
    React.createElement(DeptBrief, {
      dateLabel: dateLabel(params.date),
      department: params.dept,
      asks: (asks ?? []).map((a: any) => ({
        booking_name: a.booking.name,
        slot_start: a.booking.slot_start,
        slot_end: a.booking.slot_end,
        asks_text: a.asks_text,
        poc_name: a.poc?.name,
        status: a.status,
      })),
    }) as any
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${params.dept}_brief_${params.date}.pdf"`,
    },
  });
}
