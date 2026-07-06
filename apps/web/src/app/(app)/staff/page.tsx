import { createClient, getCurrentStaff } from "@/lib/supabase/server";
import { StaffRoleEditor } from "@/components/StaffRoleEditor";

export const dynamic = "force-dynamic";

/** Public staff directory: name, role, extension only — no PII beyond that.
 *  Admins manage roles/departments here (new signups start as viewer). */
export default async function StaffPage() {
  const supabase = createClient();
  const me = await getCurrentStaff();
  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, role, department, extension, is_active, auth_user_id")
    .order("name");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Staff directory</h1>
      {me?.role === "admin" && (
        <p className="text-sm text-slate-500">
          You are an admin — you can change roles, departments and extensions. New signups appear here as
          <b> viewer</b>; promote them to give write access.
        </p>
      )}
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Extension</th>
              <th className="px-3 py-2">Login linked</th>
              {me?.role === "admin" && <th className="px-3 py-2">Manage</th>}
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s: any) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2">{s.role}</td>
                <td className="px-3 py-2">{s.department?.replace(/_/g, " ") ?? "—"}</td>
                <td className="px-3 py-2">{s.extension ?? "—"}</td>
                <td className="px-3 py-2">{s.auth_user_id ? "yes" : "no"}</td>
                {me?.role === "admin" && (
                  <td className="px-3 py-2"><StaffRoleEditor member={s} /></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
