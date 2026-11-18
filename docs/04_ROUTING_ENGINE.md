# 04. Routing Engine (A* Algorithm)

The backend routing engine is designed for extreme throughput. Rather than executing recursive SQL queries on the Postgres database (e.g., using `WITH RECURSIVE` or PostGIS), the engine operates 100% in system memory.

## 1. Graph Loading & Caching

### 1.1. `GraphLoader`
On system boot, the `GraphLoader` pulls all nodes and edges from the database and constructs the `RoutingGraph`. During construction, it actively sanitizes the data:
- Strips out self-looping edges (where `source_id == destination_id`).
- Warns of orphaned nodes.
- Excludes any node or edge where `is_enabled == false`.

### 1.2. Zero-Downtime Reloads
The `GraphCacheService` maintains the graph via an `AtomicReference<RoutingGraph>`.
- When an Administrator uses the visual graph editor to add a new corridor, they click "Save".
- The backend writes the new nodes/edges to PostgreSQL and fires a `GraphUpdatedEvent`.
- A background thread pulls the updated graph from the DB, builds a *new* `RoutingGraph` instance, and then executes an atomic swap on the `AtomicReference`. 
- **Result**: No locks are used during read operations. Active users querying the A* engine experience zero milliseconds of blocked downtime during admin updates.

## 2. A* Implementation Details

The `NavigationServiceImpl` executes a floor-biased weighted A* search algorithm using a Min-Heap (`PriorityQueue`).

**Standardized Calibration Status:**
- **Calibration mechanism**: IMPLEMENTED.
- **Physical calibration values for the current maps**: NOT YET VALIDATED.

**Therefore:**
- the software supports conversion to metres;
- the current maps cannot yet be assumed to be metrically accurate;
- current distance thresholds/voice lookaheads should be treated as calibration-dependent.

### 2.1. Cost Functions & Unit Invariant
- **Unit Invariant**: Both $G$-Cost and $H$-Cost operate exclusively in **SVG pixels**. This ensures $F$-Cost = $G$ + $H$ is dimensionally consistent. The final `totalDistance` returned in `RouteResponse` is converted from pixels to physical metres using the destination floor's `pixelsPerMeter` (PPM) at output time only.
- **$G$-Cost**: The exact accumulated `edge.distance` (SVG pixels) from the start node to the current node.
- **$H$-Cost (Heuristic)**: The estimated remaining pixel distance to the destination.
- **$F$-Cost**: $G$-Cost + $H$-Cost. The Priority Queue always expands the node with the lowest $F$-Cost.

### 2.2. The Admissible 3D Euclidean Heuristic
Indoor routing presents a unique geometric challenge: verticality.
The standard 2D Euclidean heuristic (`Math.sqrt(dx^2 + dy^2)`) completely fails when dealing with multiple floors, as a destination located on Floor 4 might appear closer in 2D space than a staircase on Floor 1.

Our custom heuristic formula handles this by calculating a 3D Euclidean distance entirely in pixel-space:
```java
double horizontalPixelDist = Math.hypot(a.getX() - b.getX(), a.getY() - b.getY());

int floorDiff = Math.abs(a.getFloorLevel() - b.getFloorLevel());
if (floorDiff == 0) {
    return horizontalPixelDist; // Same floor: tightest admissible estimate
}

// Cross-floor: convert vertical metres to pixels, then combine via Pythagoras
double ppm = graph.getPpm(a.getFloorLevel());
double verticalMetres = Math.max(10.0, floorDiff * 4.0);
double verticalPixels = verticalMetres * ppm;

return Math.sqrt(horizontalPixelDist * horizontalPixelDist + verticalPixels * verticalPixels);
```

**Admissibility & Optimality**
Unlike arbitrary massive floor penalties that render A* inadmissible and break the shortest-path guarantee, this approach guarantees the heuristic never overestimates the true remaining cost. By keeping everything in pixel-space, fScore is dimensionally consistent with gScore, ensuring mathematically optimal 3D pathfinding across large multi-floor graphs.

### 2.3. Access Profiles & Policy Enforcement
The routing engine natively understands building access policies through the `accessProfile` parameter.
The A* search actively drops invalid topological connections during neighbor expansion based on the user's active profile:
- **`STUDENT`**: If a neighboring node (or the current node) is explicitly typed as a `LIFT`, the engine ignores it entirely. This guarantees that student pathways mathematically cannot traverse restricted elevators, defaulting cleanly to staircases or throwing an `InvalidRouteException` if no valid path exists.
- **`AUTHORIZED_LIFT_USER`**: The engine considers all valid topological transitions (`STAIRCASE` and `LIFT`), evaluating them purely on physical geometric distance ($G$-Cost + $H$-Cost) to yield the optimal route.
