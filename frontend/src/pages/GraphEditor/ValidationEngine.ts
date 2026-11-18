import { GraphNodeData, GraphEdgeData, GraphMetadataData, NodeType } from '../../localization/types/GraphTypes';

export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface ValidationIssue {
    id: string;
    severity: ValidationSeverity;
    message: string;
    elementIds: number[];
}

const DESTINATION_NODE_TYPES: NodeType[] = ['ROOM', 'LABORATORY', 'OFFICE', 'CLASSROOM', 'WASHROOM', 'RECEPTION', 'UTILITY'];
const CONNECTOR_NODE_TYPES: NodeType[] = ['STAIRCASE', 'LIFT', 'CORRIDOR', 'CORRIDOR_INTERSECTION', 'CORRIDOR_BEND', 'ENTRANCE', 'BUILDING_ENTRANCE', 'FLOOR_ENTRANCE', 'EMERGENCY_EXIT'];

export class ValidationEngine {
    static validateImportPackage(payload: any): { valid: boolean, errors: string[] } {
        return { valid: true, errors: [] };
    }

    static validateGraph(nodes: GraphNodeData[], edges: GraphEdgeData[], metadata: GraphMetadataData | null, currentFloorId?: number): ValidationIssue[] {
        const issues: ValidationIssue[] = [];
        const nodeMap = new Map<number, GraphNodeData>();
        nodes.forEach(n => nodeMap.set(n.id, n));

        // 1. Metadata & Calibration Validation
        if (!metadata) {
            issues.push({ id: `missing_metadata`, severity: 'ERROR', message: `Graph metadata is entirely missing.`, elementIds: [] });
        } else {
            if (!metadata.pixelsPerMeter || metadata.pixelsPerMeter <= 1.0) {
                issues.push({ id: `missing_calibration`, severity: 'WARNING', message: `Floor appears uncalibrated (PixelsPerMeter <= 1.0).`, elementIds: [] });
            } else if (metadata.pixelsPerMeter > 1000) {
                issues.push({ id: `invalid_calibration`, severity: 'ERROR', message: `PixelsPerMeter is abnormally high (${metadata.pixelsPerMeter}).`, elementIds: [] });
            }
            if (metadata.svgWidth === undefined || metadata.svgWidth <= 0 || metadata.svgHeight === undefined || metadata.svgHeight <= 0) {
                issues.push({ id: `invalid_svg_dims`, severity: 'ERROR', message: `SVG dimensions are missing or invalid in metadata.`, elementIds: [] });
            }
        }

        // 2. Node Level Validation
        const idSet = new Set<number>();
        const coordMap = new Map<string, number[]>();
        const nameMap = new Map<string, number[]>();
        let entranceCount = 0;

        nodes.forEach(n => {
            // Duplicate IDs
            if (idSet.has(n.id)) {
                issues.push({ id: `dup_id_${n.id}`, severity: 'ERROR', message: `Duplicate Node ID detected.`, elementIds: [n.id] });
            }
            idSet.add(n.id);

            // Floor Reference
            if (n.floorId === undefined || n.floorId === null) {
                issues.push({ id: `invalid_floor_ref_${n.id}`, severity: 'ERROR', message: `Node "${n.name || n.id}" has no floor reference.`, elementIds: [n.id] });
            } else if (currentFloorId && n.floorId !== currentFloorId) {
                // If it's on this map but floorId doesn't match
                issues.push({ id: `mismatch_floor_ref_${n.id}`, severity: 'ERROR', message: `Node "${n.name || n.id}" belongs to floor ${n.floorId} but is on current floor ${currentFloorId}.`, elementIds: [n.id] });
            }

            // Duplicate Coordinates
            const coordKey = `${n.x.toFixed(2)},${n.y.toFixed(2)}`;
            const cList = coordMap.get(coordKey) || [];
            cList.push(n.id);
            coordMap.set(coordKey, cList);

            // Duplicate Names
            if (n.name && n.name.trim() !== '') {
                const key = n.name.trim().toLowerCase();
                const list = nameMap.get(key) || [];
                list.push(n.id);
                nameMap.set(key, list);
            }

            // Entrances
            if (['ENTRANCE', 'BUILDING_ENTRANCE', 'FLOOR_ENTRANCE'].includes(n.type)) {
                entranceCount++;
            }
            
            // Bounds
            if (metadata && metadata.svgWidth && metadata.svgHeight) {
                if (n.x < 0 || n.y < 0 || n.x > metadata.svgWidth || n.y > metadata.svgHeight) {
                    issues.push({ id: `out_of_bounds_${n.id}`, severity: 'ERROR', message: `Node "${n.name || n.id}" is outside the SVG canvas bounds.`, elementIds: [n.id] });
                }
            }
        });

        // Zero-length or overlapping nodes
        edges.forEach(e => {
            const src = nodeMap.get(e.sourceId);
            const dest = nodeMap.get(e.destinationId);
            if (src && dest && src.x === dest.x && src.y === dest.y && src.floorId === dest.floorId) {
                issues.push({
                    id: `overlapping_${e.id}`,
                    severity: 'ERROR',
                    message: `Edge connects overlapping nodes.`,
                    elementIds: [e.sourceId, e.destinationId]
                });
            }
        });

        nameMap.forEach((ids, name) => {
            if (ids.length > 1) {
                issues.push({ id: `duplicate_name_${name}`, severity: 'WARNING', message: `Duplicate node name: "${name}"`, elementIds: ids });
            }
        });

        if (entranceCount === 0 && nodes.length > 0) {
            issues.push({ id: `missing_entrance`, severity: 'WARNING', message: `This floor has no entrance or transition nodes.`, elementIds: [] });
        }

        // 3. Edge Level Validation
        const edgePairs = new Set<string>();
        
        edges.forEach(e => {
            // Negative Weights
            if (e.distance < 0) {
                issues.push({ id: `neg_weight_${e.id}`, severity: 'ERROR', message: `Edge has a negative weight (${e.distance}).`, elementIds: [e.id] });
            } else if (e.distance === 0) {
                issues.push({ id: `zero_weight_${e.id}`, severity: 'ERROR', message: `Edge has a zero weight.`, elementIds: [e.id] });
            }

            // Self loops
            if (e.sourceId === e.destinationId) {
                issues.push({ id: `self_loop_${e.id}`, severity: 'ERROR', message: `Edge is a circular self-loop on node ${e.sourceId}.`, elementIds: [e.sourceId, e.id] });
            }

            // Missing references
            if (!nodeMap.has(e.sourceId) || !nodeMap.has(e.destinationId)) {
                // Warning only if it's a cross-floor transition we don't have loaded locally, but if it's supposedly local:
                const srcLocal = nodeMap.has(e.sourceId);
                const dstLocal = nodeMap.has(e.destinationId);
                if (!srcLocal && !dstLocal) {
                    issues.push({ id: `orphan_edge_${e.id}`, severity: 'ERROR', message: `Edge references two missing nodes.`, elementIds: [e.id] });
                }
            }

            // Duplicate edges
            const p1 = Math.min(e.sourceId, e.destinationId);
            const p2 = Math.max(e.sourceId, e.destinationId);
            const pairKey = `${p1}-${p2}`;
            if (edgePairs.has(pairKey)) {
                issues.push({ id: `dup_edge_${e.id}`, severity: 'WARNING', message: `Multiple edges exist between the same two nodes.`, elementIds: [e.sourceId, e.destinationId, e.id] });
            }
            edgePairs.add(pairKey);
        });

        // 4. Graph Topology Validation (Adjacency & Connectivity)
        const adj = new Map<number, number[]>();
        nodes.forEach(n => adj.set(n.id, []));
        
        edges.forEach(e => {
            if (adj.has(e.sourceId)) adj.get(e.sourceId)!.push(e.destinationId);
            if (adj.has(e.destinationId)) adj.get(e.destinationId)!.push(e.sourceId);
        });

        let components = 0;
        const visited = new Set<number>();
        
        nodes.forEach(n => {
            const neighbors = adj.get(n.id) || [];
            
            // Isolated nodes (Degree 0)
            if (neighbors.length === 0) {
                issues.push({ id: `isolated_node_${n.id}`, severity: 'WARNING', message: `Node "${n.name || n.id}" is completely disconnected.`, elementIds: [n.id] });
            }

            // Dead-end connectors (Degree 1, but supposed to be a connector)
            if (neighbors.length === 1) {
                if (CONNECTOR_NODE_TYPES.includes(n.type) && !['STAIRCASE', 'LIFT', 'ENTRANCE', 'BUILDING_ENTRANCE', 'FLOOR_ENTRANCE', 'EMERGENCY_EXIT'].includes(n.type)) {
                    issues.push({ id: `deadend_connector_${n.id}`, severity: 'WARNING', message: `Connector node "${n.name || n.id}" (${n.type}) is a dead end (only 1 connection).`, elementIds: [n.id] });
                }
            }

            // Reachability / Connected Components
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

        if (components > 1 && nodes.length > 0) {
            issues.push({ id: `disconnected_graph`, severity: 'WARNING', message: `Graph is split into ${components} disconnected components. Paths between them will fail.`, elementIds: [] });
        }

        return issues;
    }
}
