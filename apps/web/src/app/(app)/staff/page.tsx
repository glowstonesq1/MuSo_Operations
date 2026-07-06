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
        <table className="table-modern">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Extension</th>
              <th>Login linked</th>
              {me?.role === "admin" && <th>Manage (name · role · dept · ext · active)</th>}
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s: any) => (
              <tr key={s.id} className={s.is_active === false ? "opacity-50" : ""}>
                <td className="font-semibold">{s.name}</td>
                <td><span className="pill bg-slate-100 text-slate-600">{s.role}</span></td>
                <td>{s.department?.replace(/_/g, " ") ?? "—"}</td>
                <td className="tabular-nums">{s.extension ?? "—"}</td>
                <td>{s.auth_user_id ? "✓" : "—"}</td>
                {me?.role === "admin" && (
                  <td><StaffRoleEditor member={s} /></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
