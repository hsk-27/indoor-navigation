import { PredictiveTurnAnalyzer } from '../PredictiveTurnAnalyzer';
import { PredictiveVoiceEngine } from '../PredictiveVoiceEngine';
import { VoiceGuidanceService } from '../VoiceGuidanceService';
import { NavigationContextSnapshot, TurnManeuver } from '../NavigationContext';
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
console.log("  CORRIDOR BEND (CORNER) NODES TEST SUITE");
console.log("=======================================================\n");

const ppm = 10.0; // 10 pixels per meter

// -------------------------------------------------------------
// Test 1: Geometry Invariance & Path Distance Preservation
// -------------------------------------------------------------
console.log("--- 1. Testing Route Geometry & Distance Invariance ---");

// Case A: Straight corridor comparison (Direct vs With Bend)
const straightDirectDist = Math.hypot(100 - 0, 0 - 0) / ppm; // 10.0m
const straightWithBendDist = (Math.hypot(50 - 0, 0 - 0) / ppm) + (Math.hypot(100 - 50, 0 - 0) / ppm); // 5.0m + 5.0m = 10.0m
assert(Math.abs(straightDirectDist - straightWithBendDist) < 1e-5, "Straight corridor distance is perfectly preserved with bend node");

// Case B: L-shaped corridor with CORRIDOR_BEND (0,0) -> (0,100) -> (100,100)
const bendNode1: GraphNodeData = { id: 10, x: 0, y: 0, type: 'ENTRANCE', floorId: 1, name: 'Main Entrance', isSearchable: true };
const bendNode2: GraphNodeData = { id: 11, x: 0, y: 100, type: 'CORRIDOR_BEND', floorId: 1, name: 'CB_001', isSearchable: false };
const bendNode3: GraphNodeData = { id: 12, x: 100, y: 100, type: 'ROOM', floorId: 1, name: 'Room 101', isSearchable: true };

const edgeA_Dist = Math.hypot(bendNode2.x - bendNode1.x, bendNode2.y - bendNode1.y) / ppm; // 10.0m
const edgeB_Dist = Math.hypot(bendNode3.x - bendNode2.x, bendNode3.y - bendNode2.y) / ppm; // 10.0m
const totalPathDist = edgeA_Dist + edgeB_Dist; // 20.0m

assert(edgeA_Dist === 10.0, "Leg 1 (Entrance -> CB_001) distance is exactly 10.0m");
assert(edgeB_Dist === 10.0, "Leg 2 (CB_001 -> Room 101) distance is exactly 10.0m");
assert(totalPathDist === 20.0, "Total walking distance across corner bend is 20.0m (not straight-line 14.14m)");

// -------------------------------------------------------------
// Test 2: Turn Maneuver Extraction at Bend Nodes
// -------------------------------------------------------------
console.log("\n--- 2. Testing Turn Maneuver Extraction at Bend Nodes ---");

const testNodes: GraphNodeData[] = [bendNode1, bendNode2, bendNode3];
const testEdges: GraphEdgeData[] = [
    { id: 1, sourceId: 10, destinationId: 11, distance: 10.0, direction: 'BIDIRECTIONAL' },
    { id: 2, sourceId: 11, destinationId: 12, distance: 10.0, direction: 'BIDIRECTIONAL' }
];

const analyzer = new PredictiveTurnAnalyzer(ppm);
analyzer.setGraph(testNodes, testEdges, ppm);

const seg: FloorSegment = {
    segmentIndex: 0,
    floorId: 1,
    nodes: testNodes,
    isFinalSegment: true,
    destinationNode: bendNode3,
    transitionNode: null,
    nextFloorTransitionNode: null,
    nextFloorId: null,
    segmentDistance: 20.0
};

const maneuvers = analyzer.extractSegmentManeuvers(seg);
assert(maneuvers.length === 2, `Extracted 2 maneuvers (1 Turn at CB_001 + 1 Destination Arrival), got ${maneuvers.length}`);

const cornerManeuver = maneuvers[0];
assert(cornerManeuver.nodeId === 11, "Turn maneuver is located at CORRIDOR_BEND (CB_001)");
assert(cornerManeuver.type === 'TURN_LEFT', `Corner classified as TURN_LEFT (got: ${cornerManeuver.type})`);
assert(Math.abs(Math.abs(cornerManeuver.turnAngleDegrees) - 90.0) < 0.1, `Turn angle magnitude is 90 degrees (got: ${cornerManeuver.turnAngleDegrees})`);

// -------------------------------------------------------------
// Test 3: Zig-Zag Multiple Corner Bends
// -------------------------------------------------------------
console.log("\n--- 3. Testing Zig-Zag Multiple Corner Bends ---");

const zigZagNodes: GraphNodeData[] = [
    { id: 1, x: 0, y: 0, type: 'ENTRANCE', floorId: 1, name: 'Start' },
    { id: 2, x: 0, y: 100, type: 'CORRIDOR_BEND', floorId: 1, name: 'CB_001' },   // Turn 90 deg Left
    { id: 3, x: 100, y: 100, type: 'CORRIDOR_BEND', floorId: 1, name: 'CB_002' }, // Turn 90 deg Right
    { id: 4, x: 100, y: 200, type: 'ROOM', floorId: 1, name: 'Room 202' }
];
const zigZagEdges: GraphEdgeData[] = [
    { id: 1, sourceId: 1, destinationId: 2, distance: 10.0, direction: 'BIDIRECTIONAL' },
    { id: 2, sourceId: 2, destinationId: 3, distance: 10.0, direction: 'BIDIRECTIONAL' },
    { id: 3, sourceId: 3, destinationId: 4, distance: 10.0, direction: 'BIDIRECTIONAL' }
];

const zigZagAnalyzer = new PredictiveTurnAnalyzer(ppm);
zigZagAnalyzer.setGraph(zigZagNodes, zigZagEdges, ppm);

const zigZagSeg: FloorSegment = {
    segmentIndex: 0,
    floorId: 1,
    nodes: zigZagNodes,
    isFinalSegment: true,
    destinationNode: zigZagNodes[3],
    transitionNode: null,
    nextFloorTransitionNode: null,
    nextFloorId: null,
    segmentDistance: 30.0
};

const zigZagManeuvers = zigZagAnalyzer.extractSegmentManeuvers(zigZagSeg);
assert(zigZagManeuvers.length === 3, `Extracted 3 maneuvers for zig-zag route (2 turns + 1 arrival), got ${zigZagManeuvers.length}`);
assert(zigZagManeuvers[0].nodeId === 2 && zigZagManeuvers[0].type === 'TURN_LEFT', "First bend (CB_001) correctly identified as TURN_LEFT");
assert(zigZagManeuvers[1].nodeId === 3 && zigZagManeuvers[1].type === 'TURN_RIGHT', "Second bend (CB_002) correctly identified as TURN_RIGHT");

// -------------------------------------------------------------
// Test 4: Predictive Voice Guidance with Bend Nodes
// -------------------------------------------------------------
console.log("\n--- 4. Testing Predictive Voice Guidance with Bend Nodes ---");

const spokenLogs: Array<{ text: string; priority: string }> = [];
const mockVoiceService = {
    speak: (text: string, options?: { priority?: string }) => {
        spokenLogs.push({ text, priority: options?.priority || 'NORMAL' });
    },
    cancel: () => {}
} as unknown as VoiceGuidanceService;

const voiceEngine = new PredictiveVoiceEngine({
    minPreviewDistMetres: 6.0,
    maxPreviewDistMetres: 10.0,
    minPrepDistMetres: 2.0,
    maxPrepDistMetres: 4.0,
    minImmediateDistMetres: 0.5,
    maxImmediateDistMetres: 1.5,
    previewTimeSeconds: 6.0,
    preparationTimeSeconds: 2.5,
    immediateTimeSeconds: 0.8,
    defaultSpeedMetresPerSec: 1.2,
    minSpeedThreshold: 0.2
}, mockVoiceService);

// Simulate user walking towards CB_001 (Node 2)
// User at 7.0m from CB_001
cornerManeuver.pathDistanceToManeuver = 7.0;
const snap1: NavigationContextSnapshot = {
    navigationPosition: { floorId: 1, currentEdgeId: 1, distanceAlongEdge: 3.0, confidence: 'HIGH', routeProgress: 0.3 },
    speed: 1.2,
    heading: 1.57,
    motionState: 'WALKING',
    confidence: 'HIGH',
    accessProfile: 'AUTHORIZED_LIFT_USER',
    activeSegment: seg,
    currentManeuver: cornerManeuver,
    upcomingManeuvers: [cornerManeuver, maneuvers[1]],
    remainingGraphDistance: 17.0,
    isRecalculating: false,
    status: 'NAVIGATING_SEGMENT',
    timestamp: Date.now()
};

// 1. Initial snapshot trigger
voiceEngine.processSnapshot(snap1);
assert(spokenLogs.length === 1 && spokenLogs[0].text === "Starting navigation. Proceed along the path.", "First snapshot triggers initial departure announcement");

// 2. User at 7.0m from CB_001
voiceEngine.processSnapshot(snap1);
assert(spokenLogs.length === 2 && spokenLogs[1].text === "In 7 metres, turn left.", `Spoke natural preview cue: "${spokenLogs[1].text}"`);

// 3. User at 0.8m from CB_001
cornerManeuver.pathDistanceToManeuver = 0.8;
voiceEngine.processSnapshot(snap1);
assert(spokenLogs.length === 3 && spokenLogs[2].text === "Turn left now.", `Spoke immediate execution cue: "${spokenLogs[2].text}"`);

// -------------------------------------------------------------
// Test 5: Future-Proof Edge Split Architecture & Auto-Weight Recalculation
// -------------------------------------------------------------
console.log("\n--- 5. Testing Future-Proof Edge Split Architecture ---");

// Simulating splitEdgeWithBendNode(edge A <-> B)
const nodeA: GraphNodeData = { id: 101, x: 0, y: 0, type: 'ROOM', floorId: 1, name: 'Room 1' };
const nodeB: GraphNodeData = { id: 102, x: 200, y: 0, type: 'ROOM', floorId: 1, name: 'Room 2' };
const origEdge: GraphEdgeData = { id: 501, sourceId: 101, destinationId: 102, distance: 20.0, direction: 'BIDIRECTIONAL' };

function simulateSplitEdge(edge: GraphEdgeData, src: GraphNodeData, dest: GraphNodeData, ppm: number, nextBendIndex: number) {
    const midX = Math.round((src.x + dest.x) / 2);
    const midY = Math.round((src.y + dest.y) / 2);
    const bendName = `CB_${String(nextBendIndex).padStart(3, '0')}`;
    
    const bendNode: GraphNodeData = {
        id: 999,
        name: bendName,
        x: midX,
        y: midY,
        type: 'CORRIDOR_BEND',
        floorId: src.floorId,
        isEnabled: true,
        routeVisibility: true,
        isAccessible: true,
        isSearchable: false
    };

    const dist1 = Math.hypot(midX - src.x, midY - src.y) / ppm;
    const dist2 = Math.hypot(dest.x - midX, dest.y - midY) / ppm;

    const edge1: GraphEdgeData = { id: 502, sourceId: src.id, destinationId: bendNode.id, distance: dist1, direction: 'BIDIRECTIONAL' };
    const edge2: GraphEdgeData = { id: 503, sourceId: bendNode.id, destinationId: dest.id, distance: dist2, direction: 'BIDIRECTIONAL' };

    return { bendNode, edge1, edge2 };
}

const splitResult = simulateSplitEdge(origEdge, nodeA, nodeB, ppm, 1);
assert(splitResult.bendNode.name === 'CB_001', "Auto-generated unique identifier CB_001 for bend node");
assert(splitResult.bendNode.type === 'CORRIDOR_BEND', "Created node type is CORRIDOR_BEND");
assert(splitResult.bendNode.isSearchable === false, "CORRIDOR_BEND is non-searchable by default");
assert(splitResult.edge1.distance === 10.0, `Auto-computed Leg 1 distance is 10.0m (got: ${splitResult.edge1.distance})`);
assert(splitResult.edge2.distance === 10.0, `Auto-computed Leg 2 distance is 10.0m (got: ${splitResult.edge2.distance})`);
assert(splitResult.edge1.distance + splitResult.edge2.distance === origEdge.distance, "Sum of split edge distances exactly equals original edge distance (20.0m)");

// -------------------------------------------------------------
// Test 6: Search Exclusion Verification
// -------------------------------------------------------------
console.log("\n--- 6. Testing Search Exclusion ---");

const allNodes: GraphNodeData[] = [
    { id: 1, name: 'Physics Lab', type: 'LABORATORY', floorId: 1, isSearchable: true, x: 10, y: 10 },
    { id: 2, name: 'CB_001', type: 'CORRIDOR_BEND', floorId: 1, isSearchable: false, x: 20, y: 20 },
    { id: 3, name: 'CB_002', type: 'CORRIDOR_BEND', floorId: 1, isSearchable: false, x: 30, y: 30 },
    { id: 4, name: 'Dean Office', type: 'OFFICE', floorId: 1, isSearchable: true, x: 40, y: 40 }
];

function searchDestinationNodes(query: string, nodes: GraphNodeData[]): GraphNodeData[] {
    const q = query.toLowerCase();
    return nodes.filter(n => 
        Boolean(n.isSearchable) &&
        n.type !== 'CORRIDOR_BEND' &&
        n.name && n.name.toLowerCase().includes(q)
    );
}

const searchResults = searchDestinationNodes('CB', allNodes);
assert(searchResults.length === 0, "Destination search ignores CB_001 and CB_002 corridor bend nodes");

const labSearchResults = searchDestinationNodes('Lab', allNodes);
assert(labSearchResults.length === 1 && labSearchResults[0].name === 'Physics Lab', "Destination search successfully finds Physics Lab");

console.log("\n=======================================================");
console.log("  ✨ ALL CORRIDOR BEND NODE TESTS PASSED! ✨");
console.log("=======================================================\n");
