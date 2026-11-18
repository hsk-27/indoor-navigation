import { PredictiveTurnAnalyzer } from '../PredictiveTurnAnalyzer';
import { PredictiveVoiceEngine } from '../PredictiveVoiceEngine';
import { VoiceGuidanceService } from '../VoiceGuidanceService';
import { NavigationContext, TurnManeuver } from '../NavigationContext';
import { FloorSegment } from '../MultiFloorNavigationManager';
import { GraphNodeData, GraphEdgeData } from '../../types/GraphTypes';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        throw new Error(message);
    }
    console.log(`✅ PASSED: ${message}`);
}

console.log("\n=======================================================");
console.log("  PREDICTIVE VOICE GUIDANCE & PRIORITY TEST SUITE");
console.log("=======================================================\n");

// Mock Nodes & Edges: L-shaped corridor with a 90° right turn, then a staircase to Floor 1
const testNodes: GraphNodeData[] = [
    { id: 1, x: 0, y: 0, type: 'CORRIDOR', floorId: 0, name: 'Start' },
    { id: 2, x: 0, y: 100, type: 'CORRIDOR', floorId: 0, name: 'Turn Corner' },     // Turn 90° right
    { id: 3, x: 100, y: 100, type: 'STAIRCASE', floorId: 0, name: 'Stairs Floor 0' }, // Checkpoint
    { id: 4, x: 100, y: 100, type: 'STAIRCASE', floorId: 1, name: 'Stairs Floor 1' }, // Landing
    { id: 5, x: 200, y: 100, type: 'ROOM', floorId: 1, name: 'Lab 101' }               // Destination
];

const testEdges: GraphEdgeData[] = [
    { id: 101, sourceId: 1, destinationId: 2, distance: 10.0, direction: 'BIDIRECTIONAL' }, // 10 meters (100px / 10ppm)
    { id: 102, sourceId: 2, destinationId: 3, distance: 10.0, direction: 'BIDIRECTIONAL' }, // 10 meters
    { id: 103, sourceId: 3, destinationId: 4, distance: 3.0, direction: 'BIDIRECTIONAL' },  // Vertical stairs
    { id: 104, sourceId: 4, destinationId: 5, distance: 10.0, direction: 'BIDIRECTIONAL' }  // 10 meters
];

const ppm = 10.0; // 10 pixels per meter

// -------------------------------------------------------------
// Test 1: Turn Angle & Maneuver Classification
// -------------------------------------------------------------
console.log("--- 1. Testing Maneuver & Turn Angle Classification ---");
const analyzer = new PredictiveTurnAnalyzer(ppm);
analyzer.setGraph(testNodes, testEdges, ppm);

const seg0: FloorSegment = {
    segmentIndex: 0,
    floorId: 0,
    nodes: [testNodes[0], testNodes[1], testNodes[2]],
    transitionNode: testNodes[2],
    nextFloorTransitionNode: testNodes[3],
    nextFloorId: 1,
    isFinalSegment: false,
    segmentDistance: 20.0,
    destinationNode: testNodes[2]
};

const maneuvers = analyzer.extractSegmentManeuvers(seg0);
assert(maneuvers.length === 2, "Segment 0 extracts 2 maneuvers (Turn + Staircase Transition)");
assert(maneuvers[0].type === 'TURN_LEFT' || maneuvers[0].type === 'TURN_RIGHT', `Intermediate maneuver classified as turn (got: ${maneuvers[0].type})`);
assert(maneuvers[0].nodeId === 2, "Turn maneuver located at Node 2 (corner)");
assert(maneuvers[1].type === 'STAIRCASE_TRANSITION', "Segment terminus is STAIRCASE_TRANSITION");
assert(maneuvers[1].targetFloorId === 1, "Staircase target is Floor 1");

// -------------------------------------------------------------
// Test 2: Graph Path Distance Calculation (vs Euclidean)
// -------------------------------------------------------------
console.log("\n--- 2. Testing Graph Path Distance Calculation (No Euclidean Short-Circuit) ---");
// At user position at (0, 0) on Edge 101:
// Straight-line Euclidean distance to corner Node 2 (0, 100) is 10m.
// Straight-line Euclidean distance to Staircase Node 3 (100, 100) is sqrt(10^2 + 10^2) = 14.14m.
// True Walking Graph Path distance to Staircase Node 3 is 10m + 10m = 20.0m.

const distAnalysis = analyzer.updateManeuverGraphDistances(
    { floorId: 0, currentEdgeId: 101, distanceAlongEdge: 0, confidence: 'HIGH', routeProgress: 0 },
    seg0,
    maneuvers
);

assert(distAnalysis.remainingGraphDistance === 20.0, `Total remaining graph distance is exactly 20.0m (got: ${distAnalysis.remainingGraphDistance}m)`);
assert(maneuvers[0].pathDistanceToManeuver === 10.0, `Graph distance to corner turn is 10.0m (got: ${maneuvers[0].pathDistanceToManeuver}m)`);
assert(maneuvers[1].pathDistanceToManeuver === 20.0, `Graph distance to staircase is 20.0m, NOT 14.14m Euclidean (got: ${maneuvers[1].pathDistanceToManeuver}m)`);

// Move user 4 meters along Edge 101 (distanceAlongEdge = 40px)
const distAnalysis2 = analyzer.updateManeuverGraphDistances(
    { floorId: 0, currentEdgeId: 101, distanceAlongEdge: 40, confidence: 'HIGH', routeProgress: 0.2 },
    seg0,
    maneuvers
);
assert(distAnalysis2.remainingGraphDistance === 16.0, `Remaining graph distance after 4m progress is 16.0m (got: ${distAnalysis2.remainingGraphDistance}m)`);
assert(maneuvers[0].pathDistanceToManeuver === 6.0, `Remaining distance to turn is 6.0m (got: ${maneuvers[0].pathDistanceToManeuver}m)`);
assert(maneuvers[1].pathDistanceToManeuver === 16.0, `Remaining distance to staircase is 16.0m (got: ${maneuvers[1].pathDistanceToManeuver}m)`);

// -------------------------------------------------------------
// Test 3: Dynamic Time-Based Thresholds Scaled by Walking Speed
// -------------------------------------------------------------
console.log("\n--- 3. Testing Dynamic Speed Scaling & Hysteresis ---");
const voiceService = VoiceGuidanceService.getInstance();
const voiceEngine = new PredictiveVoiceEngine({
    previewTimeSeconds: 6.0,      // at 1.2 m/s -> 7.2m
    preparationTimeSeconds: 2.5,  // at 1.2 m/s -> 3.0m
    immediateTimeSeconds: 0.8,    // at 1.2 m/s -> 0.96m (min clamped to 0.8m)
    defaultSpeedMetresPerSec: 1.2
}, voiceService);

const navContext = new NavigationContext();
navContext.update({
    activeSegment: seg0,
    upcomingManeuvers: maneuvers,
    currentManeuver: maneuvers[0],
    confidence: 'HIGH',
    speed: 1.2,
    motionState: 'WALKING'
});

// Step 3a: Distance is 9.0m (> 7.2m preview) -> No turn speech yet
maneuvers[0].pathDistanceToManeuver = 9.0;
voiceEngine.processSnapshot(navContext.getSnapshot());
assert(!maneuvers[0].announcedPhases.has('PREVIEW'), "No preview speech at 9.0m");

// Step 3b: User moves to 7.0m (within 7.2m preview window) -> PREVIEW fires
maneuvers[0].pathDistanceToManeuver = 7.0;
voiceEngine.processSnapshot(navContext.getSnapshot());
assert(maneuvers[0].announcedPhases.has('PREVIEW'), "PREVIEW phase triggered at 7.0m");
const spoken1 = voiceService.getLastSpokenText();
assert(spoken1.includes("turn") || spoken1.includes("In 7 metres"), `Spoke preview text: "${spoken1}"`);

// Step 3c: Hysteresis test: sensor jitter oscillates between 7.0m and 7.3m -> Should NOT re-fire
maneuvers[0].pathDistanceToManeuver = 7.3;
voiceEngine.processSnapshot(navContext.getSnapshot());
maneuvers[0].pathDistanceToManeuver = 6.9;
voiceEngine.processSnapshot(navContext.getSnapshot());
assert(maneuvers[0].announcedPhases.size === 1, "Hysteresis latched: PREVIEW only fired once despite jitter");

// Step 3d: User reaches 2.8m (within 3.0m preparation window) -> PREPARATION fires
maneuvers[0].pathDistanceToManeuver = 2.8;
voiceEngine.processSnapshot(navContext.getSnapshot());
assert(maneuvers[0].announcedPhases.has('PREPARATION'), "PREPARATION phase triggered at 2.8m");

// Step 3e: User reaches 0.7m (within immediate window) -> IMMEDIATE fires
maneuvers[0].pathDistanceToManeuver = 0.7;
voiceEngine.processSnapshot(navContext.getSnapshot());
assert(maneuvers[0].announcedPhases.has('IMMEDIATE'), "IMMEDIATE phase triggered at 0.7m");
const spokenImmediate = voiceService.getLastSpokenText();
assert(spokenImmediate.includes("now") || spokenImmediate.includes("Turn"), `Spoke immediate text: "${spokenImmediate}"`);

// -------------------------------------------------------------
// Test 4: Speech Priority Preemption & Intelligent Suppression
// -------------------------------------------------------------
console.log("\n--- 4. Testing Speech Priorities, Preemption & Suppression ---");
// Speak a low priority preview
voiceService.speak("In 10 metres, continue straight.", { priority: 'LOW' });
assert(voiceService.getLastSpokenText() === "In 10 metres, continue straight.", "Low priority message accepted");

// High priority message (Recalculating route) must immediately preempt
voiceEngine.announceRecalculation();
assert(voiceService.getLastSpokenText() === "Recalculating your route.", "HIGH priority recalculation preempted speech");

// Low confidence suppression
navContext.update({ confidence: 'LOW' });
maneuvers[1].pathDistanceToManeuver = 2.0; // In preparation zone for staircase
voiceEngine.processSnapshot(navContext.getSnapshot());
assert(!maneuvers[1].announcedPhases.has('PREPARATION'), "Turn instruction suppressed while confidence is LOW");

// Confidence recovery announcement
navContext.update({ confidence: 'HIGH' });
voiceEngine.processSnapshot(navContext.getSnapshot());
assert(voiceService.getLastSpokenText() === "Navigation resumed.", "Announced 'Navigation resumed.' upon confidence recovery");

console.log("\n=======================================================");
console.log("  ✨ ALL PREDICTIVE VOICE GUIDANCE TESTS PASSED! ✨");
console.log("=======================================================\n");
