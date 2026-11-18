import React from 'react';
import { GraphNodeData, GraphEdgeData, GraphMetadataData, NodeType, EdgeDirection, TraversalType } from '../../localization/types/GraphTypes';
import { ValidationIssue } from './ValidationEngine';
import { API_BASE_URL } from '../../config';

interface InspectorsProps {
    edges: GraphEdgeData[];
    selectedNode: GraphNodeData | null;
    selectedEdge: GraphEdgeData | null;
    metadata: GraphMetadataData | null;
    validationIssues: ValidationIssue[];
    onUpdateNode: (node: GraphNodeData) => void;
    onUpdateEdge: (edge: GraphEdgeData) => void;
    onUpdateMetadata: (meta: GraphMetadataData) => void;
    onSelectIssue: (issue: ValidationIssue) => void;
    onDeleteNode: (nodeId: number) => void;
    onDeleteEdge: (edgeId: number) => void;
    onSplitEdgeWithBend?: (edgeId: number) => void;
    onCreateCrossFloorEdge?: (targetId: number) => void;
}

const DESTINATION_NODE_TYPES: NodeType[] = ['ROOM', 'LABORATORY', 'OFFICE', 'CLASSROOM', 'WASHROOM', 'RECEPTION', 'UTILITY'];
const CONNECTOR_NODE_TYPES: NodeType[] = ['STAIRCASE', 'LIFT', 'CORRIDOR', 'CORRIDOR_INTERSECTION', 'CORRIDOR_BEND', 'ENTRANCE', 'BUILDING_ENTRANCE', 'FLOOR_ENTRANCE', 'EMERGENCY_EXIT'];
const EDGE_DIRECTIONS: EdgeDirection[] = ['BIDIRECTIONAL', 'FORWARD', 'REVERSE'];
const TRAVERSAL_TYPES = ['NORMAL', 'STAIRS', 'LIFT', 'RAMP'];

export const Inspectors: React.FC<InspectorsProps> = ({ 
    edges,
    selectedNode, selectedEdge, metadata, validationIssues, 
    onUpdateNode, onUpdateEdge, onUpdateMetadata, onSelectIssue,
    onDeleteNode, onDeleteEdge, onSplitEdgeWithBend, onCreateCrossFloorEdge
}) => {
    const [globalConnectors, setGlobalConnectors] = React.useState<GraphNodeData[]>([]);
    const [selectedTargetId, setSelectedTargetId] = React.useState<number | ''>('');

    const prevNodeIdRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        if (selectedNode && CONNECTOR_NODE_TYPES.includes(selectedNode.type)) {
            if (prevNodeIdRef.current !== selectedNode.id) {
                prevNodeIdRef.current = selectedNode.id;
                const token = localStorage.getItem("admin_token");
                fetch(`${API_BASE_URL}/api/v1/admin/nodes`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                .then(r => r.json())
                .then((data: any[]) => {
                    if(Array.isArray(data)) {
                        const VALID_TARGET_TYPES = ['STAIRCASE', 'LIFT', 'EMERGENCY_EXIT', 'FLOOR_ENTRANCE', 'BUILDING_ENTRANCE'];
                        const mapped = data.map(n => ({
                            ...n, floorId: n.floor ? n.floor.id : n.floorId
                        })).filter(n => VALID_TARGET_TYPES.includes(n.type) && n.id !== selectedNode.id);
                        setGlobalConnectors(mapped);
                    }
                })
                .catch(e => console.error(e));
            }
        } else {
            prevNodeIdRef.current = null;
        }
    }, [selectedNode?.id]);

    return (
        <div className="inspector-panel" style={{ width: '100%', backgroundColor: '#ffffff', color: '#334155', padding: '15px', flexShrink: 0, boxSizing: 'border-box' }}>
            
            {/* NODE INSPECTOR */}
            {selectedNode && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginTop: 0 }}>Node Inspector</h3>
                    
                    <label>ID</label>
                    <input type="text" disabled value={selectedNode.id} style={inputStyle} />
                    
                    <label>Display Name</label>
                    <input type="text" value={selectedNode.name || ''} onChange={e => onUpdateNode({...selectedNode, name: e.target.value})} style={inputStyle} />
                    
                    <label>Internal Name</label>
                    <input type="text" value={selectedNode.internalName || ''} onChange={e => onUpdateNode({...selectedNode, internalName: e.target.value})} style={inputStyle} />
                    
                    <label>Description</label>
                    <textarea value={selectedNode.description || ''} onChange={e => onUpdateNode({...selectedNode, description: e.target.value})} style={{...inputStyle, minHeight: '60px'}} />
                    
                    <label>Node Category</label>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="nodeCategory" 
                                checked={DESTINATION_NODE_TYPES.includes(selectedNode.type)} 
                                onChange={() => onUpdateNode({...selectedNode, type: 'ROOM'})}
                            />
                            Destination
                        </label>
                        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                            <input 
                                type="radio" 
                                name="nodeCategory" 
                                checked={CONNECTOR_NODE_TYPES.includes(selectedNode.type)} 
                                onChange={() => onUpdateNode({...selectedNode, type: 'STAIRCASE'})}
                            />
                            Connector (Lifts/Stairs)
                        </label>
                    </div>

                    <label>Specific Type</label>
                    <select 
                        value={selectedNode.type} 
                        onChange={e => {
                            const newType = e.target.value as NodeType;
                            const updates: Partial<GraphNodeData> = { type: newType };
                            if (newType === 'CORRIDOR_BEND') {
                                updates.isSearchable = false;
                                if (!selectedNode.name || selectedNode.name === 'New Node' || selectedNode.name.startsWith('Room ')) {
                                    const suffix = Math.abs(selectedNode.id).toString().padStart(3, '0');
                                    updates.name = `CB_${suffix}`;
                                }
                            } else {
                                if (!selectedNode.name || selectedNode.name === 'New Node' || selectedNode.name.startsWith('Room ') || selectedNode.name === 'Corridor' || selectedNode.name === 'Staircase' || selectedNode.name === 'Lift') {
                                    const titleCased = newType
                                        .split('_')
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                                        .join(' ');
                                    updates.name = titleCased;
                                }
                            }
                            onUpdateNode({ ...selectedNode, ...updates });
                        }} 
                        style={inputStyle}
                    >
                        {DESTINATION_NODE_TYPES.includes(selectedNode.type) ? (
                            DESTINATION_NODE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)
                        ) : (
                            CONNECTOR_NODE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)
                        )}
                    </select>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>X Coord</label>
                            <input type="number" value={selectedNode.x} onChange={e => onUpdateNode({...selectedNode, x: parseFloat(e.target.value)})} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Y Coord</label>
                            <input type="number" value={selectedNode.y} onChange={e => onUpdateNode({...selectedNode, y: parseFloat(e.target.value)})} style={inputStyle} />
                        </div>
                    </div>

                    <label>Floor ID</label>
                    <input type="number" value={selectedNode.floorId} onChange={e => onUpdateNode({...selectedNode, floorId: parseInt(e.target.value)})} style={inputStyle} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                        <input type="checkbox" checked={selectedNode.isEnabled ?? true} onChange={e => onUpdateNode({...selectedNode, isEnabled: e.target.checked})} id="nodeEnabled" />
                        <label htmlFor="nodeEnabled" style={{ marginLeft: '8px', cursor: 'pointer' }}>Enabled for A* Routing</label>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                        <input type="checkbox" checked={selectedNode.routeVisibility ?? true} onChange={e => onUpdateNode({...selectedNode, routeVisibility: e.target.checked})} id="nodeVis" />
                        <label htmlFor="nodeVis" style={{ marginLeft: '8px', cursor: 'pointer' }}>Visible on Map</label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                        <input type="checkbox" checked={selectedNode.isAccessible ?? true} onChange={e => onUpdateNode({...selectedNode, isAccessible: e.target.checked})} id="nodeAcc" />
                        <label htmlFor="nodeAcc" style={{ marginLeft: '8px', cursor: 'pointer' }}>Wheelchair Accessible</label>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                        <input type="checkbox" checked={selectedNode.isSearchable ?? true} onChange={e => onUpdateNode({...selectedNode, isSearchable: e.target.checked})} id="nodeSearch" />
                        <label htmlFor="nodeSearch" style={{ marginLeft: '8px', cursor: 'pointer' }}>Searchable (Index)</label>
                    </div>

                    {CONNECTOR_NODE_TYPES.includes(selectedNode.type) && onCreateCrossFloorEdge && (
                        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '6px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155' }}>Cross-Floor Connections</h4>
                            {edges.filter(e => e.isFloorTransition && (e.sourceId === selectedNode.id || e.destinationId === selectedNode.id)).map(e => (
                                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '13px' }}>
                                    <span style={{ color: '#475569' }}>Linked to Node {e.sourceId === selectedNode.id ? e.destinationId : e.sourceId}</span>
                                    <button onClick={() => { if(window.confirm('Delete this cross-floor link?')) onDeleteEdge(e.id); }} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
                                </div>
                            ))}
                            {edges.filter(e => e.isFloorTransition && (e.sourceId === selectedNode.id || e.destinationId === selectedNode.id)).length === 0 && (
                                <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' }}>No links configured.</div>
                            )}

                            <div style={{ marginTop: '15px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#64748b' }}>Link to another floor</label>
                                <select 
                                    value={selectedTargetId}
                                    onChange={(e) => setSelectedTargetId(parseInt(e.target.value) || '')}
                                    style={{ ...inputStyle, marginBottom: '8px' }}
                                >
                                    <option value="" disabled>Select Target Node...</option>
                                    {globalConnectors.map(n => (
                                        <option key={n.id} value={n.id}>
                                            Floor {n.floorId} - {n.name || n.type} (ID: {n.id})
                                        </option>
                                    ))}
                                </select>
                                <button 
                                    onClick={() => {
                                        if(selectedTargetId) {
                                            onCreateCrossFloorEdge(selectedTargetId as number);
                                            setSelectedTargetId('');
                                        }
                                    }}
                                    disabled={!selectedTargetId}
                                    style={{ padding: '8px 12px', backgroundColor: selectedTargetId ? '#10b981' : '#94a3b8', color: 'white', border: 'none', borderRadius: '6px', cursor: selectedTargetId ? 'pointer' : 'not-allowed', fontWeight: 'bold', width: '100%' }}
                                >
                                    Create Link
                                </button>
                            </div>
                        </div>
                    )}
                    <button 
                        onClick={() => { if (window.confirm('Delete this node?')) onDeleteNode(selectedNode.id); }}
                        style={{ ...inputStyle, backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold' }}
                    >
                        Delete Node
                    </button>
                </div>
            )}

            {/* EDGE INSPECTOR */}
            {selectedEdge && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginTop: 0 }}>Edge Inspector</h3>
                    
                    <label>ID</label>
                    <input type="text" disabled value={selectedEdge.id} style={inputStyle} />

                    <label>Source Node ID</label>
                    <input type="text" disabled value={selectedEdge.sourceId} style={inputStyle} />

                    <label>Destination Node ID</label>
                    <input type="text" disabled value={selectedEdge.destinationId} style={inputStyle} />

                    <label>Weight (Auto-computed distance)</label>
                    <input type="number" disabled value={selectedEdge.distance.toFixed(2)} style={inputStyle} />

                    <label>Direction</label>
                    <select value={selectedEdge.direction || 'BIDIRECTIONAL'} onChange={e => onUpdateEdge({...selectedEdge, direction: e.target.value as EdgeDirection})} style={inputStyle}>
                        {EDGE_DIRECTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <label>Traversal Mode</label>
                    <select value={selectedEdge.traversalType || 'NORMAL'} onChange={e => onUpdateEdge({...selectedEdge, traversalType: e.target.value as TraversalType})} style={inputStyle}>
                        {TRAVERSAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px' }}>
                        <input type="checkbox" checked={selectedEdge.isEnabled ?? true} onChange={e => onUpdateEdge({...selectedEdge, isEnabled: e.target.checked})} id="edgeEnabled" />
                        <label htmlFor="edgeEnabled" style={{ marginLeft: '8px', cursor: 'pointer' }}>Enabled for A* Routing</label>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: '5px' }}>
                        <input type="checkbox" checked={selectedEdge.isFloorTransition ?? false} onChange={e => onUpdateEdge({...selectedEdge, isFloorTransition: e.target.checked})} id="edgeTrans" />
                        <label htmlFor="edgeTrans" style={{ marginLeft: '8px', cursor: 'pointer' }}>Vertical Transition (Stairs/Lift)</label>
                    </div>

                    {onSplitEdgeWithBend && (
                        <button 
                            onClick={() => onSplitEdgeWithBend(selectedEdge.id)}
                            style={{ ...inputStyle, backgroundColor: '#0ea5e9', color: '#fff', border: 'none', cursor: 'pointer', marginTop: '15px', fontWeight: 'bold' }}
                            title="Split this edge and insert an intermediate Corner/Bend node"
                        >
                            + Insert Bend Node (Split Edge)
                        </button>
                    )}

                    <button 
                        onClick={() => { if (window.confirm('Delete this edge?')) onDeleteEdge(selectedEdge.id); }}
                        style={{ ...inputStyle, backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', marginTop: '10px', fontWeight: 'bold' }}
                    >
                        Delete Edge
                    </button>
                </div>
            )}

            {/* GRAPH METADATA INSPECTOR */}
            {!selectedNode && !selectedEdge && metadata && (
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '5px', marginTop: 0 }}>Graph Metadata</h3>
                    
                    <label>Building Name</label>
                    <input type="text" value={metadata.buildingName || ''} onChange={e => onUpdateMetadata({...metadata, buildingName: e.target.value})} style={inputStyle} />
                    
                    <label>Campus Name</label>
                    <input type="text" value={metadata.campusName || ''} onChange={e => onUpdateMetadata({...metadata, campusName: e.target.value})} style={inputStyle} />
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>SVG Width</label>
                            <input type="number" value={metadata.svgWidth || 0} onChange={e => onUpdateMetadata({...metadata, svgWidth: parseFloat(e.target.value)})} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>SVG Height</label>
                            <input type="number" value={metadata.svgHeight || 0} onChange={e => onUpdateMetadata({...metadata, svgHeight: parseFloat(e.target.value)})} style={inputStyle} />
                        </div>
                    </div>

                    <label>Pixels Per Meter (PPM)</label>
                    <input type="number" value={metadata.pixelsPerMeter || 0} onChange={e => onUpdateMetadata({...metadata, pixelsPerMeter: parseFloat(e.target.value)})} style={inputStyle} />
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>Origin X</label>
                            <input type="number" value={metadata.originX || 0} onChange={e => onUpdateMetadata({...metadata, originX: parseFloat(e.target.value)})} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>Origin Y</label>
                            <input type="number" value={metadata.originY || 0} onChange={e => onUpdateMetadata({...metadata, originY: parseFloat(e.target.value)})} style={inputStyle} />
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label>Rotation (deg)</label>
                            <input type="number" value={metadata.rotation || 0} onChange={e => onUpdateMetadata({...metadata, rotation: parseFloat(e.target.value)})} style={inputStyle} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label>North Offset</label>
                            <input type="number" value={metadata.northOffset || 0} onChange={e => onUpdateMetadata({...metadata, northOffset: parseFloat(e.target.value)})} style={inputStyle} />
                        </div>
                    </div>
                </div>
            )}

            {/* VALIDATION PANEL */}
            <div style={{ marginTop: '30px' }}>
                <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>Validation Engine</h3>
                {validationIssues.length === 0 ? (
                    <div style={{ color: '#16a34a', fontSize: '14px', padding: '10px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                        ✓ Graph is topologically sound
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {validationIssues.map(issue => (
                            <div 
                                key={issue.id} 
                                onClick={() => onSelectIssue(issue)}
                                style={{ 
                                    padding: '8px', 
                                    backgroundColor: issue.severity === 'ERROR' ? 'rgba(244, 67, 54, 0.1)' : issue.severity === 'WARNING' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(33, 150, 243, 0.1)',
                                    borderLeft: `3px solid ${issue.severity === 'ERROR' ? '#222222' : issue.severity === 'WARNING' ? '#aaaaaa' : '#ffffff'}`,
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                <strong>{issue.severity}</strong>: {issue.message}
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
};

const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    marginBottom: '12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #cbd5e1',
    color: '#334155',
    borderRadius: '6px',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s'
};
