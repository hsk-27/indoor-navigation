# 07. Graph Editor & Validation Manual

The Graph Editor is a highly sophisticated, web-based visual administration panel built entirely in React. It allows authorized users (`ROLE_ADMIN`) to physically draw, connect, and manipulate the navigational graph directly on top of the SVG floor plans.

## 1. Core Editor Components

### 1.1. `SVGViewer.tsx` (Editor Mode)
The same `SVGViewer` used in the user-facing navigation is reused here, but with extended event listeners.
- **Node Creation Mode**: The UI features independent tools to create destinations (`+D`), structural connectors (`+C`), and specialized bend nodes (`CORRIDOR_BEND`). Selecting a tool and clicking on the raw SVG captures the exact `(x, y)` coordinate matrix and instantly creates the precise backend-compatible node type, skipping manual dropdown assignments.
- **CORRIDOR_BEND Mapping**: The `CORRIDOR_BEND` node type is critical for Predictive Voice Guidance. It explicitly signals to the turn-analyzer that the path is physically curving, allowing the engine to calculate angle-of-entry vs angle-of-exit.
- **Node Selection**: Clicking an existing `<circle>` selects it for properties editing.
- **Edge Creation**: Selecting Node A, holding a modifier, and selecting Node B draws a `<line>` element between them, establishing a topological edge.

### 1.2. Map Calibration Context
A vital architectural feature of the Graph Editor is its dual role as the Calibration UI. 
- Administrators can actively view and manipulate the `GraphMetadata` calibration properties (such as `pixelsPerMeter` scaling and rotation matrices) *directly in the context of the active graph layout*.
- This allows the administrator to visually confirm that physical Lat/Lon reference coordinates accurately project onto the correct SVG nodes (e.g., verifying that a known GPS anchor perfectly maps onto the front door node in the editor) before hitting save.

### 1.3. `CommandManager.ts` & History Snapshots
The editor implements the **Command Design Pattern** utilizing full state snapshots to support infinite Undo/Redo capabilities via `Ctrl+Z`.
- Whenever a user physically drags a node across the canvas, or uses the `Delete` key to mass-remove selected edges, the system captures the `[dragStartNodes, dragStartEdges]` pre-mutation state.
- This state is pushed into the `CommandManager.pushSnapshot()` method.
- The manager maintains a `history` stack and a `future` stack.
- This ensures that accidental structural deletions or errant node drags can be instantly reversed without corrupting the active database staging array.

## 2. Validation Engine

Before the frontend allows an administrator to click "Save to Database," the entire localized graph is passed through the `ValidationEngine`.

### 2.1. Structural Rules
1. **Orphan Detection**: A graph node that has exactly zero edges connected to it is an orphan. The A* engine cannot reach it. The validator flags it in red.
2. **Self-Loop Detection**: If an edge's `source_id` is identical to its `destination_id`, it is flagged as a fatal error.
3. **Duplicate Edge Detection**: If two edges exist connecting Node A to Node B in the exact same direction, one is flagged as redundant.

### 2.2. Cross-Floor Verification
- Edges that are explicitly flagged as `is_floor_transition = true` must strictly terminate at a node typed as `STAIRCASE` or `LIFT` on the destination floor. 
- Connecting a `DESTINATION` room on Floor 1 to a `DESTINATION` room on Floor 2 directly is physically impossible and is flagged as a fatal validation error.

## 3. Database Synchronization
When the "Save" action is triggered:
1. The frontend batches all new nodes, deleted edges, and updated coordinates into a single JSON payload (`AdminGraphRequest`).
2. The payload is sent to the backend `/api/v1/admin/graph/batch` endpoint.
3. The backend executes the changes inside a single PostgreSQL Transaction.
4. If successful, the backend triggers the `GraphUpdatedEvent`, firing the zero-downtime cache reload (see `04_ROUTING_ENGINE.md`).
