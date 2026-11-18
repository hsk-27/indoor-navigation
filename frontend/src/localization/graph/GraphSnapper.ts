import { GraphProjector, CandidateProjection } from './GraphProjector';
import { EstimatedCartesianPosition } from '../LocalizationState';
import { GraphNodeData, GraphEdgeData } from '../types/GraphTypes';

export interface SnappedEdge {
    edgeId: number;
    projectedX: number;
    projectedY: number;
    distanceAlongEdge: number;
    distanceToEdge: number;
    score: number;
}

export class GraphSnapper {
    
    /**
     * Evaluates candidate edges and returns the highest scoring one.
     */
    public snapToBestEdge(
        estimate: EstimatedCartesianPosition, 
        heading: number | undefined,
        nodes: Map<number, GraphNodeData>,
        edges: GraphEdgeData[],
        previousEdgeId: number | null,
        activeRouteEdgeIds: Set<number>
    ): SnappedEdge | null {
        
        const candidates = GraphProjector.findCandidateEdges(estimate, nodes, edges);
        if (candidates.length === 0) return null;

        let bestCandidate: SnappedEdge | null = null;
        let highestScore = -Infinity;

        for (const candidate of candidates) {
            let score = 0;
            
            // 1. Distance Score (0 to -100)
            score -= candidate.distanceToEdge * 2; // Closer is better

            // 2. Heading Compatibility Score
            // Edges are bi-directional, so we check both directions
            if (heading !== undefined) {
                const headingMathFrame = heading - Math.PI / 2;
                const edgeAngle = Math.atan2(candidate.target.y - candidate.source.y, candidate.target.x - candidate.source.x);
                let headingDiff = Math.abs(headingMathFrame - edgeAngle);
                while (headingDiff > Math.PI) headingDiff -= 2 * Math.PI;
                headingDiff = Math.abs(headingDiff);

                // If heading difference is around PI, it means walking backwards along the edge, which is fine
                let minHeadingDiff = Math.min(headingDiff, Math.abs(headingDiff - Math.PI));
                
                // Penalize walking perpendicular to the edge
                score -= minHeadingDiff * 50; 
            } 

            // 3. Movement Continuity (Previous Edge)
            if (previousEdgeId !== null) {
                if (candidate.edge.id === previousEdgeId) {
                    score += 100; // High bonus for staying on the same edge
                } else {
                    // Check if candidate edge connects to previous edge
                    const previousEdge = edges.find(e => e.id === previousEdgeId);
                    if (previousEdge) {
                        const sharesNode = 
                            candidate.edge.sourceId === previousEdge.sourceId ||
                            candidate.edge.sourceId === previousEdge.destinationId ||
                            candidate.edge.destinationId === previousEdge.sourceId ||
                            candidate.edge.destinationId === previousEdge.destinationId;
                            
                        if (sharesNode) {
                            score += 50; // Bonus for connected edge
                        }
                    }
                }
            }

            // 4. Current Route
            if (activeRouteEdgeIds.has(candidate.edge.id)) {
                score += 80;
            }

            if (score > highestScore) {
                highestScore = score;
                bestCandidate = {
                    edgeId: candidate.edge.id,
                    projectedX: candidate.projectedX,
                    projectedY: candidate.projectedY,
                    distanceAlongEdge: candidate.distanceAlongEdge,
                    distanceToEdge: candidate.distanceToEdge,
                    score: score
                };
            }
        }

        return bestCandidate;
    }
}
