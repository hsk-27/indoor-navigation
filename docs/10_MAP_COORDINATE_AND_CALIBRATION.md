# Map Coordinates and Geographic Calibration

## 1. Coordinate Systems
The Indoor Navigation Framework operates across three distinct but interconnected coordinate models. It is critical to understand the distinction to avoid navigation and mapping errors.

### Geographic Coordinates
- **Source:** Android Fused Location Provider (FLP) or iOS Core Location.
- **Format:** Latitude / Longitude (WGS84).
- **Purpose:** Absolute physical positioning on the Earth's surface. Used as the ground truth before projection into the building's local map space.

### SVG Coordinate Model
- **Source:** The `viewBox` and internal dimensions of each floor's SVG file.
- **Format:** Local pixel (px) or arbitrary vector units.
- **Purpose:** Defines the geometry, layout, and visual rendering of the floor plan- **Scale Factor (`pixelsPerMeter`)**: The SVG coordinate space is intrinsically tied to real-world dimensions via the `pixelsPerMeter` property stored in `GraphMetadata`. This allows the application to perform accurate physical calculations (like predicting voice guidance times using $d = v \cdot t$) directly derived from pixel distances.
- **Dynamic Translation**: Codebases (`GraphTransform.ts`) natively execute `pixelsToMetres(pixels)` and `metresToPixels(metres)` using this scale factor, making distances represented on the UI accurate in real-world metres, provided the administrator calibrates the floor correctly upon uploading the SVG.

### 2.2. Mathematical Transformation
- **Important Constraint:** Edge weights (distances) are calculated using Pythagorean distance in the SVG coordinate space, but they are instantly translated into metres using `pixelsPerMeter` before feeding into predictive systems or the UI.

## 2. Current Localization Pipeline
The current implementation determines user location using the following pipeline:
1. **Device Sensors:** FLP / Core Location attempts to acquire Geographic Coordinates.
2. **GraphProjector:** Translates physical Lat/Lon coordinates into local SVG Coordinates for rendering on the screen. *(Note: This projection is only accurate if geographic calibration has been completed. See Section 8).*
3. **Floor Selection:** Due to inherent GPS altitude inaccuracies, the user must **manually** specify their current floor.
4. **PDR/IMU Refinement:** As the user walks, Pedestrian Dead Reckoning (PDR) tracks relative movement (heading and step distance) to refine the position between absolute GPS updates, resulting in the final `NavigationPosition`.

## 3. Current QR Architecture
- **Single Deployment QR:** There is EXACTLY ONE QR code used by this system. It is scanned by the user upon arrival to access the web application.
- **No Room/Node QRs:** There are NO room-specific or node-specific QR codes used as localization anchors. The system does NOT localize by having the user scan a QR code on a door.

## 4. Geographic Calibration Requirements
To enable accurate projection from Geographic Coordinates to SVG Coordinates (and vice versa), each floor map must undergo geographic calibration.

### Four-Point Reference Concept
The practical architecture for geographic calibration requires:
1. At least four corresponding reference points (e.g., four building corners are a good practical choice).
2. Their precise geographic coordinates (Lat/Lon).
3. Their corresponding SVG coordinates (X/Y).
-> These combined inputs generate the calibration transformation matrix.

### Validation-Point Concept
While four points are sufficient to calculate the initial transformation, additional known points throughout the interior should be recorded to validate the matrix and account for map distortions or projection errors.

### Known Limitations & Database Values
**Standardized Calibration Status:**
- **Calibration mechanism**: IMPLEMENTED.
- **Physical calibration values for the current maps**: NOT YET VALIDATED.

**Therefore:**
- the software supports conversion to metres;
- the current maps cannot yet be assumed to be metrically accurate;
- current distance thresholds/voice lookaheads should be treated as calibration-dependent.

- **Floor Discrepancies:** Different floors may have different SVG `viewBox` extents. Do not assume a calibration matrix for Floor 1 applies to Floor 2.
- **GPS Indoor Accuracy:** Even with perfect calibration, GPS signals penetrate poorly indoors. The system is designed for **approximate** initial positioning, not room-level sub-metre accuracy.

## 5. Current vs Planned Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Single Entry QR Code | **Implemented** | Replaces old node-anchor QR system. |
| Graph-based Routing | **Implemented** | Edge weights based on SVG distance. |
| PDR/IMU Integration | **Implemented** | Handles continuous relative movement. |
| Manual Floor Selection | **Implemented** | Required due to GPS altitude limitations. |
| Geographic Calibration Code | **Implemented** | The codebase contains `GraphProjector` and affine transformation logic. |
| Geographic Calibration Values | *Unverified* | Mathematical transformation matrices and `pixelsPerMeter` scaling values for the specific SVG maps have not yet been validated with physical reference points on-site. |
| Metre-Accurate Thresholds | **Implemented** | UI displays "m" and calculates predictive triggers based on metres, but accuracy depends entirely on the aforementioned unverified calibration values being corrected. |
