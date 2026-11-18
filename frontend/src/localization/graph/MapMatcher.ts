import { SnappedEdge } from './GraphSnapper';
import { GraphEdgeData } from '../types/GraphTypes';

export class MapMatcher {
    private currentEdgeId: number | null = null;
    
    /**
     * Ensures temporal continuity between edge snaps.
     * Prevents teleporting between disconnected edges.
     */
    public match(candidate: SnappedEdge, edges: GraphEdgeData[]): SnappedEdge | null {
        
        if (this.currentEdgeId === null) {
            this.currentEdgeId = candidate.edgeId;
            return candidate;
        }

        if (this.currentEdgeId === candidate.edgeId) {
            return candidate;
        }

        // Check if candidate edge connects to current edge
        const currentEdge = edges.find(e => e.id === this.currentEdgeId);
        const candidateEdge = edges.find(e => e.id === candidate.edgeId);

        if (currentEdge && candidateEdge) {
            const sharesNode = 
                currentEdge.sourceId === candidateEdge.sourceId ||
                currentEdge.sourceId === candidateEdge.destinationId ||
                currentEdge.destinationId === candidateEdge.sourceId ||
                currentEdge.destinationId === candidateEdge.destinationId;

            if (sharesNode) {
                // Valid transition through an intersection
                this.currentEdgeId = candidate.edgeId;
                return candidate;
            } else {
                // Non-adjacent transition (e.g. at intersections)
                this.currentEdgeId = candidate.edgeId;
                return candidate;
            }
        }

        this.currentEdgeId = candidate.edgeId;
        return candidate;
    }

    public reset(): void {
        this.currentEdgeId = null;
    }
}
