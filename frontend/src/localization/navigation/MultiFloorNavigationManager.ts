import { GraphNodeData, GraphEdgeData } from '../types/GraphTypes';
import { NavigationPosition, EstimatedCartesianPosition } from '../LocalizationState';
import { VoiceGuidanceService } from './VoiceGuidanceService';
import { NavigationContext, TurnManeuver } from './NavigationContext';
import { PredictiveTurnAnalyzer } from './PredictiveTurnAnalyzer';
import { PredictiveVoiceEngine, PredictiveVoiceConfig } from './PredictiveVoiceEngine';

export interface FloorSegment {
    segmentIndex: number;
    floorId: number;
    nodes: GraphNodeData[];
    transitionNode: GraphNodeData | null; // Checkpoint on this floor (Staircase/Lift), null if final segment
    nextFloorTransitionNode: GraphNodeData | null; // Landing node on next floor
    nextFloorId: number | null;
    isFinalSegment: boolean;
    segmentDistance: number;
    destinationNode: GraphNodeData;
    maneuvers?: TurnManeuver[];
}

export type MultiFloorNavigationStatus = 
    | 'IDLE'
    | 'NAVIGATING_SEGMENT'
    | 'AT_CHECKPOINT'
    | 'TRANSITIONING_FLOOR'
    | 'OFF_CHECKPOINT_DEVIATING'
    | 'REROUTING'
    | 'LOW_CONFIDENCE_PAUSED'
    | 'ARRIVED_DESTINATION';

export interface NavigationManagerConfig {
    consecutiveDeviationsThreshold: number; // e.g. 3 consecutive updates with increasing distance
    deviationToleranceMetres: number;       // e.g. 8.0 meters
    checkpointArrivalRadiusMetres: number;  // e.g. 0.8 meters
    pixelsPerMeter: number;                // graph scale
    voiceConfig?: Partial<PredictiveVoiceConfig>;
}

export const DEFAULT_CONFIG: NavigationManagerConfig = {
    consecutiveDeviationsThreshold: 3,
    deviationToleranceMetres: 8.0,
    checkpointArrivalRadiusMetres: 0.8,
    pixelsPerMeter: 12.5
};

export class MultiFloorNavigationManager {
    private config: NavigationManagerConfig;
    private voice: VoiceGuidanceService;
    private navContext: NavigationContext;
    private turnAnalyzer: PredictiveTurnAnalyzer;
    private voiceEngine: PredictiveVoiceEngine;
    
    private segments: FloorSegment[] = [];
    private currentSegmentIndex: number = 0;
    private status: MultiFloorNavigationStatus = 'IDLE';
    
    // Deviation tracking
    private consecutiveDeviations: number = 0;
    private lastDistanceToCheckpoint: number = Infinity;
    private minDistanceToCheckpointSeen: number = Infinity;
    
    // Graph cache
    private allNodes: Map<number, GraphNodeData> = new Map();
    private allEdges: GraphEdgeData[] = [];
    private originalDestinationNodeId: number | null = null;

    private onStatusChange?: (status: MultiFloorNavigationStatus, currentSegment: FloorSegment | null) => void;

    constructor(
        config: Partial<NavigationManagerConfig> = {},
        onStatusChange?: (status: MultiFloorNavigationStatus, currentSegment: FloorSegment | null) => void
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.voice = VoiceGuidanceService.getInstance();
        this.navContext = new NavigationContext();
        this.turnAnalyzer = new PredictiveTurnAnalyzer(this.config.pixelsPerMeter);
        this.voiceEngine = new PredictiveVoiceEngine(this.config.voiceConfig, this.voice);
        this.onStatusChange = onStatusChange;
    }

    public getNavigationContext(): NavigationContext {
        return this.navContext;
    }

    public getPredictiveVoiceEngine(): PredictiveVoiceEngine {
        return this.voiceEngine;
    }

    public setConfig(newConfig: Partial<NavigationManagerConfig>) {
        this.config = { ...this.config, ...newConfig };
        if (newConfig.pixelsPerMeter) {
            this.turnAnalyzer.setPixelsPerMeter(newConfig.pixelsPerMeter);
        }
        if (newConfig.voiceConfig) {
            this.voiceEngine.setConfig(newConfig.voiceConfig);
        }
    }

    public setGraph(nodes: GraphNodeData[], edges: GraphEdgeData[]) {
        this.allNodes = new Map(nodes.map(n => [n.id, n]));
        this.allEdges = edges;
        this.turnAnalyzer.setGraph(nodes, edges, this.config.pixelsPerMeter);
    }

    public getStatus(): MultiFloorNavigationStatus {
        return this.status;
    }

    public getCurrentSegment(): FloorSegment | null {
        if (this.currentSegmentIndex >= 0 && this.currentSegmentIndex < this.segments.length) {
            return this.segments[this.currentSegmentIndex];
        }
        return null;
    }

    public getAllSegments(): FloorSegment[] {
        return this.segments;
    }

    public getOriginalDestinationNodeId(): number | null {
        return this.originalDestinationNodeId;
    }

    private updateStatus(newStatus: MultiFloorNavigationStatus) {
        this.status = newStatus;
        this.navContext.update({ status: newStatus });
        if (this.onStatusChange) {
            this.onStatusChange(this.status, this.getCurrentSegment());
        }
    }

    /**
     * Deconstructs a complete multi-floor A* path into discrete, sequential floor segments
     * and extracts predictive turn maneuvers for each segment.
     */
    public initializeRoute(routePath: any[], destinationNodeId: number): void {
        this.originalDestinationNodeId = destinationNodeId;
        this.segments = [];
        this.currentSegmentIndex = 0;
        this.consecutiveDeviations = 0;
        this.lastDistanceToCheckpoint = Infinity;
        this.minDistanceToCheckpointSeen = Infinity;
        this.voiceEngine.reset();
        this.navContext.reset();

        if (!routePath || routePath.length === 0) {
            this.updateStatus('IDLE');
            return;
        }

        // Partition nodes by floor transitions
        let currentFloorNodes: GraphNodeData[] = [];
        let currentFloorId = routePath[0].floorId;

        for (let i = 0; i < routePath.length; i++) {
            const rawNode = routePath[i];
            const node: GraphNodeData = {
                id: rawNode.id,
                x: rawNode.x,
                y: rawNode.y,
                type: rawNode.type,
                floorId: rawNode.floorId,
                name: rawNode.name || (rawNode.type === 'ROOM' ? `Room ${rawNode.id}` : `Node ${rawNode.id}`)
            };

            if (node.floorId === currentFloorId) {
                currentFloorNodes.push(node);
            } else {
                // Floor transition detected between routePath[i-1] and routePath[i]
                const transitionNode = currentFloorNodes[currentFloorNodes.length - 1];
                const nextLandingNode: GraphNodeData = {
                    id: rawNode.id,
                    x: rawNode.x,
                    y: rawNode.y,
                    type: rawNode.type,
                    floorId: rawNode.floorId,
                    name: rawNode.name
                };

                const segmentDist = this.calculatePathDistance(currentFloorNodes);

                const seg: FloorSegment = {
                    segmentIndex: this.segments.length,
                    floorId: currentFloorId,
                    nodes: currentFloorNodes,
                    transitionNode: transitionNode,
                    nextFloorTransitionNode: nextLandingNode,
                    nextFloorId: rawNode.floorId,
                    isFinalSegment: false,
                    segmentDistance: segmentDist,
                    destinationNode: transitionNode
                };
                seg.maneuvers = this.turnAnalyzer.extractSegmentManeuvers(seg);
                this.segments.push(seg);

                // Start next floor
                currentFloorId = rawNode.floorId;
                currentFloorNodes = [node];
            }
        }

        // Final segment
        if (currentFloorNodes.length > 0) {
            const finalDest = currentFloorNodes[currentFloorNodes.length - 1];
            const segmentDist = this.calculatePathDistance(currentFloorNodes);
            const finalSeg: FloorSegment = {
                segmentIndex: this.segments.length,
                floorId: currentFloorId,
                nodes: currentFloorNodes,
                transitionNode: null,
                nextFloorTransitionNode: null,
                nextFloorId: null,
                isFinalSegment: true,
                segmentDistance: segmentDist,
                destinationNode: finalDest
            };
            finalSeg.maneuvers = this.turnAnalyzer.extractSegmentManeuvers(finalSeg);
            this.segments.push(finalSeg);
        }

        this.updateStatus('NAVIGATING_SEGMENT');
        const activeSeg = this.getCurrentSegment();
        if (activeSeg) {
            this.navContext.update({
                activeSegment: activeSeg,
                upcomingManeuvers: activeSeg.maneuvers || [],
                currentManeuver: activeSeg.maneuvers && activeSeg.maneuvers.length > 0 ? activeSeg.maneuvers[0] : null,
                remainingGraphDistance: activeSeg.segmentDistance
            });
        }
    }

    private calculatePathDistance(nodes: GraphNodeData[]): number {
        let total = 0;
        for (let i = 0; i < nodes.length - 1; i++) {
            const ppm = this.config.pixelsPerMeter > 0 ? this.config.pixelsPerMeter : 1.0;
            total += Math.hypot(nodes[i+1].x - nodes[i].x, nodes[i+1].y - nodes[i].y) / ppm;
        }
        return parseFloat(total.toFixed(1));
    }

    /**
     * Primary tick: Called on each navigation update.
     */
    public processPositionUpdate(
        navPos: NavigationPosition,
        physicalPos: EstimatedCartesianPosition | null
    ): {
        action: 'CONTINUE' | 'REQUIRE_MANUAL_FLOOR' | 'TRIGGER_RECALCULATION' | 'CHECKPOINT_REACHED' | 'DESTINATION_REACHED';
        targetFloorId?: number;
        recalculateFromNodeId?: number;
        reason?: string;
    } {
        const seg = this.getCurrentSegment();
        if (!seg) return { action: 'CONTINUE' };

        // 1. Update NavigationContext with live physical attributes
        // Only use 1.2 as a fallback if velocity is completely undefined, but allow 0 for stationary
        const speed = navPos.velocity !== undefined ? navPos.velocity : 1.2;
        const heading = navPos.heading || 0;
        const motionState = navPos.motionState || 'WALKING';
        const confidence = navPos.confidence;

        // 2. Update Graph Distances to upcoming maneuvers
        const maneuverAnalysis = this.turnAnalyzer.updateManeuverGraphDistances(
            navPos,
            seg,
            seg.maneuvers || []
        );

        this.navContext.update({
            navigationPosition: navPos,
            activeSegment: seg,
            currentManeuver: maneuverAnalysis.currentManeuver,
            upcomingManeuvers: maneuverAnalysis.upcomingManeuvers,
            remainingGraphDistance: maneuverAnalysis.remainingGraphDistance,
            confidence,
            speed,
            heading,
            motionState
        });

        // 3. Trigger Predictive Voice Guidance Engine
        this.voiceEngine.processSnapshot(this.navContext.getSnapshot());

        // 4. Check Low Confidence with Multi-Stage Floor Recovery
        if (confidence === 'LOW') {
            const autoRecovered = this.attemptContextualFloorRecovery(navPos, physicalPos, seg);
            if (!autoRecovered) {
                this.updateStatus('LOW_CONFIDENCE_PAUSED');
                return { action: 'REQUIRE_MANUAL_FLOOR', reason: 'Ambiguous floor under low confidence' };
            }
        }

        // 5. Resolve user coordinates on current floor
        const userPoint = this.extractCoordinates(navPos, physicalPos);
        if (!userPoint) return { action: 'CONTINUE' };

        const targetNode = seg.isFinalSegment ? seg.destinationNode : seg.transitionNode;
        if (!targetNode) return { action: 'CONTINUE' };

        const ppm = this.config.pixelsPerMeter > 0 ? this.config.pixelsPerMeter : 1.0;
        const distToTarget = Math.hypot(userPoint.x - targetNode.x, userPoint.y - targetNode.y) / ppm;

        // 6. Checkpoint / Destination Arrival Check
        if (distToTarget <= this.config.checkpointArrivalRadiusMetres) {
            if (seg.isFinalSegment) {
                this.updateStatus('ARRIVED_DESTINATION');
                // The PredictiveVoiceEngine handles the 1.0m arrival prompt.
                return { action: 'DESTINATION_REACHED' };
            } else {
                this.updateStatus('AT_CHECKPOINT');
                // The PredictiveVoiceEngine handles the 1.0m transition prompt.
                return { action: 'CHECKPOINT_REACHED', targetFloorId: seg.nextFloorId || undefined };
            }
        }

        // 7. Configurable Consecutive-Deviation Detection
        // Use nearest-edge-distance instead of raw Euclidean to target, to avoid
        // false positives on winding corridors where straight-line distance to target
        // can temporarily increase while still walking along the correct path.
        let minEdgeDist = Infinity;
        const pathNodes = seg.nodes;
        if (pathNodes && pathNodes.length >= 2) {
            for (let i = 0; i < pathNodes.length - 1; i++) {
                const d = this.pointToSegmentDistance(
                    userPoint.x, userPoint.y,
                    pathNodes[i].x, pathNodes[i].y,
                    pathNodes[i + 1].x, pathNodes[i + 1].y
                );
                if (d < minEdgeDist) minEdgeDist = d;
            }
        }
        const deviationDistMetres = minEdgeDist / ppm;

        if (deviationDistMetres > this.lastDistanceToCheckpoint) {
            this.consecutiveDeviations++;
        } else {
            this.consecutiveDeviations = 0;
            if (deviationDistMetres < this.minDistanceToCheckpointSeen) {
                this.minDistanceToCheckpointSeen = distToTarget;
            }
        }
        this.lastDistanceToCheckpoint = deviationDistMetres;

        const distanceIncrease = distToTarget - this.minDistanceToCheckpointSeen;
        if (this.consecutiveDeviations >= this.config.consecutiveDeviationsThreshold && 
            distanceIncrease >= this.config.deviationToleranceMetres) {
            
            this.updateStatus('OFF_CHECKPOINT_DEVIATING');
            this.navContext.update({ isRecalculating: true });
            this.voiceEngine.announceDeviationWarning();
            
            const nearestNodeId = this.findNearestNodeId(userPoint, seg.floorId);
            return {
                action: 'TRIGGER_RECALCULATION',
                recalculateFromNodeId: nearestNodeId || undefined,
                reason: `Distance increasing for ${this.consecutiveDeviations} steps (${distanceIncrease.toFixed(1)}m > ${this.config.deviationToleranceMetres}m)`
            };
        }

        return { action: 'CONTINUE' };
    }

    /**
     * Multi-stage auto-recovery for low confidence
     */
    private attemptContextualFloorRecovery(
        navPos: NavigationPosition,
        physicalPos: EstimatedCartesianPosition | null,
        seg: FloorSegment
    ): boolean {
        if (navPos.currentEdgeId !== null && navPos.floorId === seg.floorId) {
            return true;
        }

        if (!physicalPos) return false;

        const floorEdges = this.allEdges.filter(e => {
            const src = this.allNodes.get(e.sourceId);
            return src && src.floorId === seg.floorId;
        });

        let minEdgeDist = Infinity;
        for (const edge of floorEdges) {
            const src = this.allNodes.get(edge.sourceId);
            const dst = this.allNodes.get(edge.destinationId);
            if (!src || !dst) continue;
            
            const dist = this.pointToSegmentDistance(physicalPos.x, physicalPos.y, src.x, src.y, dst.x, dst.y);
            if (dist < minEdgeDist) minEdgeDist = dist;
        }

        return minEdgeDist < 60;
    }

    private announceCheckpointArrival(seg: FloorSegment): void {
        // Suppressed: PredictiveVoiceEngine now guarantees a 1-metre exact 
        // distance trigger for connector transitions to prevent duplicate spam.
    }

    /**
     * Handles recalculated route result:
     * If the same transition node is optimal -> instruct to return.
     * If a new transition node is objectively shorter -> seamlessly switch and announce.
     */
    public handleRecalculatedRoute(newRoutePath: any[]): { switchedCheckpoint: boolean; message: string } {
        const currentSeg = this.getCurrentSegment();
        if (!currentSeg || !newRoutePath || newRoutePath.length === 0) {
            return { switchedCheckpoint: false, message: 'Route updated.' };
        }

        this.navContext.update({ isRecalculating: false });

        // Find transition node in new route on current floor
        let newTransitionNodeId: number | null = null;
        for (let i = 0; i < newRoutePath.length - 1; i++) {
            if (newRoutePath[i].floorId === currentSeg.floorId && newRoutePath[i+1].floorId !== currentSeg.floorId) {
                newTransitionNodeId = newRoutePath[i].id;
                break;
            }
        }

        const oldTransitionNodeId = currentSeg.transitionNode?.id ?? null;

        if (oldTransitionNodeId !== null && newTransitionNodeId === oldTransitionNodeId) {
            const transType = (currentSeg.transitionNode?.type === 'LIFT' ? 'LIFT' : 'STAIRCASE');
            this.voiceEngine.announceReturnToTransition(transType);
            this.updateStatus('NAVIGATING_SEGMENT');
            this.consecutiveDeviations = 0;
            const transName = transType === 'LIFT' ? 'lift' : 'staircase';
            return { switchedCheckpoint: false, message: `Please return to the assigned ${transName}.` };
        } else {
            this.initializeRoute(newRoutePath, this.originalDestinationNodeId || newRoutePath[newRoutePath.length - 1].id);
            const newSeg = this.getCurrentSegment();
            const newTransType = newSeg?.transitionNode?.type === 'LIFT' ? 'LIFT' : 'STAIRCASE';
            const newFloor = newSeg?.nextFloorId || currentSeg.floorId;
            
            if (newSeg?.transitionNode) {
                this.voiceEngine.announceRerouteToNewTransition(newTransType, newFloor);
            } else {
                this.voice.speak("Rerouting to destination.", { priority: 'HIGH' });
            }

            const transLabel = newTransType === 'LIFT' ? 'lift' : 'staircase';
            const msg = newSeg?.transitionNode 
                ? `Rerouting: Take ${transLabel} to Floor ${newFloor}.` 
                : `Rerouting to destination.`;
            return { switchedCheckpoint: true, message: msg };
        }
    }

    /**
     * User confirms transition to next floor (or arrives on new floor).
     */
    public transitionToNextFloor(newFloorId: number): void {
        if (this.currentSegmentIndex + 1 < this.segments.length) {
            this.currentSegmentIndex++;
            this.consecutiveDeviations = 0;
            this.lastDistanceToCheckpoint = Infinity;
            this.minDistanceToCheckpointSeen = Infinity;
            this.updateStatus('NAVIGATING_SEGMENT');
            
            const newSeg = this.getCurrentSegment();
            if (newSeg) {
                this.navContext.update({
                    activeSegment: newSeg,
                    upcomingManeuvers: newSeg.maneuvers || [],
                    currentManeuver: newSeg.maneuvers && newSeg.maneuvers.length > 0 ? newSeg.maneuvers[0] : null,
                    remainingGraphDistance: newSeg.segmentDistance
                });
            }

            this.voice.speak(`You are now on Floor ${newFloorId}. Continue along the highlighted path.`, { priority: 'HIGH' });
        }
    }

    /**
     * Resumes navigation after manual floor selection
     */
    public resumeFromManualFloorSelection(selectedFloorId: number): void {
        const seg = this.getCurrentSegment();
        if (seg && seg.floorId === selectedFloorId) {
            this.updateStatus('NAVIGATING_SEGMENT');
            this.voice.speak(`Resuming navigation on Floor ${selectedFloorId}.`, { priority: 'HIGH' });
        } else {
            const matchingIndex = this.segments.findIndex(s => s.floorId === selectedFloorId);
            if (matchingIndex !== -1) {
                this.currentSegmentIndex = matchingIndex;
                this.updateStatus('NAVIGATING_SEGMENT');
                const newSeg = this.getCurrentSegment();
                if (newSeg) {
                    this.navContext.update({
                        activeSegment: newSeg,
                        upcomingManeuvers: newSeg.maneuvers || [],
                        currentManeuver: newSeg.maneuvers && newSeg.maneuvers.length > 0 ? newSeg.maneuvers[0] : null,
                        remainingGraphDistance: newSeg.segmentDistance
                    });
                }
                this.voice.speak(`Switched to Floor ${selectedFloorId}. Resuming navigation.`, { priority: 'HIGH' });
            } else {
                // Off-route floor: resume to NAVIGATING and let the next position update trigger reroute
                this.updateStatus('NAVIGATING_SEGMENT');
                this.consecutiveDeviations = this.config.consecutiveDeviationsThreshold;
                this.voice.speak(`Floor ${selectedFloorId} is not on your current route. Recalculating.`, { priority: 'HIGH' });
            }
        }
    }

    private extractCoordinates(navPos: NavigationPosition, physicalPos: EstimatedCartesianPosition | null): { x: number, y: number } | null {
        if (navPos.currentEdgeId !== null) {
            const edge = this.allEdges.find(e => e.id === navPos.currentEdgeId);
            if (edge) {
                const src = this.allNodes.get(edge.sourceId);
                const dst = this.allNodes.get(edge.destinationId);
                if (src && dst) {
                    const len = Math.hypot(dst.x - src.x, dst.y - src.y);
                    const ratio = len === 0 ? 0 : Math.min(1, navPos.distanceAlongEdge / len);
                    return { x: src.x + ratio * (dst.x - src.x), y: src.y + ratio * (dst.y - src.y) };
                }
            }
        }
        if (physicalPos) {
            return { x: physicalPos.x, y: physicalPos.y };
        }
        return null;
    }

    private findNearestNodeId(point: { x: number, y: number }, floorId: number): number | null {
        let nearestId: number | null = null;
        let minDist = Infinity;
        for (const [id, node] of this.allNodes.entries()) {
            if (node.floorId === floorId) {
                const d = Math.hypot(point.x - node.x, point.y - node.y);
                if (d < minDist) {
                    minDist = d;
                    nearestId = id;
                }
            }
        }
        return nearestId;
    }

    private pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }
}
