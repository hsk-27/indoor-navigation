# Final Map UX & Documentation Audit Report

## 1. Map Panels Modified
- **Route Guide (Left Sidebar):** Converted from a fixed panel to a fully collapsible slide-out panel (using Framer Motion). Added a floating "Menu/Route" icon to recover the panel when minimized, exposing the entire left side of the map.
  - **Scroll Resiliency:** Resolved an overflowing layout constraint bug where long route instructions were visually clipped off the bottom edge on desktop. Enforced strict Flexbox `min-h-0` parameters on the content wrapper and `shrink-0` on the header to ensure the inner container scrolls dependably within absolute bounds.
- **Location Status (Right Sidebar):** Converted from a fixed panel to a fully collapsible slide-out panel. Added a floating "Crosshair/Location" icon to recover the panel when minimized, exposing the entire right side of the map.
- **Floor Selector:** Converted the persistent bottom-left row of buttons into a compact, expanding drop-up selector (e.g., "Floor 1 ▼"), significantly reducing visual footprint until interaction is required.

## 2. Files Modified
- `frontend/src/pages/MapPage.tsx`
- `README.md`
- `MAP_COORDINATE_AND_CALIBRATION.md` (Newly created)

## 3. Documentation Updated
- **`README.md`:** Removed all legacy references to scanning "room QR codes" or "node anchors". The documentation now explicitly states there is exactly **one** application-entry deployment QR code, and that live localization is achieved via native OS location services (FLP/Core Location) and PDR/IMU.
- **`MAP_COORDINATE_AND_CALIBRATION.md`:** Created to thoroughly document the geographic calibration pipeline, the unverified nature of the SVG scale, and the distinction between topological, SVG, and physical coordinates.

## 4. Current Coordinate Architecture
The architecture operates across three domains:
1. **Physical / Geographic (Lat/Lon):** Absolute positioning from the device's FLP/Core Location.
2. **SVG / Map Space (Pixels):** Arbitrary vector coordinates that dictate visual layout.
3. **Topological / Graph Space:** Node/edge logic used by the A* routing engine.

**Standardized Calibration Status:**
- **Calibration mechanism**: IMPLEMENTED.
- **Physical calibration values for the current maps**: NOT YET VALIDATED.

**Therefore:**
- the software supports conversion to metres;
- the current maps cannot yet be assumed to be metrically accurate;
- current distance thresholds/voice lookaheads should be treated as calibration-dependent.

## 5. What is Already Implemented
- Single-QR architecture (deployment entry point only).
- Device-level localization integration (FLP/Core Location).
- Pedestrian Dead Reckoning (PDR) / IMU fusion logic.
- Graph-based pathfinding across multiple floors using transition nodes (Stairs/Lifts).
- `GraphProjector` class capable of mapping physical coordinates to SVG pixels.
- Manual floor-selection fallback due to GPS altitude limitations.

## 6. What Remains to be Calibrated
- **Geographic Reference Matrix:** We need to capture at least four (preferably more) physical Lat/Lon reference points and their corresponding SVG (X/Y) pixels to calculate an affine transformation matrix (translation, rotation, scaling, skew).
- **Universal Scale:** We must determine the physical-to-pixel ratio for each floor map. 
- **Distance Thresholds:** Current checkpoint tolerances, voice guidance lookaheads, and distance counters are operating on uncalibrated SVG unit distances, meaning they behave inconsistently depending on how large the SVG file was drawn.

## 7. Contradictions Discovered
- **QR Architecture Contradiction:** The `README.md` previously claimed users "scan a physical QR code placed on a door to instantly localize themselves" and provided URL examples like `/?qr=<NODE_ID>`. This directly contradicted the newly deployed single-QR application-entry architecture. This has been corrected.

## 8. Build/Test Result
- Frontend TypeScript compiled successfully without JSX errors.
- Framer Motion animation logic tested for fluid panel state transitions.
- Map panning and zooming remain completely functional when panels are collapsed or expanded.
