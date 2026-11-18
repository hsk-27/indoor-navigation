import React from 'react';

interface MapToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFitScreen: () => void;
  currentFloor: number;
}

const MapToolbar: React.FC<MapToolbarProps> = ({ onZoomIn, onZoomOut, onReset, onFitScreen, currentFloor }) => {
  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col bg-white rounded shadow-md border border-gray-200 overflow-hidden text-gray-800">
      <div className="w-10 h-10 flex items-center justify-center font-bold bg-blue-50 text-blue-800 border-b border-gray-200 text-sm" title="Current Floor">
        F{currentFloor}
      </div>
      <button onClick={onZoomIn} className="w-10 h-10 flex items-center justify-center font-bold hover:bg-gray-100 border-b border-gray-200 text-lg transition-colors" title="Zoom In">+</button>
      <button onClick={onZoomOut} className="w-10 h-10 flex items-center justify-center font-bold hover:bg-gray-100 border-b border-gray-200 text-lg transition-colors" title="Zoom Out">-</button>
      <button onClick={onReset} className="w-10 h-10 flex items-center justify-center font-semibold hover:bg-gray-100 border-b border-gray-200 text-xs transition-colors" title="Reset Zoom">RST</button>
      <button onClick={onFitScreen} className="w-10 h-10 flex items-center justify-center font-semibold hover:bg-gray-100 text-xs transition-colors" title="Fit to Screen">FIT</button>
    </div>
  );
};

export default MapToolbar;
