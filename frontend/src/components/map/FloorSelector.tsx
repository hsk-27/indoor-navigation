import React from 'react';

interface FloorSelectorProps {
  availableFloors: number[];
  activeFloor: number;
  onSelectFloor: (floorId: number) => void;
}

const FloorSelector: React.FC<FloorSelectorProps> = ({ availableFloors, activeFloor, onSelectFloor }) => {
  if (availableFloors.length <= 1) return null;

  return (
    <div className="flex bg-surface-darker p-1 rounded-xl shadow-lg border border-white/10">
      {availableFloors.map(floor => (
        <button
          key={floor}
          onClick={() => onSelectFloor(floor)}
          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
            activeFloor === floor
              ? 'bg-primary-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          {floor === 1 ? 'GF' : `F${floor - 1}`}
        </button>
      ))}
    </div>
  );
};

export default FloorSelector;
