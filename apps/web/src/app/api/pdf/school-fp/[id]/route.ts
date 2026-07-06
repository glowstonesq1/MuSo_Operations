import { NextResponse } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { SchoolFP } from "@muso/pdf";
import { prettyDate } from "@/lib/labels";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("*, ops_poc:staff!bookings_ops_poc_id_fkey(name), sales_rep:staff!bookings_sales_rep_id_fkey(name)")
    .eq("id", params.id)
    .single();
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: mp } = await supabase
    .from("movement_plans")
    .select("*, movement_plan_sessions(*, resource:resources(name)), movement_plan_tasks(*)")
    .eq("booking_id", params.id)
    .maybeSingle();

  const { data: defs } = await supabase
    .from("custom_field_defs")
    .select("field_key, label")
    .or(`booking_type.eq.${b.booking_type},booking_type.is.null`)
    .eq("is_active", true)
    .order("sort_order");

  let plan = null;
  if (mp) {
    const bySession = new Map<number, any[]>();
    for (const s of mp.movement_plan_sessions ?? []) {
      bySession.set(s.session_number, [...(bySession.get(s.session_number) ?? []), s]);
    }
    const labels: string[] = Array.from(
      new Set((mp.movement_plan_sessions ?? []).map((s: any) => String(s.group_label)))
    ).sort() as string[];
    const sizes = new Map<string, number>();
    for (const s of mp.movement_plan_sessions ?? []) {
      if (s.headcount != null) sizes.set(s.group_label, s.headcount);
    }
    plan = {
      numGroups: mp.num_groups,
      groupSizes: labels.map((l) => ({ label: l, size: sizes.get(l) ?? 0 })),
      sessions: [...bySession.entries()]
        .sort((a, b2) => a[0] - b2[0])
        .map(([num, rows]) => ({
          sessionNumber: num,
          fromTime: rows[0].from_time.slice(0, 5),
          toTime: rows[0].to_time.slice(0, 5),
          assignments: rows.map((r: any) => ({
            groupLabel: r.group_label,
            labName: r.resource?.name ?? "Lab",
            headcount: r.headcount ?? 0,
          })),
        })),
      lunch: mp.lunch_start ? { fromTime: mp.lunch_start.slice(0, 5), toTime: mp.lunch_end?.slice(0, 5) ?? "" } : null,
      exitTime: b.exit_time?.slice(0, 5) ?? "",
      tasks: (mp.movement_plan_tasks ?? []).sort((a: any, b2: any) => a.sort_order - b2.sort_order),
    };
  }

  const buffer = await renderToBuffer(
    React.createElement(SchoolFP, {
      booking: { ...b, ops_poc_name: b.ops_poc?.name, sales_rep_name: b.sales_rep?.name },
      plan,
      customFieldDefs: defs ?? [],
      dateLabel: prettyDate(b.visit_date),
      dayColumnLabel: b.day_slot ? b.day_slot[0].toUpperCase() + b.day_slot.slice(1) : undefined,
    }) as any
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="FP_${b.name.replace(/\W+/g, "_")}_${b.visit_date}.pdf"`,
    },
  });
}
