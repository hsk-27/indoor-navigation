import React, { useState, WheelEvent, MouseEvent as ReactMouseEvent } from 'react';

interface NodeData {
  id: number;
  name: string;
  type: string;
  floorId: number;
  qrId?: string;
  x: number;
  y: number;
}

interface EdgeData {
  id: number;
  sourceId: number;
  destinationId: number;
  distance: number;
}

interface EditorSVGViewerProps {
  floorId: number;
  svgUrl: string;
  nodes: NodeData[];
  edges: EdgeData[];
  mode: 'VIEW' | 'ADD_NODE' | 'ADD_EDGE';
  onMapClick: (x: number, y: number) => void;
  onNodeClick: (node: NodeData) => void;
  onEdgeClick: (edge: EdgeData) => void;
  selectedNodeId: number | null;
}

const EditorSVGViewer: React.FC<EditorSVGViewerProps> = React.memo(({
  floorId, svgUrl, nodes, edges, mode, onMapClick, onNodeClick, onEdgeClick, selectedNodeId
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const scaleAdjust = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(0.02, prev * scaleAdjust), 5));
  };

  const handleMouseDown = (e: ReactMouseEvent) => {
    if (mode !== 'VIEW') return; // Don't drag while adding nodes
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleSvgClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (mode === 'ADD_NODE') {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left - position.x) / scale);
      const y = Math.round((e.clientY - rect.top - position.y) / scale);
      onMapClick(x, y);
    }
  };

  // Color mapping based on node type
  const getNodeColor = (type: string) => {
    switch (type) {
      case 'ROOM': return '#3B82F6';
      case 'LAB': return '#8B5CF6';
      case 'STAIRCASE': return '#F59E0B';
      case 'LIFT': return '#F59E0B';
      case 'ENTRANCE': return '#10B981';
      case 'CORRIDOR': default: return '#9CA3AF';
    }
  };

  return (
    <div className="relative w-full h-[600px] bg-gray-50 overflow-hidden border border-gray-300 rounded-lg shadow-inner">
      <div className="absolute top-2 right-2 z-10 flex flex-col bg-white rounded shadow border border-gray-200">
        <button onClick={() => setScale(s => Math.min(s * 1.2, 5))} className="w-8 h-8 font-bold border-b hover:bg-gray-100">+</button>
        <button onClick={() => setScale(s => Math.max(s * 0.8, 0.02))} className="w-8 h-8 font-bold hover:bg-gray-100">-</button>
      </div>
      
      <div 
        className={`w-full h-full ${mode === 'ADD_NODE' ? 'cursor-crosshair' : (isDragging ? 'cursor-grabbing' : 'cursor-grab')}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          onClick={handleSvgClick}
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, 
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          className="absolute inset-0"
        >
          <img src={svgUrl} alt="Map Editor" className="w-full h-auto select-none pointer-events-none" />
          
          <svg className="absolute top-0 left-0 w-full h-full" style={{ overflow: 'visible' }}>
            {/* Draw Edges */}
            {edges.map(e => {
              const src = nodes.find(n => n.id === e.sourceId);
              const dst = nodes.find(n => n.id === e.destinationId);
              if (!src || !dst) return null;
              return (
                <line 
                  key={e.id} x1={src.x} y1={src.y} x2={dst.x} y2={dst.y} 
                  stroke="#9CA3AF" strokeWidth={Math.max(3, 4 / scale)}
                  onClick={(ev) => { ev.stopPropagation(); onEdgeClick(e); }}
                  className="cursor-pointer hover:stroke-red-500"
                />
              );
            })}
            
            {/* Draw Nodes */}
            {nodes.filter(n => n.floorId === floorId).map(n => (
              <g key={n.id} onClick={(e) => { e.stopPropagation(); onNodeClick(n); }} className="cursor-pointer">
                <circle 
                  cx={n.x} cy={n.y} r={n.id === selectedNodeId ? Math.max(10, 12 / scale) : Math.max(6, 8 / scale)} 
                  fill={getNodeColor(n.type)} 
                  stroke={n.id === selectedNodeId ? "#000" : "#fff"} strokeWidth={Math.max(2, 2 / scale)} 
                />
                {(scale > 0.5 || n.id === selectedNodeId) && (
                  <text x={n.x + Math.max(12, 12 / scale)} y={n.y + Math.max(4, 4 / scale)} fontSize={Math.max(12, 14 / scale)} fill="#374151" fontWeight="bold" className="pointer-events-none">
                    {n.name}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
});

export default EditorSVGViewer;
