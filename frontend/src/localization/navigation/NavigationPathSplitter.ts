export interface Point2D {
    x: number;
    y: number;
    floorId?: number;
}

export interface SplitRouteResult {
    completedPoints: Point2D[];
    remainingPoints: Point2D[];
}

export class NavigationPathSplitter {
    /**
     * Splits an array of nodes/points along a floor path into completed and remaining polyline segments
     * based on the user's projected position and active edge.
     */
    public static splitPathAtPosition(
        segmentNodes: { id: number; x: number; y: number; floorId?: number }[],
        currentEdgeId: number | null | undefined,
        currentPos: Point2D | null,
        edges: { id: number; sourceId: number; destinationId: number }[]
    ): SplitRouteResult {
        if (!segmentNodes || segmentNodes.length === 0) {
            return { completedPoints: [], remainingPoints: [] };
        }

        const allPoints: Point2D[] = segmentNodes.map(n => ({ x: n.x, y: n.y, floorId: n.floorId }));

        if (!currentPos || !currentEdgeId || segmentNodes.length < 2) {
            return {
                completedPoints: [],
                remainingPoints: allPoints
            };
        }

        const activeEdge = edges.find(e => e.id === currentEdgeId);
        if (!activeEdge) {
            return {
                completedPoints: [],
                remainingPoints: allPoints
            };
        }

        // Find edge index in segment
        let edgeIndex = -1;
        for (let i = 0; i < segmentNodes.length - 1; i++) {
            const u = segmentNodes[i];
            const v = segmentNodes[i + 1];
            if (
                (u.id === activeEdge.sourceId && v.id === activeEdge.destinationId) ||
                (u.id === activeEdge.destinationId && v.id === activeEdge.sourceId)
            ) {
                edgeIndex = i;
                break;
            }
        }

        if (edgeIndex === -1) {
            // User is not on a segment edge, return full path as remaining
            return {
                completedPoints: [],
                remainingPoints: allPoints
            };
        }

        // Completed points: 0 through edgeIndex, plus current projected position
        const completed: Point2D[] = [];
        for (let i = 0; i <= edgeIndex; i++) {
            completed.push({ x: segmentNodes[i].x, y: segmentNodes[i].y, floorId: segmentNodes[i].floorId });
        }
        
        // currentPos gets the floorId of the active edge segment
        completed.push({ x: currentPos.x, y: currentPos.y, floorId: segmentNodes[edgeIndex].floorId });

        // Remaining points: current projected position, plus edgeIndex + 1 through end
        const remaining: Point2D[] = [{ x: currentPos.x, y: currentPos.y, floorId: segmentNodes[edgeIndex].floorId }];
        for (let i = edgeIndex + 1; i < segmentNodes.length; i++) {
            remaining.push({ x: segmentNodes[i].x, y: segmentNodes[i].y, floorId: segmentNodes[i].floorId });
        }

        return {
            completedPoints: completed,
            remainingPoints: remaining
        };
    }
}
