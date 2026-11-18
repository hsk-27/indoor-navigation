import { GraphNodeData, GraphEdgeData } from '../types/GraphTypes';
import { EstimatedCartesianPosition } from '../LocalizationState';

export interface Point2D {
    x: number;
    y: number;
}

export interface CandidateProjection {
    edge: GraphEdgeData;
    source: GraphNodeData;
    target: GraphNodeData;
    projectedX: number;
    projectedY: number;
    distanceAlongEdge: number;
    distanceToEdge: number;
}

export class GraphProjector {
    
    /**
     * Finds all candidate edges on the current floor within a specific search radius
     * and performs orthogonal projection onto them.
     */
    public static findCandidateEdges(
        position: EstimatedCartesianPosition,
        nodes: Map<number, GraphNodeData>,
        edges: GraphEdgeData[],
        searchRadius: number = 150
    ): CandidateProjection[] {
        
        const candidates: CandidateProjection[] = [];

        for (const edge of edges) {
            const source = nodes.get(edge.sourceId);
            const target = nodes.get(edge.destinationId);
            
            if (!source || !target) continue;
            
            // Only evaluate edges on the current floor
            const isTransitionEdge = source.floorId !== target.floorId;
            if (!isTransitionEdge && (source.floorId !== position.floorId || target.floorId !== position.floorId)) continue;
            if (isTransitionEdge && source.floorId !== position.floorId && target.floorId !== position.floorId) continue;

            // Bounding box quick check (optimization)
            const minX = Math.min(source.x, target.x) - searchRadius;
            const maxX = Math.max(source.x, target.x) + searchRadius;
            const minY = Math.min(source.y, target.y) - searchRadius;
            const maxY = Math.max(source.y, target.y) + searchRadius;

            if (position.x < minX || position.x > maxX || position.y < minY || position.y > maxY) {
                continue;
            }

            const projection = this.projectPointOntoSegment(
                position.x, position.y,
                source.x, source.y,
                target.x, target.y
            );
            
            if (projection.distance <= searchRadius) {
                candidates.push({
                    edge,
                    source,
                    target,
                    projectedX: projection.x,
                    projectedY: projection.y,
                    distanceAlongEdge: Math.hypot(projection.x - source.x, projection.y - source.y),
                    distanceToEdge: projection.distance
                });
            }
        }

        return candidates;
    }

    /**
     * Projects a point (pX, pY) orthogonally onto the line segment defined by (vX, vY) and (wX, wY).
     * If the orthogonal projection lies outside the segment, it snaps to the closest endpoint.
     */
    private static projectPointOntoSegment(pX: number, pY: number, vX: number, vY: number, wX: number, wY: number) {
        const l2 = Math.pow(vX - wX, 2) + Math.pow(vY - wY, 2);
        
        if (l2 === 0) {
            return { x: vX, y: vY, distance: Math.hypot(pX - vX, pY - vY) };
        }
        
        let t = ((pX - vX) * (wX - vX) + (pY - vY) * (wY - vY)) / l2;
        t = Math.max(0, Math.min(1, t));
        
        const projX = vX + t * (wX - vX);
        const projY = vY + t * (wY - vY);
        
        return {
            x: projX,
            y: projY,
            distance: Math.hypot(pX - projX, pY - projY)
        };
    }
}
