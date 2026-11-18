import { NavigationPosition } from './LocalizationState';
import { GraphNodeData, GraphEdgeData } from './types/GraphTypes';

export class NavigationPositionResolver {
    
    /**
     * Resolves the topological NavigationPosition to the nearest valid A* node.
     * This explicitly separates physical localization from the routing algorithm.
     */
    public static resolveNearestNode(
        navPosition: NavigationPosition,
        physicalPosition: {x: number, y: number} | null,
        nodes: GraphNodeData[],
        edges: GraphEdgeData[]
    ): number | null {
        if (navPosition.currentEdgeId == null || navPosition.currentEdgeId === -1) {
            // Fallback: find the closest node on this floor by Euclidean distance
            const floorNodes = nodes.filter(n => n.floorId === navPosition.floorId);
            if (floorNodes.length === 0) return null;
            
            let nearestId = floorNodes[0].id;
            
            if (!physicalPosition) return nearestId;

            let minDist = Infinity;
            for (const node of floorNodes) {
                // Use distanceAlongEdge as a rough proxy for position if available,
                // otherwise fall back to first node (better than nothing)
                const d = Math.hypot(node.x - physicalPosition.x, node.y - physicalPosition.y);
                if (!isNaN(d) && d < minDist) {
                    minDist = d;
                    nearestId = node.id;
                }
            }
            return nearestId;
        }

        const edge = edges.find(e => e.id === navPosition.currentEdgeId);
        if (!edge) return null;

        const source = nodes.find(n => n.id === edge.sourceId);
        const target = nodes.find(n => n.id === edge.destinationId);

        if (!source || !target) return null;

        const edgeLength = Math.hypot(target.x - source.x, target.y - source.y);
        
        // If closer to source node, return source ID, else target ID
        if (navPosition.distanceAlongEdge <= (edgeLength / 2)) {
            return source.id;
        } else {
            return target.id;
        }
    }
}
