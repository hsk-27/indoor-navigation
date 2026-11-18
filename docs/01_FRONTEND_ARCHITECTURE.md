# 01. Frontend Architecture

## 1. Core Stack
The frontend is a highly performant Single Page Application (SPA) designed to function both in mobile web browsers and wrapped natively via Capacitor.
- **Framework**: React 18
- **Build Tool**: Vite (configured for rapid HMR and optimized production builds)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion (utilized heavily for map panel drawer interactions)
- **Native Wrapper**: Capacitor (Android/iOS integration for deep sensor access)

## 2. Global State Management (React Context)
Instead of relying on Redux, the application uses distinct, modular React Contexts to prevent unnecessary global re-renders:

### 2.1. `AuthContext.tsx`
- **Responsibility**: Manages JWT tokens, login state, and role-based access control (`ROLE_ADMIN`).
- **Persistence**: Tokens are stored in `localStorage` and injected via an Axios interceptor (`ApiService.ts`) into every outgoing backend request.

### 2.2. `LocalizationContext.tsx`
- **Responsibility**: Houses the high-frequency Cartesian state `(x, y)` of the user on the current map.
- **Mechanism**: Decoupled from the main React rendering tree where possible to prevent the entire map from re-rendering at 60Hz. Only the "Blue Dot" SVG marker listens to this context directly.

### 2.3. MapPage Local State (Access Profiles)
- **Responsibility**: While generic state goes into Contexts, `MapPage.tsx` directly owns the active `accessProfile` state (`STUDENT` vs `AUTHORIZED_LIFT_USER`) and triggers route recalculation instantly when toggled.

## 3. Map Rendering Paradigm (SVG vs WebGL)
The framework strictly prohibits the use of HTML5 `<canvas>` or WebGL for floor plan rendering. 
- **Methodology**: Floor plans are raw SVG files (`GHRCE ground floor.svg`, etc.) dynamically requested from the backend. They are converted to Object URLs via `useImageBlobUrl.ts` (which strictly implements `URL.revokeObjectURL()` during component cleanup to prevent binary caching memory leaks).
- **Dynamic Styling**: Active route paths are conditionally colored based on the `accessProfile` (Student routes render with Blue palettes, Authorized routes render with Emerald palettes) directly via React state interpolation on SVG `<polyline>` elements.
- **Performance**: Panning and zooming are handled entirely via CSS transforms (`transform: translate(x, y) scale(z)`) applied to a container `<div>` wrapping the SVG. This offloads the rendering matrix to the mobile device's GPU, guaranteeing smooth 60fps performance without JavaScript overhead.
- **Algorithmic VDOM Caching**: To prevent `O(N*E)` CPU thrashing when the dynamic navigation camera pans at 60Hz, static layers (such as map vertices, edges, and active route subsegments) are stringently cached inside React `useMemo` hooks backed by `O(1)` ES6 Set/Map lookup tables. The rendering loop only forces VDOM updates on the `(x, y)` coordinate of the user's localized marker, never the surrounding SVG pathing.
- **Interactivity**: Because SVGs consist of DOM elements, interactive nodes (rooms, corridors) have React `onClick` event listeners directly attached to their `<path>` or `<circle>` elements.

## 4. Capacitor Native Integration
When deployed as an APK, Capacitor intercepts hardware requests that normal browsers block:
- **Sensors**: Raw Accelerometer and Gyroscope polling at fixed intervals.
- **Location (Phase 3 Geofencing)**: Access to Android Fused Location Provider (FLP) or iOS CoreLocation for initial floor determination and building proximity checks. The `useGeofence.ts` hook enforces the GPS boundaries via the Haversine distance formula against the backend's `building` coordinates. The `AndroidManifest.xml` natively specifies `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION`.
- **Configuration**: `CapacitorServerConfig.tsx` acts as an interception layer on boot. It synchronizes with the Admin Deployment Settings/runtime configurations to seamlessly re-bind the internal deployment URL without requiring an app store update or user intervention.
