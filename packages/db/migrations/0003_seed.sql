-- Seed data taken from the reference files (staff names, extensions, resources,
-- vendor, and the demo bookings for 2nd & 4th July 2026).

INSERT INTO resources (name, capacity, floor, is_bookable, is_exclusive) VALUES
  ('Play Lab', 70, '4th Floor', TRUE, TRUE),
  ('Discover Lab', 70, '5th Floor', TRUE, TRUE),
  ('Make Lab', 70, '5th Floor', TRUE, TRUE),
  ('Grow Lab', 70, '7th Floor', TRUE, TRUE),
  ('9th Floor MPA', 100, '9th Floor', TRUE, TRUE),
  ('Commons', 250, 'Ground', TRUE, FALSE),
  ('3rd Floor Food Court', 250, '3rd Floor', TRUE, FALSE),
  ('6th Floor', 120, '6th Floor', TRUE, TRUE),
  ('8th Floor Persian Classroom', 40, '8th Floor', TRUE, TRUE);

INSERT INTO vendors (name, daily_threshold) VALUES
  ('Urban Pantry', 400);

INSERT INTO staff (name, role, extension, department) VALUES
  ('Shrikant Patil', 'ops_poc', '4001', 'ops'),
  ('Aniket', 'ops_poc', NULL, 'ops'),
  ('Ashish Gorde', 'floor_lead', '4066', 'visitor_experience'),
  ('Simran', 'floor_lead', '4079', 'visitor_experience'),
  ('Neelam', 'floor_lead', '4079', 'visitor_experience'),
  ('Shreeraj', 'floor_lead', '4083', 'visitor_experience'),
  ('Mohit', 'floor_lead', '4091', 'visitor_experience'),
  ('Pooja (Nurse)', 'floor_lead', '4093', 'visitor_experience'),
  ('Rohan', 'ops_poc', NULL, 'ops'),
  ('Krutika', 'ops_poc', NULL, 'ops'),
  ('Sawood', 'floor_lead', NULL, 'visitor_experience'),
  ('Shweta', 'floor_lead', NULL, 'visitor_experience'),
  ('Kunal', 'floor_lead', NULL, 'visitor_experience'),
  ('Vinothini', 'floor_lead', NULL, 'visitor_experience'),
  ('Faiz', 'sales', NULL, NULL),
  ('Aditi', 'sales', NULL, NULL),
  ('Swati', 'sales', NULL, NULL),
  ('Siddhant', 'sales', NULL, NULL),
  ('Hitarth', 'sales', NULL, NULL),
  ('Vrushali', 'sales', NULL, NULL),
  ('Pradeep', 'ops_poc', NULL, 'ops'),
  ('Aashish', 'department_head', NULL, 'housekeeping'),
  ('Naveen', 'department_head', NULL, 'it'),
  ('Sameer', 'department_head', NULL, 'technical');

-- Demo booking 1: Singhania School, 2nd July 2026 (acceptance test #1)
DO $$
DECLARE
  b_id UUID;
  mp_id UUID;
  aniket UUID; faiz UUID;
  play UUID; discover UUID; make UUID;
BEGIN
  SELECT id INTO aniket FROM staff WHERE name = 'Aniket';
  SELECT id INTO faiz FROM staff WHERE name = 'Faiz';
  SELECT id INTO play FROM resources WHERE name = 'Play Lab';
  SELECT id INTO discover FROM resources WHERE name = 'Discover Lab';
  SELECT id INTO make FROM resources WHERE name = 'Make Lab';

  INSERT INTO bookings (
    booking_type, status, visit_date, slot_start, slot_end, day_slot,
    name, location, poc_external_name, poc_external_contact,
    children_planned, teachers_planned, escorts_planned, buses, grade, jain_kids,
    ops_poc_id, sales_rep_id, travel_agent, poc_travel_agent,
    bus_reporting_time, orientation_time, exit_time,
    kids_menu, kids_lunch_time, teachers_menu, teachers_breakfast_time,
    food_vendor, food_location
  ) VALUES (
    'school', 'confirmed', '2026-07-02', '09:30', '14:30', 'morning',
    'Singhania School', 'Thane', NULL, NULL,
    211, 20, 10, 5, '3', 5,
    aniket, faiz, 'Adventure', 'Mr. Astad',
    '09:30', '09:45', '14:30',
    'Pav Bhaji, Fried Rice, Manchurian Gravy, 1pc Gulab Jamun', '12:30',
    'Pav Bhaji, Fried Rice, Manchurian Gravy, 1pc Gulab Jamun', '10:00',
    'Urban Pantry', '3rd floor'
  ) RETURNING id INTO b_id;

  INSERT INTO movement_plans (booking_id, num_groups, session_duration_minutes, switch_duration_minutes, lunch_start, lunch_end)
  VALUES (b_id, 3, 70, 5, '12:35', '13:35') RETURNING id INTO mp_id;

  INSERT INTO movement_plan_sessions (movement_plan_id, session_number, from_time, to_time, group_label, resource_id, headcount) VALUES
    (mp_id, 1, '10:05', '11:15', 'A', play, 70),
    (mp_id, 1, '10:05', '11:15', 'B', discover, 70),
    (mp_id, 1, '10:05', '11:15', 'C', make, 71),
    (mp_id, 2, '11:20', '12:30', 'C', play, 71),
    (mp_id, 2, '11:20', '12:30', 'A', discover, 70),
    (mp_id, 2, '11:20', '12:30', 'B', make, 70),
    (mp_id, 3, '13:40', '14:50', 'B', play, 70),
    (mp_id, 3, '13:40', '14:50', 'C', discover, 71),
    (mp_id, 3, '13:40', '14:50', 'A', make, 70);

  INSERT INTO movement_plan_tasks (movement_plan_id, sort_order, task, timing_text, person_names) VALUES
    (mp_id, 1, 'Bus Deboarding & Parking', '9:30 AM', 'Aniket | Sawood | Shweta'),
    (mp_id, 2, 'Transportation to Commons', '9:30 AM to 9:45 AM', 'Aniket | Sawood | Shweta'),
    (mp_id, 3, 'Welcoming & Orientation', '9:45 AM to 10:00 AM', 'Simran | Kunal | Vinothini'),
    (mp_id, 4, 'Play Lab', '10:05 AM to 2:50 PM', 'Kunal | Neelam'),
    (mp_id, 5, 'Discover Lab', '10:05 AM to 2:50 PM', 'Simran | Neelam'),
    (mp_id, 6, 'Make Lab', '10:05 AM to 2:50 PM', 'Pooja'),
    (mp_id, 7, 'Lunch', '12:35 PM to 1:35 PM', 'Aniket | Sawood'),
    (mp_id, 8, 'Feedback & Exit', '2:50 PM onwards', 'Aniket | Simran | Shweta');

  INSERT INTO resource_bookings (booking_id, resource_id, from_time, to_time, group_label, headcount)
  SELECT b_id, s.resource_id,
         ('2026-07-02'::date + s.from_time) AT TIME ZONE 'Asia/Kolkata',
         ('2026-07-02'::date + s.to_time) AT TIME ZONE 'Asia/Kolkata',
         s.group_label, s.headcount
  FROM movement_plan_sessions s WHERE s.movement_plan_id = mp_id;
END $$;

-- Demo booking 2: FBI Workshop, 4th July 2026 (event with department asks)
DO $$
DECLARE
  b_id UUID;
  aashish UUID; naveen UUID; sameer UUID; mpa UUID;
BEGIN
  SELECT id INTO aashish FROM staff WHERE name = 'Aashish';
  SELECT id INTO naveen FROM staff WHERE name = 'Naveen';
  SELECT id INTO sameer FROM staff WHERE name = 'Sameer';
  SELECT id INTO mpa FROM resources WHERE name = '9th Floor MPA';

  INSERT INTO bookings (
    booking_type, status, visit_date, slot_start, slot_end,
    name, event_location, is_ticketed, ticket_price, ticketing_platform,
    workshop_name, about_event, ideal_ages,
    children_planned, adults_planned,
    partner_name, setup_instructions_internal, other_notes
  ) VALUES (
    'workshop', 'confirmed', '2026-07-04', '11:00', '13:00',
    'Food & Beverage Investigator Program', '9th Floor MPA, Museum of Solutions',
    TRUE, 1500, 'MuSo Website',
    'FBI Workshop',
    'A hands-on 2 hour workshop where kids learn to catch food lies. 4 levels of food label reading and 2 missions.',
    '7-11 years', 15, 15,
    'The Whole Truth',
    'MuSo team SET UP - Friday Evening. TWT team set up - Saturday Morning onwards. TWT team WRAP UP - Saturday 1pm. MuSo team WRAP UP - Saturday 1pm.',
    'The workshop is designed exclusively for children. Parents are welcome to accompany them; however, the workshop activities themselves will be child-only.'
  ) RETURNING id INTO b_id;

  INSERT INTO department_asks (booking_id, department, asks_text, department_poc_id) VALUES
    (b_id, 'housekeeping', 'Tables-8, Liso Stools-15, Red Cushions from 7th Floor-12, Black Screen-4, Easel Stands-2', aashish),
    (b_id, 'technical', 'Connection to the TV Screens, Bluetooth Speaker-1, Mic-1', sameer),
    (b_id, 'it', 'NA', naveen),
    (b_id, 'front_desk', 'NA', aashish);

  INSERT INTO resource_bookings (booking_id, resource_id, from_time, to_time, headcount)
  VALUES (b_id, mpa,
    ('2026-07-04'::date + '11:00'::time) AT TIME ZONE 'Asia/Kolkata',
    ('2026-07-04'::date + '13:00'::time) AT TIME ZONE 'Asia/Kolkata', 30);
END $$;

-- Demo bookings 3-5: Birthday parties, 4th July 2026 (3-slot reference CSV)
DO $$
DECLARE sixth UUID;
BEGIN
  SELECT id INTO sixth FROM resources WHERE name = '6th Floor';

  INSERT INTO bookings (
    booking_type, status, visit_date, slot_start, slot_end,
    name, age_group, entry_commons_time, entry_museum_time,
    cake_cutting_start, cake_cutting_end, cake_cutting_location,
    children_planned, adults_planned, decor_type, decor_setup_info,
    fnb_menu, welcome_service, remarks
  ) VALUES
    ('birthday', 'confirmed', '2026-07-04', '10:00', '14:00',
     'Ms. Neha', '10 Years', '09:30', '10:00', '13:00', '14:00', '6th Floor',
     30, 10, 'Standard', 'Standard', 'Buffet', 'NA', 'Mission Activity'),
    ('birthday', 'confirmed', '2026-07-04', '13:30', '16:30',
     'Ms. Poorna', '5 Years', '13:00', '13:30', '15:30', '16:30', '6th Floor',
     40, 30, 'Standard', 'Standard', 'Buffet', 'NA', NULL),
    ('birthday', 'confirmed', '2026-07-04', '16:00', '19:00',
     'Mr. Ankur', '5 Years', '15:30', '16:00', '18:30', '19:00', '6th Floor',
     40, 40, 'Standard', 'Standard', 'Buffet', 'NA', NULL);
END $$;

-- Memo scaffolding for the demo dates
INSERT INTO venue_day_settings (visit_date, muso_hours, shop_poc, slot_1, slot_2, slot_3) VALUES
  ('2026-07-02', '9.30 AM to 6.30 PM', 'Sawood', '09:30', '12:30', '15:30'),
  ('2026-07-04', '10:00 AM to 7:00 PM', 'Sawood', '10:00', '14:00', '16:00');

INSERT INTO floor_poc_assignments (visit_date, floor_role, staff_names, sort_order) VALUES
  ('2026-07-02', 'Ops POC', 'Shrikant', 1),
  ('2026-07-02', 'Birthday', 'Rohan', 2),
  ('2026-07-02', 'Reception', 'Aniket', 3),
  ('2026-07-02', 'Play Lab', 'Simran | Neelam', 4),
  ('2026-07-02', 'Discover Lab', 'Simran | Neelam', 5),
  ('2026-07-02', 'Make Lab', 'Shreeraj', 6),
  ('2026-07-02', 'Grow Lab', 'Mohit | Neelam', 7),
  ('2026-07-04', 'Ops POC', 'Aniket', 1),
  ('2026-07-04', 'Birthday', 'Rohan', 2),
  ('2026-07-04', 'Reception', 'Aniket', 3),
  ('2026-07-04', 'Play Lab', 'Simran | Neelam', 4),
  ('2026-07-04', 'Discover Lab', 'Simran | Neelam', 5),
  ('2026-07-04', 'Make Lab', 'Shreeraj', 6),
  ('2026-07-04', 'Grow Lab', 'Mohit | Neelam', 7);

INSERT INTO daily_visit_counts (visit_date, slot_label, children, adults) VALUES
  ('2026-07-04', '10:00', 2, 3),
  ('2026-07-04', '14:00', 4, 7),
  ('2026-07-04', '16:00', 6, 10),
  ('2026-07-04', 'Flexi Pass', 3, 3);

-- Example user-defined template fields (shows the extensibility path)
INSERT INTO custom_field_defs (booking_type, field_key, label, input_type, section, sort_order) VALUES
  ('workshop', 'returnable_material_list', 'List of returnable material - External Team', 'textarea', 'Event Details', 10),
  ('workshop', 'setup_team_list', 'List of set up team - External Team', 'textarea', 'Event Details', 11);
