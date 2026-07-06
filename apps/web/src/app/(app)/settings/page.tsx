import { createClient, getCurrentStaff } from "@/lib/supabase/server";
import { CustomFieldsEditor } from "@/components/CustomFieldsEditor";
import { ResourceVendorEditor } from "@/components/ResourceVendorEditor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient();
  const me = await getCurrentStaff();
  const canWrite = me && ["admin", "ops_poc", "sales"].includes(me.role);

  const [{ data: resources }, { data: vendors }, { data: defs }] = await Promise.all([
    supabase.from("resources").select("*").order("name"),
    supabase.from("vendors").select("*").order("name"),
    supabase.from("custom_field_defs").select("*").order("booking_type").order("sort_order"),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Settings</h1>
      {!canWrite && <p className="text-sm text-slate-500">Read-only view — ask an admin for changes.</p>}

      <div className="card">
        <h2 className="mb-2 text-sm font-bold">Custom template fields</h2>
        <p className="mb-3 text-sm text-slate-500">
          Add fields for new workshop or event formats — they show up on the booking form and in FP PDFs
          for that booking type automatically.
        </p>
        {canWrite ? (
          <CustomFieldsEditor defs={defs ?? []} />
        ) : (
          <p className="text-sm text-slate-400">{(defs ?? []).length} field definitions.</p>
        )}
      </div>

      <ResourceVendorEditor resources={resources ?? []} vendors={vendors ?? []} canWrite={!!canWrite} />
    </div>
  );
}
