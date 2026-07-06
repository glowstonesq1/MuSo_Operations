-- Security hardening from Supabase advisor findings (2026-07-06).

-- 1) Pin search_path on all functions (advisor: function_search_path_mutable)
ALTER FUNCTION public.sync_rb_exclusive() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;
ALTER FUNCTION public.log_booking_change() SET search_path = public;
ALTER FUNCTION public.is_writer() SET search_path = public;

-- 2) Move btree_gist out of the public schema (advisor: extension_in_public)
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- 3) Tighten always-true write policies (advisor: rls_policy_always_true)
DROP POLICY IF EXISTS ai_cache_rw ON ai_cache;
CREATE POLICY ai_cache_read ON ai_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY ai_cache_write ON ai_cache FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());

DROP POLICY IF EXISTS ai_log_insert ON ai_call_log;
CREATE POLICY ai_log_insert ON ai_call_log FOR INSERT TO authenticated
  WITH CHECK (called_by = auth.uid());

-- 4) Lock down SECURITY DEFINER functions exposed over the REST API
--    (advisors: anon/authenticated_security_definer_function_executable)
-- Trigger-only functions: nobody should call these via RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_booking_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_rb_exclusive() FROM PUBLIC, anon, authenticated;
-- RLS helper functions: must stay executable by authenticated (policies call
-- them as the querying user) but anon has no business with them.
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_staff_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_staff_department() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_writer() FROM PUBLIC, anon;
