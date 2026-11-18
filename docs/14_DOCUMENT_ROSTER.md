# 14. Document Roster

This directory contains the exhaustive architectural and technical documentation for the Indoor Navigation Framework.

1. **[01_FRONTEND_ARCHITECTURE.md](01_FRONTEND_ARCHITECTURE.md)** `[CURRENT]`
   - Capacitor setup, React Context state management, and SVG rendering principles.
2. **[02_BACKEND_ARCHITECTURE.md](02_BACKEND_ARCHITECTURE.md)** `[CURRENT]`
   - Spring Boot structural layout, JWT security filter chains, and Service-layer paradigms.
3. **[03_DATABASE_SCHEMA.md](03_DATABASE_SCHEMA.md)** `[CURRENT]`
   - PostgreSQL 3NF normalized tables (Floor, Node, Edge).
4. **[04_ROUTING_ENGINE.md](04_ROUTING_ENGINE.md)** `[CURRENT]`
   - Floor-biased weighted A* graph processing logic and thread-safe cache reloads.
5. **[05_LOCALIZATION_PIPELINE.md](05_LOCALIZATION_PIPELINE.md)** `[CURRENT]`
   - Absolute Capacitor anchors (FLP) + relative Dead Reckoning (PDR) + Map Snapping logic.
6. **[06_NAVIGATION_SYSTEM.md](06_NAVIGATION_SYSTEM.md)** `[CURRENT]`
   - Multi-floor segment arrays, manual floor selection transitions, and Predictive Voice Engine phases.
7. **[07_GRAPH_EDITOR_MANUAL.md](07_GRAPH_EDITOR_MANUAL.md)** `[CURRENT]`
   - Visual SVG node manipulation (`CORRIDOR_BEND`), graph-context calibration, and Validation Engine checks.
8. **[08_API_REFERENCE.md](08_API_REFERENCE.md)** `[CURRENT]`
   - Complete JSON request/response payloads for the protected Admin and public Navigation endpoints.
9. **[09_DEPLOYMENT_GUIDE.md](09_DEPLOYMENT_GUIDE.md)** `[CURRENT]`
   - Docker Compose instructions and the absolute zero-infrastructure Single-QR (`app_link.png`) methodology.
10. **[10_MAP_COORDINATE_AND_CALIBRATION.md](10_MAP_COORDINATE_AND_CALIBRATION.md)** `[CURRENT]`
    - Details the distinct coordinate systems, dynamic affine transformations (`pixelsPerMeter`), and scale limits.
11. **[11_SYSTEM_UPGRADE_CHANGELOG.md](11_SYSTEM_UPGRADE_CHANGELOG.md)** `[HISTORICAL]`
    - Log of major architectural upgrades. Deprecated legacy methodologies are documented here.
12. **[12_MAP_UX_DETAILS.md](12_MAP_UX_DETAILS.md)** `[CURRENT]`
    - UI components like blue dot map-follow, floor selector, and dynamic routing panels.
13. **[13_AI_RECONSTRUCTION_MANUAL.md](13_AI_RECONSTRUCTION_MANUAL.md)** `[SUPPORTING]`
    - Designed strictly for Large Language Models (LLMs). Contains absolute technical constraints and mathematical invariants.
14. **[14_DOCUMENT_ROSTER.md](14_DOCUMENT_ROSTER.md)** `[SUPPORTING]`
    - This document directory index.
15. **[15_SECURITY_AUDIT.md](15_SECURITY_AUDIT.md)** `[CURRENT]`
    - Factual security posture highlighting protected mutations vs intentional public mapping endpoints.
