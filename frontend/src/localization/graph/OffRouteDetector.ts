import { SnappedEdge } from './GraphSnapper';

export class OffRouteDetector {
    private offRouteCounter = 0;
    private readonly MAX_DEVIATIONS = 3; // Number of consecutive steps off route before triggering
    private routeEdgeIds: Set<number> = new Set<number>();

    public setRouteEdges(edgeIds: number[]): void {
        this.routeEdgeIds = new Set(edgeIds);
    }
    
    /**
     * Detects if the user has significantly deviated from the current graph bounds.
     */
    public checkDeviation(candidate: SnappedEdge | null, distanceToEdge: number): boolean {
        // If we can't find a valid edge, or we're snapping more than 150 abstract units away
        if (!candidate || distanceToEdge > 150) {
            this.offRouteCounter++;
            return this.offRouteCounter >= this.MAX_DEVIATIONS;
        }

        if (this.routeEdgeIds && this.routeEdgeIds.size > 0 && !this.routeEdgeIds.has(candidate.edgeId)) {
            this.offRouteCounter++;
            return this.offRouteCounter >= this.MAX_DEVIATIONS;
        }
        
        // Back on track
        this.offRouteCounter = 0;
        return false;
    }
}
