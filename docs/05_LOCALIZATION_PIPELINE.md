# 05. Localization Pipeline & Sensor Fusion

Indoor environments block GPS signals and cause extreme multi-path interference. To navigate indoors without expensive hardware beacons, we utilize a 4-stage Sensor Fusion pipeline executing at 60Hz.

**Standardized Calibration Status:**
- **Calibration mechanism**: IMPLEMENTED.
- **Physical calibration values for the current maps**: NOT YET VALIDATED.

**Therefore:**
- the software supports conversion to metres;
- the current maps cannot yet be assumed to be metrically accurate;
- current distance thresholds/voice lookaheads should be treated as calibration-dependent.

## 1. Absolute Anchoring (Capacitor Native OS)
The foundation of the pipeline relies on acquiring the absolute geographic position (WGS84 Latitude/Longitude) using native OS providers, which bypass standard HTML5 limits.
- **Android Fused Location Provider (FLP)** & **iOS Core Location**: Dynamically fuses GPS, Wi-Fi triangulation, and cellular towers to pinpoint the user inside concrete structures.
- **Floor Selection**: Because indoor altitude/Z-axis inference is notoriously unreliable, the user manually provides their current floor, giving the system the exact architectural context.

## 2. Map Calibration (Geographic to SVG)
Once the absolute geographic anchor is acquired, the system must project it onto the arbitrary 2D vector map.
- The system pulls the per-floor `GraphMetadata` calibration properties (which can be actively adjusted by administrators within the graph-editor context).
- It executes an affine transformation matrix (translation, rotation, scale) to convert the Lat/Lon anchor into a raw `(x, y)` SVG pixel coordinate on the current floor plan.

## 3. High-Frequency Micro-Tracking (PDR)
Absolute FLP anchors update slowly (typically 1Hz). To achieve fluid 60fps movement on the UI, the pipeline fills the gaps using the phone's Inertial Measurement Unit (IMU).
- **Step Detector**: Monitors the Z-axis accelerometer to identify human footsteps.
- **Heading Estimator**: Fuses the gyroscope and magnetometer.
- **Velocity Calculation**: Estimates raw `(x, y)` Cartesian drift. This relative movement is added to the absolute FLP anchor position.

## 4. Topology Snapping (GraphProjector & Snapper)
Raw coordinates drift rapidly. We must "snap" them to the known graph layout.
- **GraphProjector (Pure Geometry)**: Identifies all known graph edges within a 150-unit radius and calculates orthogonal geometric projections.
- **GraphSnapper (Decision Matrix)**: Scores the candidate edges based on distance penalty, heading angle (e.g., walking perpendicular to a wall heavily penalizes the edge), topological continuity (giving massive bonuses to edges connected to the previously known edge), and route bias (magnetic pull toward the active A* path).
- **Temporal Consistency (MapMatcher)**: Forcefully rejects any snapped edge that does not topologically connect to the user's previous known node, preventing impossible "wall clipping" or teleportation through parallel corridors.
