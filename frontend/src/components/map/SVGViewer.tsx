import React, { useState, MouseEvent, WheelEvent, TouchEvent } from 'react';
import RouteOverlay from './RouteOverlay';
import { useRouteContext } from '../../context/RouteContext';

interface SVGViewerProps {
  floorId: number;
  svgUrl: string;
}

const SVGViewer: React.FC<SVGViewerProps> = React.memo(({ floorId, svgUrl }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [svgError, setSvgError] = useState(false);
  
  const { routeResult, activeFloor } = useRouteContext();

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const scaleAdjust = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.02, scale * scaleAdjust), 5);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const newX = mouseX - ((mouseX - position.x) * newScale) / scale;
    const newY = mouseY - ((mouseY - position.y) * newScale) / scale;
    
    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  const handleMouseDown = (e: MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX - position.x, y: e.touches[0].clientY - position.y });
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
  };

  const currentFloorPath = routeResult?.path.filter(n => n.floorId === activeFloor) || [];

  return (
    <div className="relative w-full h-[60vh] bg-surface-darker overflow-hidden rounded-3xl shadow-2xl shadow-black/50 border border-white/5">
      {svgError && (
        <div className="absolute inset-0 flex items-center justify-center flex-col z-20 bg-surface-darker">
          <svg className="w-12 h-12 text-slate-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
          <span className="text-white font-bold mb-1">Map Unavailable</span>
          <span className="text-slate-400 text-sm text-center">Floor map SVG is missing.</span>
        </div>
      )}

      {/* Interaction Surface */}
      <div 
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} touch-none`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* Mock background pattern for when SVG is loading or missing */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

        <div 
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, 
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          className="absolute inset-0 will-change-transform z-0"
        >
          <img 
            src={svgUrl} 
            alt={`Floor ${floorId} Map`} 
            className="absolute top-0 left-0 w-full h-auto select-none pointer-events-none opacity-80" 
            onError={() => setSvgError(true)}
            onLoad={() => setSvgError(false)}
          />
        </div>

        <div
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, 
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          className="absolute inset-0 will-change-transform z-10"
        >
          {!svgError && currentFloorPath.length > 0 && (
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
              <RouteOverlay nodes={currentFloorPath} accessProfile={'AUTHORIZED_LIFT_USER'} />
            </svg>
          )}
        </div>
      </div>
      
      {/* Zoom Controls Overlay */}
      <div className="absolute bottom-6 right-6 flex flex-col space-y-2 z-30">
        <button className="w-10 h-10 bg-surface-glass border border-white/10 rounded-full flex items-center justify-center text-white shadow-lg backdrop-blur-md active:scale-95 transition-transform" onClick={() => setScale(s => Math.min(s * 1.2, 5))}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </button>
        <button className="w-10 h-10 bg-surface-glass border border-white/10 rounded-full flex items-center justify-center text-white shadow-lg backdrop-blur-md active:scale-95 transition-transform" onClick={() => setScale(s => Math.max(s * 0.8, 0.02))}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
        </button>
      </div>
    </div>
  );
});

export default SVGViewer;
