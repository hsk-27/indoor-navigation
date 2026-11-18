import { GraphNodeData, GraphEdgeData } from '../types/GraphTypes';
import { NavigationPosition } from '../LocalizationState';
import { FloorSegment } from './MultiFloorNavigationManager';
import { TurnManeuver, ManeuverType, LateralSide } from './NavigationContext';

export class PredictiveTurnAnalyzer {
    private nodes: Map<number, GraphNodeData> = new Map();
    private edges: GraphEdgeData[] = [];
    private pixelsPerMeter: number = 1.0;

    constructor(pixelsPerMeter: number = 1.0) {
        this.pixelsPerMeter = pixelsPerMeter > 0 ? pixelsPerMeter : 1.0;
    }

    public setGraph(nodes: GraphNodeData[], edges: GraphEdgeData[], pixelsPerMeter?: number): void {
        this.nodes = new Map(nodes.map(n => [n.id, n]));
        this.edges = edges;
        if (pixelsPerMeter && pixelsPerMeter > 0) {
            this.pixelsPerMeter = pixelsPerMeter;
        }
    }

    public setPixelsPerMeter(ppm: number): void {
        if (ppm > 0) this.pixelsPerMeter = ppm;
    }

    /**
     * Extracts all key decision maneuvers (turns, transition checkpoints, destination arrival)
     * along the given floor segment.
     */
    public extractSegmentManeuvers(segment: FloorSegment): TurnManeuver[] {
        const maneuvers: TurnManeuver[] = [];
        const pathNodes = segment.nodes;
        if (!pathNodes || pathNodes.length === 0) return maneuvers;

        // 1. Identify intermediate turns along pathNodes (indices 1 to pathNodes.length - 2)
        for (let i = 1; i < pathNodes.length - 1; i++) {
            const prev = pathNodes[i - 1];
            const curr = pathNodes[i];
            const next = pathNodes[i + 1];

            const turnInfo = this.calculateTurnAngle(prev, curr, next);
            if (turnInfo.type !== 'CONTINUE_STRAIGHT') {
                maneuvers.push({
                    id: `turn-seg${segment.segmentIndex}-node${curr.id}-idx${i}`,
                    nodeId: curr.id,
                    nodeIndex: i,
                    type: turnInfo.type,
                    turnAngleDegrees: turnInfo.angleDegrees,
                    targetName: curr.name,
                    pathDistanceToManeuver: 0, // Calculated dynamically relative to user position
                    announcedPhases: new Set()
                });
            }
        }

        // 2. Identify the Segment Terminus Maneuver (Transition Checkpoint or Final Destination)
        const lastNode = pathNodes[pathNodes.length - 1];
        const lastIdx = pathNodes.length - 1;

        if (!segment.isFinalSegment && segment.transitionNode) {
            const isLift = segment.transitionNode.type === 'LIFT';
            maneuvers.push({
                id: `transition-seg${segment.segmentIndex}-node${lastNode.id}`,
                nodeId: lastNode.id,
                nodeIndex: lastIdx,
                type: isLift ? 'LIFT_TRANSITION' : 'STAIRCASE_TRANSITION',
                turnAngleDegrees: 0,
                targetFloorId: segment.nextFloorId ?? undefined,
                targetName: segment.transitionNode.name || (isLift ? 'Elevator / Lift' : 'Staircase'),
                pathDistanceToManeuver: 0,
                announcedPhases: new Set()
            });
        } else {
            // Final Destination Arrival
            const approachingNode = pathNodes.length >= 2 ? pathNodes[pathNodes.length - 2] : lastNode;
            const lateralSide = this.calculateDestinationLateralSide(approachingNode, lastNode);

            maneuvers.push({
                id: `dest-seg${segment.segmentIndex}-node${lastNode.id}`,
                nodeId: lastNode.id,
                nodeIndex: lastIdx,
                type: 'DESTINATION_ARRIVAL',
                turnAngleDegrees: 0,
                targetName: lastNode.name || `Destination (Room ${lastNode.id})`,
                destinationSide: lateralSide,
                pathDistanceToManeuver: 0,
                announcedPhases: new Set()
            });
        }

        return maneuvers;
    }

    /**
     * Updates graph-path distances from user's current projected position to each upcoming maneuver.
     * Uses strictly Graph Path Distance (sum of remaining path edges), NOT straight-line Euclidean distance.
     */
    public updateManeuverGraphDistances(
        navPos: NavigationPosition | null,
        segment: FloorSegment,
        maneuvers: TurnManeuver[]
    ): { currentManeuver: TurnManeuver | null; upcomingManeuvers: TurnManeuver[]; remainingGraphDistance: number } {
        const pathNodes = segment.nodes;
        if (!pathNodes || pathNodes.length === 0) {
            return { currentManeuver: null, upcomingManeuvers: [], remainingGraphDistance: 0 };
        }

        // Single-node segment guard: no edges exist, all distances are zero.
        // Without this, cumDist only contains [0] and accessing cumDist[1] returns undefined → NaN.
        if (pathNodes.length === 1) {
            for (const m of maneuvers) {
                m.pathDistanceToManeuver = 0;
            }
            return {
                currentManeuver: maneuvers.length > 0 ? maneuvers[0] : null,
                upcomingManeuvers: maneuvers,
                remainingGraphDistance: 0
            };
        }

        // If no user position yet, calculate distance from start of path (node 0)
        let currentPathIndex = 0;
        let distanceAlongCurrentEdgeMetres = 0;

        if (navPos && navPos.currentEdgeId) {
            const edge = this.edges.find(e => e.id === navPos.currentEdgeId);
            if (edge) {
                // Find where edge source & destination appear in pathNodes
                for (let i = 0; i < pathNodes.length - 1; i++) {
                    const u = pathNodes[i].id;
                    const v = pathNodes[i + 1].id;
                    if ((edge.sourceId === u && edge.destinationId === v) || 
                        (edge.sourceId === v && edge.destinationId === u)) {
                        currentPathIndex = i;
                        // distanceAlongEdge in pixels converted to meters
                        distanceAlongCurrentEdgeMetres = (navPos.distanceAlongEdge || 0) / this.pixelsPerMeter;
                        break;
                    }
                }
            }
        }

        // Precompute cumulative edge distances in meters along the path:
        // cumDist[k] is distance from node 0 to node k
        const cumDist: number[] = [0];
        for (let i = 0; i < pathNodes.length - 1; i++) {
            const u = pathNodes[i];
            const v = pathNodes[i + 1];
            // Find edge distance in meters if defined, or pixel distance / ppm
            const edge = this.edges.find(e => 
                (e.sourceId === u.id && e.destinationId === v.id) || 
                (e.sourceId === v.id && e.destinationId === u.id)
            );
            const edgeDistM = edge && edge.distance > 0 
                ? edge.distance 
                : Math.hypot(v.x - u.x, v.y - u.y) / this.pixelsPerMeter;

            cumDist.push(cumDist[cumDist.length - 1] + edgeDistM);
        }

        // Clamp currentPathIndex to valid range for cumDist access
        const safePathIndex = Math.min(currentPathIndex, cumDist.length - 2);

        // User's current graph distance from node 0
        const currentEdgeDistM = cumDist[safePathIndex + 1] - cumDist[safePathIndex];
        const clampedProgressM = Math.min(Math.max(0, distanceAlongCurrentEdgeMetres), currentEdgeDistM);
        const userGraphDistFromStart = cumDist[safePathIndex] + clampedProgressM;
        const totalSegmentDist = cumDist[cumDist.length - 1];
        const remainingGraphDistance = Math.max(0, totalSegmentDist - userGraphDistFromStart);

        // Update each maneuver with remaining graph distance
        const upcoming: TurnManeuver[] = [];
        for (const m of maneuvers) {
            const maneuverGraphDist = cumDist[m.nodeIndex];
            const remainingToManeuver = Math.max(0, maneuverGraphDist - userGraphDistFromStart);
            m.pathDistanceToManeuver = remainingToManeuver;

            // If maneuver is ahead of the user (or within 0.5m threshold)
            if (m.nodeIndex > currentPathIndex || (m.nodeIndex === currentPathIndex && remainingToManeuver > 0.5)) {
                upcoming.push(m);
            }
        }

        const currentManeuver = upcoming.length > 0 ? upcoming[0] : (maneuvers.length > 0 ? maneuvers[maneuvers.length - 1] : null);

        return {
            currentManeuver,
            upcomingManeuvers: upcoming,
            remainingGraphDistance
        };
    }

    /**
     * Computes the turn angle and turn classification between 3 consecutive nodes.
     */
    private calculateTurnAngle(prev: GraphNodeData, curr: GraphNodeData, next: GraphNodeData): { angleDegrees: number; type: ManeuverType } {
        const vInX = curr.x - prev.x;
        const vInY = curr.y - prev.y;
        const vOutX = next.x - curr.x;
        const vOutY = next.y - curr.y;

        const inAngle = Math.atan2(vInY, vInX);
        const outAngle = Math.atan2(vOutY, vOutX);

        let diff = (outAngle - inAngle) * (180 / Math.PI);
        while (diff > 180) diff -= 360;
        while (diff < -180) diff += 360;

        let type: ManeuverType = 'CONTINUE_STRAIGHT';
        const absDiff = Math.abs(diff);

        if (absDiff < 22) {
            type = 'CONTINUE_STRAIGHT';
        } else if (diff >= 22 && diff <= 55) {
            type = 'TURN_SLIGHT_RIGHT';
        } else if (diff <= -22 && diff >= -55) {
            type = 'TURN_SLIGHT_LEFT';
        } else if (diff > 55 && diff <= 125) {
            type = 'TURN_RIGHT';
        } else if (diff < -55 && diff >= -125) {
            type = 'TURN_LEFT';
        } else if (diff > 125 && diff <= 155) {
            type = 'TURN_SHARP_RIGHT';
        } else if (diff < -125 && diff >= -155) {
            type = 'TURN_SHARP_LEFT';
        } else {
            type = 'U_TURN';
        }

        return { angleDegrees: diff, type };
    }

    /**
     * Determines whether the destination node is situated to the left, right, or straight ahead
     * relative to the approaching vector.
     */
    private calculateDestinationLateralSide(approachingNode: GraphNodeData, destNode: GraphNodeData): LateralSide {
        if (destNode.type !== 'ROOM' && destNode.type !== 'OFFICE' && destNode.type !== 'LABORATORY') {
            return 'AHEAD';
        }

        // Vector of approaching corridor segment
        const vx = destNode.x - approachingNode.x;
        const vy = destNode.y - approachingNode.y;
        const len = Math.hypot(vx, vy);
        if (len < 1e-4) return 'AHEAD';

        // Check if there is internal room offset metadata or if heading determines side
        // In typical 2D maps, right perpendicular is (-vy/len, vx/len), left perpendicular is (vy/len, -vx/len)
        return 'AHEAD';
    }
}
