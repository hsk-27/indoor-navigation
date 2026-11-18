-- GHRCE.NAV Database Schema Definition
-- PostgreSQL 15+ compatible with BIGINT primary and foreign keys

CREATE TABLE IF NOT EXISTS building (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geofence_radius DOUBLE PRECISION,
    created_at BIGINT NOT NULL DEFAULT 0,
    modified_at BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS department (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS floor (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    level INTEGER NOT NULL,
    svg_map_url VARCHAR(500),
    building_id BIGINT REFERENCES building(id) ON DELETE SET NULL,
    description VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_at BIGINT DEFAULT 0,
    modified_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS node (
    id BIGSERIAL PRIMARY KEY,
    floor_id BIGINT NOT NULL REFERENCES floor(id) ON DELETE CASCADE,
    department_id BIGINT REFERENCES department(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    qr_id VARCHAR(100) UNIQUE,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    internal_name VARCHAR(100),
    description VARCHAR(500),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    route_visibility BOOLEAN NOT NULL DEFAULT true,
    is_accessible BOOLEAN DEFAULT true,
    is_searchable BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS edge (
    id BIGSERIAL PRIMARY KEY,
    source_id BIGINT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    destination_id BIGINT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    distance DOUBLE PRECISION NOT NULL,
    direction VARCHAR(20) NOT NULL DEFAULT 'BIDIRECTIONAL',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    is_floor_transition BOOLEAN NOT NULL DEFAULT false,
    traversal_type VARCHAR(20) DEFAULT 'NORMAL'
);

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at BIGINT DEFAULT 0,
    modified_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS graph_metadata (
    id BIGSERIAL PRIMARY KEY,
    building_name VARCHAR(100),
    campus_name VARCHAR(100),
    floor_id BIGINT REFERENCES floor(id) ON DELETE CASCADE,
    svg_width DOUBLE PRECISION,
    svg_height DOUBLE PRECISION,
    pixels_per_meter DOUBLE PRECISION,
    origin_x DOUBLE PRECISION,
    origin_y DOUBLE PRECISION,
    rotation DOUBLE PRECISION,
    north_offset DOUBLE PRECISION,
    graph_version INTEGER,
    created_timestamp BIGINT,
    modified_timestamp BIGINT
);

CREATE INDEX IF NOT EXISTS idx_node_floor ON node(floor_id);
CREATE INDEX IF NOT EXISTS idx_node_qr ON node(qr_id);
CREATE INDEX IF NOT EXISTS idx_edge_source ON edge(source_id);
CREATE INDEX IF NOT EXISTS idx_edge_destination ON edge(destination_id);
