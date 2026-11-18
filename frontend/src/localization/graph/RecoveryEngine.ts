import { EstimatedCartesianPosition } from '../LocalizationState';
import { GraphSnapper, SnappedEdge } from './GraphSnapper';
import { GraphNodeData, GraphEdgeData } from '../types/GraphTypes';

export class RecoveryEngine {
    private snapper: GraphSnapper;
    private recoveryAttempts = 0;
    private readonly MAX_ATTEMPTS = 5;

    constructor(snapper: GraphSnapper) {
        this.snapper = snapper;
    }

    /**
     * Attempts to find an alternative edge by temporarily relaxing constraints 
     * (e.g., ignoring heading or expanding the search radius).
     * Returns true if recovered, false if manual recalibration is required.
     */
    public attemptRecovery(
        estimate: EstimatedCartesianPosition, 
        nodes: Map<number, GraphNodeData>,
        edges: GraphEdgeData[],
        previousEdgeId: number | null,
        activeRouteEdgeIds: Set<number>
    ): { recovered: boolean; newEdge: SnappedEdge | null } {
        
        if (this.recoveryAttempts >= this.MAX_ATTEMPTS) {
            return { recovered: false, newEdge: null };
        }

        this.recoveryAttempts++;
        
        // Relax constraints: 
        // 1. Force snap to the nearest edge regardless of distance thresholds
        // 2. Ignore heading restrictions
        const candidate = this.snapper.snapToBestEdge(
            estimate, 
            undefined, 
            nodes, 
            edges, 
            previousEdgeId, 
            activeRouteEdgeIds
        );
        
        if (candidate) {
            this.recoveryAttempts = 0; // Successfully found an edge
            return { recovered: true, newEdge: candidate };
        }

        return { recovered: false, newEdge: null };
    }

    public reset(): void {
        this.recoveryAttempts = 0;
    }
}
