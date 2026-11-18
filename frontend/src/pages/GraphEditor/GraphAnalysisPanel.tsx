import React, { useMemo } from 'react';
import { GraphNodeData, GraphEdgeData } from '../../localization/types/GraphTypes';

interface Props {
    nodes: GraphNodeData[];
    edges: GraphEdgeData[];
}

export const GraphAnalysisPanel: React.FC<Props> = ({ nodes, edges }) => {
    const stats = useMemo(() => {
        const totalNodes = nodes.length;
        const totalEdges = edges.length;
        
        let totalDistance = 0;
        let maxDistance = 0;
        let minDistance = Infinity;

        edges.forEach(e => {
            totalDistance += e.distance;
            if (e.distance > maxDistance) maxDistance = e.distance;
            if (e.distance < minDistance) minDistance = e.distance;
        });

        const avgDistance = totalEdges > 0 ? totalDistance / totalEdges : 0;
        const avgBranching = totalNodes > 0 ? (totalEdges * 2) / totalNodes : 0;
        
        const typeCounts: Record<string, number> = {};
        nodes.forEach(n => {
            typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
        });

        // Connectivity (Connected Components)
        let components = 0;
        if (totalNodes > 0) {
            const adj = new Map<number, number[]>();
            nodes.forEach(n => adj.set(n.id, []));
            edges.forEach(e => {
                adj.get(e.sourceId)?.push(e.destinationId);
                adj.get(e.destinationId)?.push(e.sourceId);
            });

            const visited = new Set<number>();
            nodes.forEach(n => {
                if (!visited.has(n.id)) {
                    components++;
                    const queue = [n.id];
                    visited.add(n.id);
                    while (queue.length > 0) {
                        const curr = queue.shift()!;
                        (adj.get(curr) || []).forEach(nxt => {
                            if (!visited.has(nxt)) {
                                visited.add(nxt);
                                queue.push(nxt);
                            }
                        });
                    }
                }
            });
        }

        return {
            totalNodes,
            totalEdges,
            avgDistance,
            maxDistance,
            minDistance: minDistance === Infinity ? 0 : minDistance,
            avgBranching,
            typeCounts,
            components
        };
    }, [nodes, edges]);

    return (
        <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Graph Analysis</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div><strong>Total Nodes:</strong> {stats.totalNodes}</div>
                <div><strong>Total Edges:</strong> {stats.totalEdges}</div>
                <div><strong>Avg Degree:</strong> {stats.avgBranching.toFixed(2)}</div>
                <div><strong>Components:</strong> {stats.components}</div>
                <div><strong>Avg Length:</strong> {stats.avgDistance.toFixed(2)}m</div>
                <div><strong>Max Length:</strong> {stats.maxDistance.toFixed(2)}m</div>
            </div>
            
            <h5 style={{ margin: '1rem 0 0.5rem 0' }}>Node Types</h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem' }}>
                {Object.entries(stats.typeCounts).map(([type, count]) => (
                    <div key={type}>{type}: {count}</div>
                ))}
            </div>
        </div>
    );
};
