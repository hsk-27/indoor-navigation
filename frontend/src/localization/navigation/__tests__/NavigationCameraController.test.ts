import { NavigationCameraController } from '../NavigationCameraController';

function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${msg}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${msg}`);
}

console.log("\n=======================================================");
console.log("  DYNAMIC NAVIGATION CAMERA CONTROLLER TEST SUITE");
console.log("=======================================================\n");

const viewport = { width: 400, height: 800 };

// --- 1. Testing State-Aware Dynamic Zoom ---
console.log("--- 1. Testing State-Aware Dynamic Zoom ---");
const camera = new NavigationCameraController({ x: 0, y: 0, scale: 1.0 });

// Normal Walking
camera.updateTarget({
    markerX: 200,
    markerY: 200,
    heading: 0,
    speed: 1.1,
    confidence: 'HIGH',
    hasActiveRoute: true,
    viewport
});
for (let i = 0; i < 50; i++) camera.tick();
const normalZoom = camera.getTransform().scale;
assert(normalZoom >= 1.3 && normalZoom <= 1.4, `Normal walking zoom is medium (~1.35x), got: ${normalZoom.toFixed(2)}`);

// Turn Approach (e.g. 5m to turn)
camera.updateTarget({
    markerX: 200,
    markerY: 200,
    heading: 0,
    speed: 1.1,
    confidence: 'HIGH',
    distanceToNextManeuver: 5.0,
    isApproachingTurn: true,
    hasActiveRoute: true,
    viewport
});
for (let i = 0; i < 50; i++) camera.tick();
const turnZoom = camera.getTransform().scale;
assert(turnZoom >= 1.8 && turnZoom <= 1.9, `Approaching turn zooms in (>1.8x), got: ${turnZoom.toFixed(2)}`);

// Destination Arrival (e.g. 3m to dest)
camera.updateTarget({
    markerX: 200,
    markerY: 200,
    heading: 0,
    speed: 0.8,
    confidence: 'HIGH',
    remainingGraphDistance: 3.0,
    isApproachingDestination: true,
    hasActiveRoute: true,
    viewport
});
for (let i = 0; i < 50; i++) camera.tick();
const destZoom = camera.getTransform().scale;
assert(destZoom >= 1.9 && destZoom <= 2.0, `Approaching destination zooms in strongly (~1.95x), got: ${destZoom.toFixed(2)}`);

// Low Confidence Zoom Out
camera.updateTarget({
    markerX: 200,
    markerY: 200,
    heading: 0,
    speed: 1.1,
    confidence: 'LOW',
    hasActiveRoute: true,
    viewport
});
for (let i = 0; i < 50; i++) camera.tick();
const lowConfZoom = camera.getTransform().scale;
assert(lowConfZoom <= 1.05, `Low confidence slightly zooms out for context (<1.05x), got: ${lowConfZoom.toFixed(2)}`);

// --- 2. Testing Lower-Middle Screen Positioning ---
console.log("\n--- 2. Testing Lower-Middle Screen Positioning ---");
const freshCamera = new NavigationCameraController({ x: 0, y: 0, scale: 1.0 }, { lookaheadDistanceMeters: 0 });
freshCamera.recenter({
    markerX: 500,
    markerY: 500,
    heading: 0,
    confidence: 'HIGH',
    hasActiveRoute: true,
    viewport
});
for (let i = 0; i < 60; i++) {
    freshCamera.updateTarget({
        markerX: 500,
        markerY: 500,
        heading: 0,
        confidence: 'HIGH',
        hasActiveRoute: true,
        viewport
    });
    freshCamera.tick();
}
const transform = freshCamera.getTransform();
// Screen target Y for marker with scale S is: screenY = markerY * scale + transform.y
const screenMarkerY = 500 * transform.scale + transform.y;
// Lower-middle of height 800 is around 520 (65%)
const ratio = screenMarkerY / viewport.height;
assert(ratio >= 0.63 && ratio <= 0.67, `User marker anchored near lower-middle of screen (~65%), got: ${(ratio * 100).toFixed(1)}%`);

// --- 3. Testing Manual Pan & Re-Center Interaction ---
console.log("\n--- 3. Testing Manual Pan & Re-Center Interaction ---");
assert(camera.isFollowing() === true, "Camera initially in auto-follow mode");

// User starts manual pan
camera.setUserInteracting(true);
assert(camera.isFollowing() === false, "Camera follow suspended when user drags canvas");

// Manually move camera
camera.setManualTransform({ x: -1000, y: -1000, scale: 0.5 });
assert(camera.getTransform().x === -1000, "Manual transform applied");

// User clicks Re-center
camera.recenter({
    markerX: 500,
    markerY: 500,
    heading: 0,
    confidence: 'HIGH',
    hasActiveRoute: true,
    viewport
});
assert(camera.isFollowing() === true, "Auto-following resumed on recenter");

// Lerps back towards marker
for (let i = 0; i < 60; i++) camera.tick();
assert(camera.getTransform().x > -800, `Camera smoothly glided back towards marker, got: ${camera.getTransform().x.toFixed(1)}`);

console.log("\n=======================================================");
console.log("  ✨ ALL NAVIGATION CAMERA TESTS PASSED! ✨");
console.log("=======================================================\n");
