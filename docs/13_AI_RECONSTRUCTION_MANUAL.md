# AI Reconstruction Manual: Indoor Navigation Framework

This document is strictly formatted to provide large language models (LLMs) with the absolute constraints, architectural decisions, and invariants required to perfectly reconstruct or modify the Indoor Navigation Framework without violating system integrity.

## 1. Core Architectural Constraints
- **Frontend Stack**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, Capacitor.
- **Backend Stack**: Java 21, Spring Boot 3, Maven.
- **Database**: PostgreSQL (3NF Normalized).
- **Rule 1 (Rendering)**: Absolutely no `<canvas>` or WebGL is permitted for map rendering. Maps are exclusively rendered using `<svg>` elements with hardware-accelerated CSS `transform` (matrix scaling/translating) for guaranteed 60fps mobile performance.
- **Rule 2 (Routing)**: The database is for *persistence only*. The backend must load the full graph into RAM (`RoutingGraph`) on boot and execute A* strictly in memory. 
- **Rule 3 (Device Binding)**: The architecture relies on exactly one single app-entry QR (`app_link.png`) to carry the URL. [LEGACY CODE PRESENT — NOT PART OF CURRENT USER WORKFLOW]: Legacy node QRs simply contain relative UUIDs (`qrId`) to support inbound fallback redirection (`QRRedirect.tsx`), but they are entirely obsolete for active navigation.

---

## 2. Database Schema (PostgreSQL)
The graph topology is stored in a normalized relational structure:

### Table: `node`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGINT (PK) | Internal unique identifier |
| `floor_id` | BIGINT (FK) | Links to physical floor |
| `type` | VARCHAR | ENUM: `CONNECTOR`, `DESTINATION`, `STAIRCASE`, `LIFT` |
| `name` | VARCHAR | Human-readable name |
| `qr_id` | VARCHAR | [LEGACY CODE PRESENT — NOT PART OF CURRENT USER WORKFLOW] Unique string encoded in legacy physical QR stickers. Used exclusively by `QRRedirect.tsx` to handle inbound fallback redirection when scanned by a native phone camera. |
| `x`, `y` | DOUBLE | Physical coordinates mapped to the SVG |

### Table: `edge`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | BIGINT (PK) | Internal unique identifier |
| `source_id` | BIGINT (FK)| ID of starting node |
| `destination_id` | BIGINT (FK)| ID of ending node |
| `distance` | DOUBLE | Pre-calculated Euclidean distance (SVG units) |
| `direction` | VARCHAR | ENUM: `FORWARD`, `REVERSE`, `BIDIRECTIONAL` |
| `is_floor_transition` | BOOLEAN | True if edge connects two floors vertically |

---

## 3. Backend Logic Invariants

### 3.1. Thread-Safe Graph Cache
- **Class**: `GraphCacheServiceImpl`
- **Mechanism**: Maintains an `AtomicReference<RoutingGraph>`.
- **Constraint**: Admin modifications to the database trigger a `GraphUpdatedEvent`. The cache performs a lock-free atomic swap of the newly loaded graph, ensuring 0ms downtime for active routing requests.

### 3.2. A* Pathfinding Engine
- **Unit Invariant**: `gScore` and `heuristic` both operate exclusively in **SVG pixels**. This ensures `fScore = gScore + heuristic` is dimensionally consistent. The final `totalDistance` in `RouteResponse` is converted from pixels to metres using the destination floor's `pixelsPerMeter` only at output time.
- **Heuristic**: True 3D Euclidean in pixel-space. For cross-floor routes, vertical travel cost (metres) is converted to pixels via `PPM` and combined with horizontal pixel distance: `Math.sqrt(horizontalPixelDist^2 + (verticalMetres * ppm)^2)`.
- **Constraint**: The heuristic is mathematically admissible. It calculates true minimum vertical travel (using a base stair/lift penalty of `max(10m, floorDiff * 4m)`) and combines it with horizontal SVG distance, ensuring A* always returns the mathematically optimal path.

---

## 4. Frontend Localization Pipeline (The "Engine")

The frontend executes a strict 4-step data pipeline per sensor tick (typically 60Hz):

**Standardized Calibration Status:**
- **Calibration mechanism**: IMPLEMENTED.
- **Physical calibration values for the current maps**: NOT YET VALIDATED.

**Therefore:**
- the software supports conversion to metres;
- the current maps cannot yet be assumed to be metrically accurate;
- current distance thresholds/voice lookaheads should be treated as calibration-dependent.

### Step 1: PDR (`DeadReckoningEngine`)
- Estimates velocity (`stepLength * cadence / 60`) and outputs Cartesian drift (`dx = stepLength * Math.sin(heading)`).

### Step 2: Pure Geometry (`GraphProjector`)
- Takes the raw PDR estimate and executes orthogonal projections onto all edges within a 150-unit radius. Stripped of all routing bias.

### Step 3: Decision Engine (`GraphSnapper`)
- Selects the optimal projected edge using weighted penalties:
  - **Distance Penalty**: `-2x` per unit of deviation.
  - **Heading Penalty**: Up to `-157` if moving perpendicular. No penalty for 180° inversion (since corridor edges are bi-directional).
  - **Continuity Bonus**: `+100` if identical to the previous edge; `+50` if sharing an intersection node.
  - **Route Bias**: `+80` if the edge is part of the active A* route.

### Step 4: Temporal Consistency (`MapMatcher`)
- Prevents wall-clipping (teleportation). If the `GraphSnapper` selects an edge that does not share a geometric intersection node with the previously snapped edge, the `MapMatcher` rejects it, forcing continued tracking along the current edge until a valid topological intersection is reached.

---

## 5. Frontend Navigation Control

### 5.1. Multi-Floor Navigation Manager
- Slices the unified A* response array into `FloorSegment` arrays, split precisely at `STAIRCASE` or `LIFT` transition nodes.
- Exposes `transitionToNextFloor(newFloorId)` which pops the current segment and switches the UI to the next SVG map.

### 5.2. Predictive Voice Engine (Hysteresis)
- Dynamically scales trigger windows based on `effectiveSpeed` (metres per second).
- Executes 3 rigid phases to prevent voice-overlap spam:
  1. **PREVIEW**: "In X metres, turn left" (triggered at `previewTimeSeconds`).
  2. **PREPARATION**: "In X metres, bear left" (triggered at `preparationTimeSeconds`).
  3. **IMMEDIATE**: "Turn left now" (triggered at `immediateTimeSeconds`).
