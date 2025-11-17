import React from 'react';
import { SkeletonData } from '../services/localAutomations/skeletonGenerationService';

interface SkeletonViewProps {
  skeleton: SkeletonData;
  showPoints: boolean;
  showTriangulation: boolean;
  showCells: boolean;
}

export const SkeletonView: React.FC<SkeletonViewProps> = ({ skeleton, showPoints, showTriangulation, showCells }) => {
  return (
    <div className="w-full h-full bg-black/50 rounded-md overflow-hidden border border-gray-700">
      <svg viewBox="0 0 1000 750" className="w-full h-full">
        {showCells && (
            <g id="voronoi-cells">
            {skeleton.voronoiCellPaths.map((path, index) => (
                <path
                key={`cell-${index}`}
                d={path}
                fill="none"
                stroke="#6b7280" // gray-500
                strokeWidth="0.5"
                />
            ))}
            </g>
        )}
        {showTriangulation && (
            <g id="delaunay-triangulation">
                <path 
                    d={skeleton.delaunayPath}
                    fill="none"
                    stroke="#4f46e5" // indigo-600
                    strokeWidth="0.3"
                />
            </g>
        )}
        {showPoints && (
            <g id="raw-points">
            {skeleton.points.map(([x, y], index) => (
                <circle 
                    key={`point-${index}`}
                    cx={x}
                    cy={y}
                    r="1"
                    fill="#f59e0b" // yellow-500
                />
            ))}
            </g>
        )}
      </svg>
    </div>
  );
};
