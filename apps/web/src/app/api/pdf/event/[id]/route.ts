import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { EventFP } from "@muso/pdf";
import { prettyDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("*, ops_poc:staff!bookings_ops_poc_id_fkey(name)")
    .eq("id", params.id)
    .single();
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: asks } = await supabase
    .from("department_asks")
    .select("department, asks_text, poc:staff(name)")
    .eq("booking_id", params.id);
  const { data: defs } = await supabase
    .from("custom_field_defs")
    .select("field_key, label")
    .or(`booking_type.eq.${b.booking_type},booking_type.is.null`)
    .eq("is_active", true)
    .order("sort_order");

  const buffer = await renderToBuffer(
    React.createElement(EventFP, {
      dateLabel: prettyDate(b.visit_date),
      booking: { ...b, ops_poc_name: b.ops_poc?.name },
      asks: (asks ?? []).map((a: any) => ({ ...a, poc_name: a.poc?.name })),
      customFieldDefs: defs ?? [],
    }) as any
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Event_FP_${b.visit_date}.pdf"`,
    },
  });
}
