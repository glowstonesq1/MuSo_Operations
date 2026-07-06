import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { BirthdayFP } from "@muso/pdf";
import { prettyDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { date: string } }) {
  const supabase = createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("visit_date", params.date)
    .eq("booking_type", "birthday")
    .neq("status", "cancelled")
    .order("slot_start");

  if (!bookings?.length) {
    return NextResponse.json({ error: "No birthday bookings on this date" }, { status: 404 });
  }

  const buffer = await renderToBuffer(
    React.createElement(BirthdayFP, { dateLabel: prettyDate(params.date), bookings }) as any
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Birthday_FP_${params.date}.pdf"`,
    },
  });
}
