
import React from 'react';

interface VoronoiScaffoldViewProps {
  cells: string[];
}

export const VoronoiScaffoldView: React.FC<VoronoiScaffoldViewProps> = ({ cells }) => {
  return (
    <div className="w-full h-full bg-black/50 rounded-md overflow-hidden border border-gray-700">
      <svg viewBox="0 0 1000 750" className="w-full h-full">
        <g id="voronoi-scaffold">
          {cells.map((path, index) => (
            <path
              key={index}
              d={path}
              fill="none"
              stroke="#4b5563" // gray-600
              strokeWidth="0.5"
            />
          ))}
        </g>
      </svg>
    </div>
  );
};
