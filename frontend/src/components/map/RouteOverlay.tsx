import React from 'react';
import { NodeInfo } from '../../context/RouteContext';

interface RouteOverlayProps {
  nodes: NodeInfo[];
  accessProfile?: string;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({ nodes, accessProfile = 'AUTHORIZED_LIFT_USER' }) => {
  if (!nodes || nodes.length < 2) return null;

  const routeColor = accessProfile === 'STUDENT' ? '#3b82f6' : '#10b981'; // Blue vs Green
  const endColor = '#10b981'; // Keep destination green

  const points = nodes.map(n => `${n.x},${n.y}`).join(' ');

  return (
    <g className="animate-fade-in">
      {/* Route shadow for depth */}
      <polyline 
        points={points} 
        fill="none" 
        stroke="rgba(0,0,0,0.5)" 
        strokeWidth="10" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="transform translate-y-1"
      />
      {/* Main route line */}
      <polyline 
        points={points} 
        fill="none" 
        stroke={routeColor} 
        strokeWidth="6" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className="animate-pulse"
      />
      {/* Animated Dash array to indicate direction */}
      <polyline 
        points={points} 
        fill="none" 
        stroke="#ffffff" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        strokeDasharray="8 8"
        className="animate-route-flow"
        style={{ animation: 'dashFlow 1s linear infinite' }}
      />
      <style>
        {`
          @keyframes dashFlow {
            to {
              stroke-dashoffset: -16;
            }
          }
        `}
      </style>

      {/* Node Markers */}
      {nodes.map((node, index) => {
        const isStart = index === 0;
        const isEnd = index === nodes.length - 1;
        const isIntermediate = !isStart && !isEnd;

        return (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            {isStart && (
              <>
                <circle r="12" fill={routeColor} fillOpacity="0.2" className="animate-ping" />
                <circle r="6" fill={routeColor} stroke="#ffffff" strokeWidth="2" />
              </>
            )}
            {isEnd && (
              <>
                <circle r="14" fill={endColor} fillOpacity="0.3" className="animate-ping" />
                <circle r="8" fill={endColor} stroke="#ffffff" strokeWidth="2.5" />
              </>
            )}
            {isIntermediate && (
              <circle r="3" fill="#ffffff" />
            )}
          </g>
        );
      })}
    </g>
  );
};

export default RouteOverlay;
