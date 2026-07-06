-- Row Level Security policies (Section 5 of the spec)

-- Helper: role of the currently authenticated user
CREATE OR REPLACE FUNCTION public.current_user_role() RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM staff WHERE auth_user_id = auth.uid() AND is_active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_staff_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM staff WHERE auth_user_id = auth.uid() AND is_active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_staff_department() RETURNS department
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department FROM staff WHERE auth_user_id = auth.uid() AND is_active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_writer() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_user_role() IN ('admin','ops_poc','sales');
$$;

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_asks ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_plan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_plan_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_call_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_day_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE floor_poc_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_visit_counts ENABLE ROW LEVEL SECURITY;

-- staff: everyone signed in can read the directory (name/role/extension);
-- admins manage it; users may update their own row (not their role).
CREATE POLICY staff_read ON staff FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_admin_all ON staff FOR ALL TO authenticated
  USING (current_user_role() = 'admin') WITH CHECK (current_user_role() = 'admin');
CREATE POLICY staff_self_update ON staff FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid() AND role = (SELECT role FROM staff s2 WHERE s2.id = staff.id));

-- resources / vendors / custom field defs: read all, write admin+ops
CREATE POLICY resources_read ON resources FOR SELECT TO authenticated USING (true);
CREATE POLICY resources_write ON resources FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY vendors_read ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY vendors_write ON vendors FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY cfd_read ON custom_field_defs FOR SELECT TO authenticated USING (true);
CREATE POLICY cfd_write ON custom_field_defs FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());

-- bookings
-- read: everyone except department_head (they get a filtered view of asks);
-- department_head can read only bookings that carry an ask for their dept.
CREATE POLICY bookings_read ON bookings FOR SELECT TO authenticated USING (
  current_user_role() IN ('admin','ops_poc','sales','floor_lead','viewer')
  OR (
    current_user_role() = 'department_head'
    AND EXISTS (
      SELECT 1 FROM department_asks da
      WHERE da.booking_id = bookings.id
        AND da.department = current_staff_department()
    )
  )
);
CREATE POLICY bookings_insert ON bookings FOR INSERT TO authenticated
  WITH CHECK (is_writer());
CREATE POLICY bookings_update ON bookings FOR UPDATE TO authenticated USING (
  is_writer()
  OR (
    current_user_role() = 'floor_lead'
    AND EXISTS (
      SELECT 1 FROM staff_assignments sa
      WHERE sa.booking_id = bookings.id AND sa.staff_id = current_staff_id()
    )
  )
);
CREATE POLICY bookings_delete ON bookings FOR DELETE TO authenticated
  USING (current_user_role() IN ('admin','ops_poc'));

-- child tables: visible/writable in step with bookings
CREATE POLICY rb_read ON resource_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY rb_write ON resource_bookings FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY sa_read ON staff_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY sa_write ON staff_assignments FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY da_read ON department_asks FOR SELECT TO authenticated USING (
  current_user_role() <> 'department_head'
  OR department = current_staff_department()
);
CREATE POLICY da_write ON department_asks FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY da_status_update ON department_asks FOR UPDATE TO authenticated
  USING (current_user_role() = 'department_head' AND department = current_staff_department());

CREATE POLICY mp_read ON movement_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY mp_write ON movement_plans FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY mps_read ON movement_plan_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY mps_write ON movement_plan_sessions FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY mpt_read ON movement_plan_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY mpt_write ON movement_plan_tasks FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());

-- history: readable by all signed-in, written only by trigger (security definer)
CREATE POLICY bh_read ON booking_history FOR SELECT TO authenticated USING (true);
CREATE POLICY bh_insert ON booking_history FOR INSERT TO authenticated
  WITH CHECK (is_writer());

CREATE POLICY incidents_read ON incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY incidents_write ON incidents FOR ALL TO authenticated
  USING (is_writer() OR current_user_role() = 'floor_lead')
  WITH CHECK (is_writer() OR current_user_role() = 'floor_lead');

CREATE POLICY ai_log_read ON ai_call_log FOR SELECT TO authenticated
  USING (current_user_role() = 'admin');
CREATE POLICY ai_log_insert ON ai_call_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY ai_cache_rw ON ai_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY vds_read ON venue_day_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY vds_write ON venue_day_settings FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY fpa_read ON floor_poc_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY fpa_write ON floor_poc_assignments FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
CREATE POLICY dvc_read ON daily_visit_counts FOR SELECT TO authenticated USING (true);
CREATE POLICY dvc_write ON daily_visit_counts FOR ALL TO authenticated
  USING (is_writer()) WITH CHECK (is_writer());
