-- MuSo Ops Command Center — core schema
-- Deviations from the original spec are marked with "-- DEVIATION:" comments.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE booking_type AS ENUM (
  'school', 'csr_general', 'csr_stem', 'csr_financial_literacy',
  'csr_future_makers', 'birthday', 'workshop', 'summer_camp',
  'ticketed_museum', 'collaboration'
);
CREATE TYPE booking_status AS ENUM (
  'draft', 'confirmed', 'in_progress', 'completed', 'cancelled'
);
CREATE TYPE slot_color AS ENUM ('blue', 'green', 'purple', 'yellow');
CREATE TYPE department AS ENUM (
  'housekeeping', 'it', 'front_desk', 'security',
  'technical', 'fnb', 'ops', 'visitor_experience'
);
CREATE TYPE user_role AS ENUM (
  'admin', 'ops_poc', 'sales', 'floor_lead',
  'department_head', 'viewer'
);
CREATE TYPE day_slot AS ENUM ('morning', 'afternoon', 'evening');

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  role user_role DEFAULT 'viewer',
  -- department_head users need a department to scope their RLS visibility
  department department,
  extension TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  capacity INT,
  floor TEXT,
  is_bookable BOOLEAN DEFAULT TRUE,
  -- DEVIATION: shared spaces (Commons, Food Court) may legitimately host
  -- several groups at once; exclusive=false rows skip the hard clash block.
  is_exclusive BOOLEAN DEFAULT TRUE
);

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  daily_threshold INT DEFAULT 400,
  contact TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type booking_type NOT NULL,
  status booking_status DEFAULT 'draft',
  visit_date DATE NOT NULL,
  slot_start TIME NOT NULL,
  slot_end TIME NOT NULL,
  slot_color slot_color,
  day_slot day_slot, -- Morning / Afternoon / Evening column in reference FPs

  -- Client info
  name TEXT NOT NULL,
  location TEXT,
  poc_external_name TEXT,
  poc_external_contact TEXT,
  travel_agent TEXT,
  poc_travel_agent TEXT,
  travel_agent_contact TEXT,

  -- Headcount (planned vs actual)
  children_planned INT DEFAULT 0,
  adults_planned INT DEFAULT 0,
  teachers_planned INT DEFAULT 0,
  escorts_planned INT DEFAULT 0,
  buses INT DEFAULT 0,
  grade TEXT,
  jain_kids INT DEFAULT 0,
  children_actual INT,
  adults_actual INT,
  teachers_actual INT,

  -- Ops assignments
  ops_poc_id UUID REFERENCES staff(id),
  sales_rep_id UUID REFERENCES staff(id),

  -- Food
  food_vendor TEXT,
  food_location TEXT,
  kids_menu TEXT,
  kids_lunch_time TIME,
  teachers_menu TEXT,
  teachers_breakfast_time TIME,

  -- Timing
  bus_reporting_time TIME,
  orientation_time TIME,
  exit_time TIME,

  -- Workshop / Event (fields from FBI Workshop reference)
  workshop_name TEXT,
  workshop_details TEXT,
  event_location TEXT,
  ticketing_platform TEXT,
  setup_instructions_internal TEXT,
  setup_instructions_external TEXT,
  partner_name TEXT,
  partner_poc TEXT,
  ideal_ages TEXT,
  about_event TEXT,
  other_notes TEXT,
  returnable_materials TEXT,

  -- Ticketing / Birthday (fields from Birthday FP reference)
  is_ticketed BOOLEAN DEFAULT FALSE,
  ticket_price NUMERIC,
  entry_band_color TEXT,
  decor_type TEXT,
  decor_setup_info TEXT,
  cake_cutting_start TIME,
  cake_cutting_end TIME,
  cake_cutting_location TEXT,
  entry_commons_time TIME,
  entry_museum_time TIME,
  age_group TEXT,
  complimentary_adults INT DEFAULT 0,
  welcome_service TEXT,
  welcome_note TEXT,
  photography_package TEXT,
  chef_team TEXT,
  fnb_menu TEXT,

  -- DEVIATION: user-defined template fields for new workshop/event types.
  -- Definitions live in custom_field_defs; values live here.
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Meta
  remarks TEXT,
  created_by UUID REFERENCES auth.users,
  updated_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT slot_order CHECK (slot_start < slot_end)
);
CREATE INDEX bookings_visit_date_idx ON bookings (visit_date);

-- Per-booking-type user-defined field definitions ("make your own template")
CREATE TABLE custom_field_defs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_type booking_type, -- NULL = applies to all types
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'text', -- text | number | time | date | select | textarea | checkbox
  options JSONB, -- for select: ["a","b"]
  required BOOLEAN DEFAULT FALSE,
  section TEXT DEFAULT 'Custom',
  sort_order INT DEFAULT 100,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (booking_type, field_key)
);

CREATE TABLE resource_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id),
  from_time TIMESTAMPTZ NOT NULL,
  to_time TIMESTAMPTZ NOT NULL,
  group_label TEXT,
  headcount INT,
  -- denormalised from resources.is_exclusive so the EXCLUDE constraint
  -- (which can only see this table's columns) can skip shared spaces
  exclusive BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT rb_time_order CHECK (from_time < to_time),
  -- HARD CLASH PREVENTION at DB level (exclusive resources only)
  CONSTRAINT no_resource_clash EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(from_time, to_time, '[)') WITH &&
  ) WHERE (exclusive)
);
CREATE INDEX resource_bookings_booking_idx ON resource_bookings (booking_id);

-- keep resource_bookings.exclusive in sync with the resource
CREATE OR REPLACE FUNCTION sync_rb_exclusive() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  SELECT COALESCE(is_exclusive, TRUE) INTO NEW.exclusive
  FROM resources WHERE id = NEW.resource_id;
  RETURN NEW;
END $$;
CREATE TRIGGER rb_sync_exclusive BEFORE INSERT OR UPDATE OF resource_id
ON resource_bookings FOR EACH ROW EXECUTE FUNCTION sync_rb_exclusive();

CREATE TABLE staff_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id),
  assignment_role TEXT
);
CREATE INDEX staff_assignments_staff_idx ON staff_assignments (staff_id);
CREATE INDEX staff_assignments_booking_idx ON staff_assignments (booking_id);

CREATE TABLE department_asks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  department department NOT NULL,
  asks_text TEXT NOT NULL,
  department_poc_id UUID REFERENCES staff(id),
  status TEXT DEFAULT 'pending'
);
CREATE INDEX department_asks_booking_idx ON department_asks (booking_id);

CREATE TABLE movement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
  num_groups INT NOT NULL,
  session_duration_minutes INT DEFAULT 70,
  switch_duration_minutes INT DEFAULT 5,
  lunch_start TIME,
  lunch_end TIME,
  auto_generated BOOLEAN DEFAULT TRUE,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE movement_plan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_plan_id UUID REFERENCES movement_plans(id) ON DELETE CASCADE,
  session_number INT,
  from_time TIME,
  to_time TIME,
  group_label TEXT,
  resource_id UUID REFERENCES resources(id),
  headcount INT
);

-- "Task" rows of the movement plan sheet (bus deboarding, orientation, lunch…)
CREATE TABLE movement_plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_plan_id UUID REFERENCES movement_plans(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  task TEXT NOT NULL,
  timing_text TEXT,
  person_names TEXT
);

-- DEVIATION: booking_id is ON DELETE SET NULL (spec had CASCADE) so the
-- audit trail — including the deletion event itself — survives deletion.
CREATE TABLE booking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  booking_name TEXT,
  visit_date DATE,
  changed_by UUID REFERENCES auth.users,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  change_type TEXT,
  before_data JSONB,
  after_data JSONB,
  reason TEXT
);
CREATE INDEX booking_history_booking_idx ON booking_history (booking_id);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  incident_type TEXT,
  description TEXT,
  delay_minutes INT,
  time_reported TIMESTAMPTZ DEFAULT NOW(),
  reported_by UUID REFERENCES auth.users,
  resolved BOOLEAN DEFAULT FALSE,
  ai_suggested_resolution TEXT
);

CREATE TABLE ai_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  called_at TIMESTAMPTZ DEFAULT NOW(),
  called_by UUID REFERENCES auth.users,
  feature TEXT,
  input_tokens INT,
  output_tokens INT,
  cached BOOLEAN DEFAULT FALSE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL
);

CREATE TABLE ai_cache (
  feature TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (feature, input_hash)
);

-- Per-date venue settings shown at the top of the Daily Memo
CREATE TABLE venue_day_settings (
  visit_date DATE PRIMARY KEY,
  muso_hours TEXT DEFAULT '10:00 AM to 7:00 PM',
  subko_weekday_hours TEXT DEFAULT '10.00 AM to 7.00 PM',
  subko_weekend_hours TEXT DEFAULT '10.00 AM to 7.00 PM',
  liso_open TEXT DEFAULT '9:30 AM',
  shop_open TEXT DEFAULT '9:30 AM',
  shop_poc TEXT,
  slot_1 TIME DEFAULT '10:00',
  slot_2 TIME DEFAULT '14:00',
  slot_3 TIME DEFAULT '16:00'
);

-- Per-date floor POC roster (Ops POC, Reception, Play Lab, …) for the memo
CREATE TABLE floor_poc_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_date DATE NOT NULL,
  floor_role TEXT NOT NULL, -- 'Ops POC','Birthday','Reception','Play Lab','Discover Lab','Make Lab','Grow Lab'
  staff_names TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  UNIQUE (visit_date, floor_role)
);

-- Ticketed walk-in counts per public slot per day (memo bottom table)
CREATE TABLE daily_visit_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_date DATE NOT NULL,
  slot_label TEXT NOT NULL, -- '10:00','14:00','16:00','Flexi Pass'
  children INT DEFAULT 0,
  adults INT DEFAULT 0,
  UNIQUE (visit_date, slot_label)
);

-- updated_at maintenance
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END $$;
CREATE TRIGGER bookings_touch BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Audit trail: every insert/update/delete on bookings lands in booking_history
CREATE OR REPLACE FUNCTION log_booking_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO booking_history (booking_id, booking_name, visit_date, changed_by, change_type, after_data)
    VALUES (NEW.id, NEW.name, NEW.visit_date, auth.uid(), 'create', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO booking_history (booking_id, booking_name, visit_date, changed_by, change_type, before_data, after_data)
    VALUES (NEW.id, NEW.name, NEW.visit_date, auth.uid(), 'update', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO booking_history (booking_id, booking_name, visit_date, changed_by, change_type, before_data)
    VALUES (NULL, OLD.name, OLD.visit_date, auth.uid(), 'delete', to_jsonb(OLD));
    RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER bookings_audit
AFTER INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION log_booking_change();

-- Auto-create a staff profile (viewer) for every new auth user
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.staff (auth_user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'viewer'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
