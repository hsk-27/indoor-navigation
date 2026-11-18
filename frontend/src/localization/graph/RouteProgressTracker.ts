import { SnappedEdge } from './GraphSnapper';

export class RouteProgressTracker {
    private activeRouteEdges: Set<number> = new Set();
    
    public setActiveRoute(edgeIds: number[]) {
        this.activeRouteEdges = new Set(edgeIds);
    }
    
    public isOnRoute(edge: SnappedEdge): boolean {
        if (this.activeRouteEdges.size === 0) return true; // No route active
        return this.activeRouteEdges.has(edge.edgeId);
    }

    public getActiveRouteEdges(): Set<number> {
        return this.activeRouteEdges;
    }
}
