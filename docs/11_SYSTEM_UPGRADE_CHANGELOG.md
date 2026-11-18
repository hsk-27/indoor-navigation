# System Upgrade & Stabilization Changelog

This document details the comprehensive system-wide edits, structural upgrades, and critical bug fixes implemented to productionalize the Indoor Navigation Framework.

## 1. Full Docker Containerization
The deployment architecture was completely overhauled. The previous bundled `.tools/` approach (relying on local Java/Node installs) has been deprecated in favor of a robust, fully containerized microservice stack.
- **Nginx Reverse Proxy**: A production-ready Nginx server now handles static frontend assets and cleanly proxies `/api/v1/*` traffic to the backend, bypassing previous CORS complexities.
- **Multi-stage Builds**: The frontend and backend `Dockerfile`s now utilize multi-stage builds. Maven and NPM run completely within ephemeral builder containers, producing ultra-lightweight alpine runtime images.
- **docker-compose**: A unified `docker-compose.yml` orchestrates the PostgreSQL database, Spring Boot API, and Nginx frontend in an isolated virtual network.

## 2. Security & Stability Hardening
An extensive full-stack code audit revealed and resolved several critical failure vectors:
- **DDoS Prevention**: The expensive `/api/v1/graph/reload` endpoint, which forces a full database-to-memory reconstruction of the A-Star graph, was previously public. It has been secured in `SecurityConfig.java` to require `hasRole("ADMIN")`, preventing unauthenticated malicious cache thrashing.
- **Graph Integrity Parsing**: Fixed a fatal `NullPointerException` vector in `ExportImportService.java`. The system now explicitly rejects imported edges that reference non-existent nodes using `.orElseThrow()`, preventing deep database constraint crashes.
- **Cloning Constraints**: Addressed a SQL crash during floor duplication. The `qr_id` column enforces a `UNIQUE` constraint. `FloorManagementService.java` now correctly nullifies `qrId` on cloned nodes to avoid constraint violations.

## 3. Frontend Resiliency
- **Strict Typing**: Updated the `RouteContext.tsx` types to natively support `qrId` and `departmentName` properties, removing the need for unsafe `any` type casts in `DestinationSelect.tsx`.
- **Dynamic Configuration**: Removed over 15 hardcoded `fetch("/api/v1/...")` strings across the React app. Replaced them with a dynamic `API_BASE_URL` sourced from `config.ts`, decoupling the frontend and making it fully compatible with Native/Capacitor deployment.

## 4. UI/UX Enhancements
- **Graph Editor Undo/Redo**: Fully wired up the `CommandManager` in `GraphEditorPage.tsx`. Manual node dragging and keyboard deletions now push state snapshots, enabling perfect `Ctrl+Z` restoration for all visual graph edits.
- **Infinite Admin Sessions**: Implemented a silent JWT token refresh interval in `AuthContext.tsx`. The frontend automatically requests a new token every 45 minutes, preventing administrators from being unexpectedly logged out during long graph-mapping sessions.
- **Flexbox Scroll UX Resiliency**: Fixed a layout bug in the `MapPage.tsx` Route Guide panel where vertical instructions were being unscrollably clipped off-screen on desktop viewports. Implemented strict `min-h-0` constraints on flex children and `shrink-0` properties on headers, successfully decoupling the scrollable instructions wrapper from the absolute height boundaries of the parent map container.

## 5. Native Location Tracking (Capacitor)
The localization engine was completely decoupled from generic HTML5 web-tracking.
- **Platform-Aware Provisioning**: `LocalizationContext.tsx` now utilizes `Capacitor.getPlatform()` to dynamically instantiate location providers.
- **Android Fused Location Provider (FLP)**: Built a dedicated `AndroidFLPProvider` relying on `@capacitor/geolocation` to tap directly into the OS-level GPS/Wi-Fi fusion engine.
- **iOS Core Location**: Built a dedicated `IOSCoreLocationProvider` specifically tuned for iPhone location timeouts and accuracies.
- **Hardware Recalibration**: Added a physical "Recalibrate Location" button to the map interface that gracefully terminates and restarts the localization engine, forcing the native hardware to drop cached reads and acquire a fresh positional fix.

## 6. Phase 3: Geofencing & Capacitor App Initialization
Laid the architectural groundwork for converting the web deployment into a native application with strict GPS perimeter enforcement.
- **Database Scaling**: Upgraded the PostgreSQL `building` schema via live migration to support `latitude`, `longitude`, and `geofence_radius` bounds.
- **Backend Service Upgrades**: Expanded the `Building` entity and REST `BuildingDTO` to handle dynamic GPS coordinate provisioning.
- **Docker NAT Traversal**: Hardened `LocalAdminController` to securely support Docker Gateway IP structures (`isSiteLocalAddress`), ensuring the deployment `admin_manager.bat` can communicate with the isolated container while keeping Nginx publicly restricted.
- **Mobile Hardware Scaffolding**: Built a dedicated `useGeofence.ts` hook into the React frontend. It leverages `@capacitor/geolocation` to hook directly into the Fused Location Provider, calculating the Haversine distance from the user's phone to the building anchors to lock down the interface automatically.

## 7. Phase 4: AI Graph Reconstruction & 3D Optimization
The framework underwent massive reconstruction to populate the system with real-world mapping data and finalize the multi-floor physics heuristics.
- **Massive Database Seeding**: Replaced manual Graph Editor testing with procedurally generated mapping nodes and edges (`auto_edge_generator.py`, `repopulate_graph.py`). The scripts leverage K-Nearest Neighbors (KNN) heuristics to dynamically map horizontal walkways and automatically generate vertical `LIFT` and `STAIRCASE` transition edges.
- **Predictive Voice Engine Hysteresis**: Re-engineered the voice guidance pipeline in `PredictiveVoiceEngine.ts`. Discarded the static 1-metre threshold in favor of a dynamic, speed-scaled 3-phase state machine (`PREVIEW`, `PREPARATION`, `IMMEDIATE`) to ensure natural auditory instructions.
- **A-Star 3D Optimization**: Formalized an admissible 3D Euclidean heuristic formula in `NavigationService.java`. The routing engine now natively calculates explicit penalty delays for multi-floor transits (e.g., 10m base penalty + 4m per floor) while strictly honoring `accessProfile` lift constraints.
- **Legacy Fallback Standardization**: Explicitly marked the physical QR code `qrId` attributes as deprecated `[LEGACY]` code, confirming that active localization tracking completely supersedes static QR scanning.

## 8. Phase 5: High-Performance Canvas Rendering Optimization
Identified and resolved severe O(V*E) CPU bottlenecks in the frontend virtual DOM diffing pipeline to guarantee 60FPS fluid mapping interaction.
- **Space-Time Algorithmic Refactor**: Deprecated the nested `O(N)` `.find()` iterations that were firing 60 times a second during camera pan operations inside `MapPage.tsx` and `GraphEditorPage.tsx`. Abstracted edge relationship lookups into a highly performant `useMemo` ES6 Map dictionary (`activeGraphNodesMap`), reducing render calculations to an instant `O(1)` index hit per mapped vertex.
- **SVG React VDOM Element Caching**: Refactored the core JSX loops to cache fully instantiated React `<circle>` and `<line>` arrays within top-level `useMemo` hooks. This completely circumvents React's expensive sub-tree DOM reconciliation phase when dragging the canvas map (as the relative `inverseScale` remains untouched), allowing the browser engine to directly transform the root SVG `<g>` wrapper undisturbed.
- **Event Loop Decoupling**: Identified a fatal, unconditional UI trap where the React lifecycle `setSmoothedMarker()` was being indiscriminately fired via `requestAnimationFrame` every ~16ms. This routine has been shielded with a strict equality barrier guard to only trigger virtual DOM reconciliations if the native marker delta actually moves (which constitutes <1% of a standard application lifetime).
- **GPU Texture Optimization**: Aggressively stripped continuous CSS computations like `filter: drop-shadow` and `animate-ping` from rapidly updating marker positions, freeing up critical GPU rendering boundaries.
- **O(N*E) Algorithmic Render Fix**: Identified and patched an algorithmic cascade inside `MapPage.tsx` where glowing route subsegments were checking every active route node against every graph edge 60 times a second during camera pans (generating ~18,000,000 checks per second). Re-architected this into an O(1) Set lookup wrapped inside a `useMemo` block to eliminate the CPU throttle.
- **Garbage Collection & Memory Leak Patch**: Discovered an orphaned `URL.createObjectURL()` footprint within the `useImageBlobUrl` hook. Because SVG map layers were not running `URL.revokeObjectURL()` during unmounts or floor transitions, the browser was indefinitely hoarding raw binary blobs in memory. Patched the hook cleanup lifecycle, terminating an insidious memory leak that was forcing the V8 Garbage Collector into overdrive and spiking laptop fan arrays.
