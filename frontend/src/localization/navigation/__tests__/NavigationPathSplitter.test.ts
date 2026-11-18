import { NavigationPathSplitter } from '../NavigationPathSplitter';

function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(`❌ FAILED: ${msg}`);
        process.exit(1);
    }
    console.log(`✅ PASSED: ${msg}`);
}

console.log("\n=======================================================");
console.log("  NAVIGATION PATH SPLITTER TEST SUITE");
console.log("=======================================================\n");

const nodes = [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 100, y: 0 },
    { id: 3, x: 100, y: 100 },
    { id: 4, x: 200, y: 100 }
];

const edges = [
    { id: 101, sourceId: 1, destinationId: 2 },
    { id: 102, sourceId: 2, destinationId: 3 },
    { id: 103, sourceId: 3, destinationId: 4 }
];

// 1. User on first edge at (50, 0)
const res1 = NavigationPathSplitter.splitPathAtPosition(nodes, 101, { x: 50, y: 0 }, edges);
assert(res1.completedPoints.length === 2, "Completed points has node 1 and user pos");
assert(res1.completedPoints[1].x === 50 && res1.completedPoints[1].y === 0, "Completed ends at user pos");
assert(res1.remainingPoints[0].x === 50 && res1.remainingPoints[0].y === 0, "Remaining starts at user pos");
assert(res1.remainingPoints.length === 4, "Remaining has user pos, node 2, node 3, node 4");

// 2. User on middle edge at (100, 50)
const res2 = NavigationPathSplitter.splitPathAtPosition(nodes, 102, { x: 100, y: 50 }, edges);
assert(res2.completedPoints.length === 3, "Completed has node 1, node 2, and user pos");
assert(res2.remainingPoints.length === 3, "Remaining has user pos, node 3, node 4");

// 3. User with no edge match returns full remaining
const res3 = NavigationPathSplitter.splitPathAtPosition(nodes, 999, { x: 500, y: 500 }, edges);
assert(res3.completedPoints.length === 0, "No completed points on non-matching edge");
assert(res3.remainingPoints.length === 4, "All nodes in remaining");

console.log("\n=======================================================");
console.log("  ✨ ALL NAVIGATION PATH SPLITTER TESTS PASSED! ✨");
console.log("=======================================================\n");
