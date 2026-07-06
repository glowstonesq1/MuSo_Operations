import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all: { name: string; value: string; options?: any }[]) => {
          try {
            all.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — middleware refreshes sessions
          }
        },
      },
    }
  );
}

/** Current user's staff row (role, department, staff id) or null.
 *  React-cached: layout + page share one lookup per request instead of
 *  each paying a separate round trip to the auth server. */
export const getCurrentStaff = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: staff } = await supabase
    .from("staff")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return staff ? { ...staff, user } : null;
});
