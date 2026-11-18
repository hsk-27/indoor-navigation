INSERT INTO building (id, name, description, is_enabled, created_at, modified_at) 
VALUES (1, 'GHRCE Main Campus', 'Main building campus indoor navigation', true, 1710000000000, 1710000000000) 
ON CONFLICT (name) DO NOTHING;

INSERT INTO floor (id, building_id, name, level, description, sort_order, is_enabled, svg_map_url, created_at, modified_at)
VALUES 
(1, 1, 'Basement Floor', -1, 'Basement parking, utility, and maintenance rooms', 0, true, '/uploads/svgs/basement_floor.svg', 1710000000000, 1710000000000),
(2, 1, 'Ground Floor', 0, 'Ground floor classrooms, labs, and main entrance', 1, true, '/uploads/svgs/ground_floor.svg', 1710000000000, 1710000000000),
(3, 1, 'First Floor', 1, 'First floor classrooms and faculty rooms', 2, true, '/uploads/svgs/first_floor.svg', 1710000000000, 1710000000000),
(4, 1, 'Second Floor', 2, 'Second floor departments and labs', 3, true, '/uploads/svgs/second_floor.svg', 1710000000000, 1710000000000),
(5, 1, 'Third Floor', 3, 'Third floor library and seminar halls', 4, true, '/uploads/svgs/third_floor.svg', 1710000000000, 1710000000000),
(6, 1, 'Fourth Floor', 4, 'Fourth floor auditorium and rooftop', 5, true, '/uploads/svgs/fourth_floor.svg', 1710000000000, 1710000000000)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    level = EXCLUDED.level,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    svg_map_url = EXCLUDED.svg_map_url;

INSERT INTO graph_metadata (id, floor_id, building_name, campus_name, svg_width, svg_height, pixels_per_meter, origin_x, origin_y, rotation, north_offset, graph_version, created_timestamp, modified_timestamp)
VALUES
(1, 1, 'GHRCE Main Campus', 'GHRCE', 1191.0, 842.0, 12.5, 0.0, 0.0, 0.0, 0.0, 1, 1710000000000, 1710000000000),
(2, 2, 'GHRCE Main Campus', 'GHRCE', 1191.0, 842.0, 12.5, 0.0, 0.0, 0.0, 0.0, 1, 1710000000000, 1710000000000),
(3, 3, 'GHRCE Main Campus', 'GHRCE', 1191.0, 842.0, 12.5, 0.0, 0.0, 0.0, 0.0, 1, 1710000000000, 1710000000000),
(4, 4, 'GHRCE Main Campus', 'GHRCE', 1191.0, 842.0, 12.5, 0.0, 0.0, 0.0, 0.0, 1, 1710000000000, 1710000000000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO admin_users (username, password_hash, created_at, modified_at) VALUES ('admin', '\$2a\$12\$POifd8ZYD9FA/.S8hdoawOIQpuDZHbCdD36kAQE.l3IC78OA6pd8.', 1710000000000, 1710000000000) ON CONFLICT (username) DO NOTHING;
