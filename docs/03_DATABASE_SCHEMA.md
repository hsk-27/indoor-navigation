# 03. Database Schema & Persistence

The framework relies on PostgreSQL (or H2 in development profiles) to persist the building's graph topology. The schema is highly normalized (3NF) to ensure referential integrity.

## 1. Table Definitions

### 1.1. `building`
Represents a distinct physical structure on the campus.
- `id` (BIGINT, PK)
- `name` (VARCHAR)
- `description` (VARCHAR)
- `latitude` (DOUBLE): Phase 3 GPS anchor mapping coordinate.
- `longitude` (DOUBLE): Phase 3 GPS anchor mapping coordinate.
- `geofence_radius` (DOUBLE): Radial boundary (in meters) for triggering Capacitor geofence limits.

### 1.2. `department`
Represents logical divisions within a building.
- `id` (BIGINT, PK)
- `building_id` (BIGINT, FK -> building)
- `name` (VARCHAR)

### 1.3. `floor`
Represents a physical level within a building.
- `id` (BIGINT, PK)
- `building_id` (BIGINT, FK -> building)
- `level` (INT): Integer representation (e.g., 0 for Ground, -1 for Basement).
- `name` (VARCHAR)
- `svg_map_url` (VARCHAR): Relative path to the rendered map (e.g., `/maps/GHRCE ground floor.svg`).

### 1.4. `node`
The fundamental point on the map.
- `id` (BIGINT, PK)
- `floor_id` (BIGINT, FK -> floor): The specific floor this node resides on.
- `department_id` (BIGINT, FK -> department, Nullable)
- `type` (VARCHAR): Enum (`CONNECTOR`, `DESTINATION`, `STAIRCASE`, `LIFT`).
- `name` (VARCHAR): Public display name.
- `internal_name` (VARCHAR): Editor/Admin identifier.
- `qr_id` (VARCHAR, Unique): [LEGACY CODE PRESENT — NOT PART OF CURRENT USER WORKFLOW] A legacy identifier linking the node to physical stickers. Used exclusively for inbound fallback redirection by `QRRedirect.tsx`, not for primary graph localization.
- `x`, `y` (DOUBLE): Coordinates mapping this node's location to the exact pixel coordinate in the associated `svg_map_url`.
- `is_enabled`, `route_visibility`, `is_accessible`, `is_searchable` (BOOLEAN): Flags for pathfinding availability and UI filtering.

### 1.5. `edge`
The pathway connecting two nodes.
- `id` (BIGINT, PK)
- `source_id` (BIGINT, FK -> node)
- `destination_id` (BIGINT, FK -> node)
- `distance` (DOUBLE): Pre-calculated Euclidean length between source and destination.
- `direction` (VARCHAR): Enum (`FORWARD`, `REVERSE`, `BIDIRECTIONAL`). Corridors are usually bidirectional; security turnstiles might be forward-only.
- `is_floor_transition` (BOOLEAN): Hard flag denoting this edge connects two different floors (must strictly occur between `STAIRCASE` or `LIFT` typed nodes).
- `is_enabled` (BOOLEAN)

## 2. Integrity Rules
1. **Orphan Prevention**: Deleting a `node` cascades or requires the deletion of all connected `edge` records.
2. **Floor Transition Validation**: The `GraphLoader` strictly rejects any `edge` where `source_id.floor_id != destination_id.floor_id` UNLESS the nodes are explicitly labeled as transits (`STAIRCASE` or `LIFT`).
3. **Immutability of History**: The database serves strictly as a cold-storage persistence layer. Active route tracking interacts purely with the backend's RAM cache (`RoutingGraph`).

## 3. Graph Bootstrapping & Generation (Heuristic Parsing)
Populating hundreds of rooms across 6 floors manually is error-prone. The initial database seed (`real_graph.sql`) was procedurally generated using a strict Python heuristic script (`generate_graph.py`):

1. **SVG Scraping**: The script reads the raw XML of all 6 `.svg` floor plan files and extracts every `<text>` and `<tspan>` element.
2. **Heuristic Sanitization**: To prevent the database from being flooded with architectural noise, the script applies strict regex filters, automatically discarding labels that are:
   - Pure numbers or decimals (e.g., `0.23`).
   - Dimensions (e.g., `9.50x16.00`).
   - Scale markers, area counts, or single/double character noise (e.g., `SCALE`, `TOTAL`, `m.w.`, `d1`).
3. **K-Nearest Neighbors (KNN) Edge Mapping**: Because deleting nodes fragments the graph, the script automatically regenerates the topological web by connecting every valid node to its 3 physically closest neighbors (K=3) on the same floor via bi-directional edges.
4. **Vertical Transitions**: Finally, it automatically links aligned `STAIRCASE` and `LIFT` nodes vertically to enable seamless multi-floor A* routing.
