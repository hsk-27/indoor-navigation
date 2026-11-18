import { MultiFloorNavigationManager } from '../MultiFloorNavigationManager.js';
import { GraphNodeData, GraphEdgeData } from '../../types/GraphTypes.js';
import { NavigationPosition, EstimatedCartesianPosition } from '../../LocalizationState.js';

// Simple assert helper
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("\n=== Starting Multi-Floor Navigation State Machine Tests ===\n");

// Mock Graph Data: Floor 0 (Basement/Ground) -> Floor 1
const mockNodes: GraphNodeData[] = [
    { id: 1, x: 100, y: 100, type: 'BUILDING_ENTRANCE', floorId: 0, name: 'Ground Entrance' },
    { id: 2, x: 200, y: 100, type: 'CORRIDOR', floorId: 0, name: 'Ground Corridor' },
    { id: 3, x: 300, y: 100, type: 'STAIRCASE', floorId: 0, name: 'Staircase Ground' },
    { id: 4, x: 300, y: 100, type: 'STAIRCASE', floorId: 1, name: 'Staircase First Floor' },
    { id: 5, x: 400, y: 100, type: 'CORRIDOR', floorId: 1, name: 'First Floor Corridor' },
    { id: 6, x: 500, y: 100, type: 'ROOM', floorId: 1, name: 'Classroom 101' },
    // Alternative staircase on Floor 0 & 1
    { id: 7, x: 100, y: 300, type: 'STAIRCASE', floorId: 0, name: 'Staircase West Ground' },
    { id: 8, x: 100, y: 300, type: 'STAIRCASE', floorId: 1, name: 'Staircase West First Floor' }
];

const mockEdges: GraphEdgeData[] = [
    { id: 101, sourceId: 1, destinationId: 2, distance: 8 },
    { id: 102, sourceId: 2, destinationId: 3, distance: 8 },
    { id: 103, sourceId: 3, destinationId: 4, distance: 5 }, // vertical connection
    { id: 104, sourceId: 4, destinationId: 5, distance: 8 },
    { id: 105, sourceId: 5, destinationId: 6, distance: 8 },
    // Alternative path edges
    { id: 106, sourceId: 1, destinationId: 7, distance: 16 },
    { id: 107, sourceId: 7, destinationId: 8, distance: 5 },
    { id: 108, sourceId: 8, destinationId: 6, distance: 20 }
];

const manager = new MultiFloorNavigationManager({
    consecutiveDeviationsThreshold: 3,
    deviationToleranceMetres: 6.0,
    checkpointArrivalRadiusMetres: 2.0,
    pixelsPerMeter: 12.5
});
manager.setGraph(mockNodes, mockEdges);

// 1. Test Route Segmentation
const completeAStarPath = [
    mockNodes[0], // Node 1 (Floor 0)
    mockNodes[1], // Node 2 (Floor 0)
    mockNodes[2], // Node 3 (Floor 0, Staircase)
    mockNodes[3], // Node 4 (Floor 1, Staircase)
    mockNodes[4], // Node 5 (Floor 1)
    mockNodes[5]  // Node 6 (Floor 1, Destination)
];

manager.initializeRoute(completeAStarPath, 6);
const segments = manager.getAllSegments();

assert(segments.length === 2, "Path is partitioned into exactly 2 floor segments");
assert(segments[0].floorId === 0, "Segment 1 is on Floor 0");
assert(segments[0].transitionNode?.id === 3, "Segment 1 transition checkpoint is Node 3 (Staircase Ground)");
assert(segments[0].nextFloorId === 1, "Segment 1 targets Floor 1");
assert(!segments[0].isFinalSegment, "Segment 1 is not final segment");
assert(segments[1].floorId === 1, "Segment 2 is on Floor 1");
assert(segments[1].isFinalSegment, "Segment 2 is final segment");
assert(segments[1].destinationNode.id === 6, "Segment 2 destination is Node 6");

// 2. Test Checkpoint-Locked Progress
const userNavPosAtStart: NavigationPosition = {
    floorId: 0,
    currentEdgeId: 101,
    distanceAlongEdge: 0,
    confidence: 'VERY_HIGH',
    routeProgress: 0
};
const userPhysicalPos: EstimatedCartesianPosition = {
    x: 100, y: 100, floorId: 0, accuracy: 2, timestamp: Date.now()
};

let res = manager.processPositionUpdate(userNavPosAtStart, userPhysicalPos);
assert(res.action === 'CONTINUE', "Normal navigation continues towards transition node");
assert(manager.getStatus() === 'NAVIGATING_SEGMENT', "Status remains NAVIGATING_SEGMENT");

// 3. Test Checkpoint Arrival
const userAtStaircase: EstimatedCartesianPosition = {
    x: 295, y: 100, floorId: 0, accuracy: 1, timestamp: Date.now()
};
const userNavAtStaircase: NavigationPosition = {
    floorId: 0,
    currentEdgeId: 102,
    distanceAlongEdge: 95,
    confidence: 'VERY_HIGH',
    routeProgress: 0.95
};
res = manager.processPositionUpdate(userNavAtStaircase, userAtStaircase);
assert(res.action === 'CHECKPOINT_REACHED', "Checkpoint arrival detected when within 2m radius");
assert(res.targetFloorId === 1, "Checkpoint indicates next floor is Floor 1");
assert(manager.getStatus() === 'AT_CHECKPOINT', "Status transitioned to AT_CHECKPOINT");

// 4. Test Transition to Next Floor
manager.transitionToNextFloor(1);
assert(manager.getCurrentSegment()?.floorId === 1, "Current segment advanced to Floor 1");
assert(manager.getStatus() === 'NAVIGATING_SEGMENT', "Status reset to NAVIGATING_SEGMENT on Floor 1");

// 5. Test Configurable Consecutive Deviation Detection
manager.initializeRoute(completeAStarPath, 6);

// Initial baseline at starting node (100, 100)
manager.processPositionUpdate(
    { floorId: 0, currentEdgeId: 101, distanceAlongEdge: 0, confidence: 'HIGH', routeProgress: 0 },
    { x: 100, y: 100, floorId: 0, accuracy: 2, timestamp: Date.now() }
);
// Step 1: User moves away (90, 100) -> (count = 1)
manager.processPositionUpdate(
    { floorId: 0, currentEdgeId: null, distanceAlongEdge: 0, confidence: 'HIGH', routeProgress: 0 },
    { x: 90, y: 100, floorId: 0, accuracy: 2, timestamp: Date.now() }
);
// Step 2: Distance increases again (50, 100) -> (count = 2)
manager.processPositionUpdate(
    { floorId: 0, currentEdgeId: null, distanceAlongEdge: 0, confidence: 'HIGH', routeProgress: 0 },
    { x: 50, y: 100, floorId: 0, accuracy: 2, timestamp: Date.now() }
);
// Step 3: Distance increases again and exceeds tolerance (10, 100) -> (count = 3 and delta > 6m)
res = manager.processPositionUpdate(
    { floorId: 0, currentEdgeId: null, distanceAlongEdge: 0, confidence: 'HIGH', routeProgress: 0 },
    { x: 10, y: 100, floorId: 0, accuracy: 2, timestamp: Date.now() }
);

assert(res.action === 'TRIGGER_RECALCULATION', "Triggered recalculation after 3 consecutive deviations exceeding tolerance");
assert(manager.getStatus() === 'OFF_CHECKPOINT_DEVIATING', "Status is OFF_CHECKPOINT_DEVIATING");

// 6. Test Recalculation Handler: Same Checkpoint vs Better Alternative Checkpoint
// Case A: Recalculated path still uses Staircase Ground (Node 3) -> instruct return
const sameCheckpointRecalcPath = completeAStarPath;
const sameResult = manager.handleRecalculatedRoute(sameCheckpointRecalcPath);
assert(!sameResult.switchedCheckpoint, "Did not switch checkpoint when original remains optimal");
assert(sameResult.message.includes("return"), "Instruction advises user to return to assigned staircase");

// Case B: Recalculated path now uses Staircase West (Node 7 & 8) -> switch seamlessly
const altCheckpointRecalcPath = [
    mockNodes[6], // Node 7 (Staircase West Ground)
    mockNodes[7], // Node 8 (Staircase West First Floor)
    mockNodes[5]  // Node 6 (Destination)
];
const altResult = manager.handleRecalculatedRoute(altCheckpointRecalcPath);
assert(altResult.switchedCheckpoint, "Seamlessly switched checkpoint when alternative is better");
assert(manager.getCurrentSegment()?.transitionNode?.id === 7, "New active checkpoint is Node 7");

// 7. Test Multi-Stage Low-Confidence Recovery
// Subcase A: Position close to active floor edge -> Contextual Auto-Recovery without popup
const lowConfNearEdge: NavigationPosition = {
    floorId: 0,
    currentEdgeId: 106,
    distanceAlongEdge: 5,
    confidence: 'LOW',
    routeProgress: 0.2
};
res = manager.processPositionUpdate(lowConfNearEdge, { x: 100, y: 290, floorId: 0, accuracy: 25, timestamp: Date.now() });
assert(res.action === 'CONTINUE', "Auto-recovered without popup when position unambiguously aligns with active floor edge");

// Subcase B: Ambiguous / far off -> Triggers manual floor confirmation
const lowConfAmbiguous: NavigationPosition = {
    floorId: 0,
    currentEdgeId: null,
    distanceAlongEdge: 0,
    confidence: 'LOW',
    routeProgress: 0
};
res = manager.processPositionUpdate(lowConfAmbiguous, { x: 999, y: 999, floorId: 0, accuracy: 50, timestamp: Date.now() });
assert(res.action === 'REQUIRE_MANUAL_FLOOR', "Triggers manual floor confirmation when confidence is LOW and position is ambiguous");
assert(manager.getStatus() === 'LOW_CONFIDENCE_PAUSED', "Status is LOW_CONFIDENCE_PAUSED");

// Resume from manual floor
manager.resumeFromManualFloorSelection(0);
assert(manager.getStatus() === 'NAVIGATING_SEGMENT', "Resumed navigation on selected floor");

console.log("\n✨ ALL MULTI-FLOOR NAVIGATION TESTS PASSED SUCCESSFULLY! ✨\n");
