import React from 'react';
import { TerrainData, Biome } from '../services/localAutomations/terrainGenerationService';

interface TerrainViewProps {
  terrain: TerrainData;
}

const BIOME_COLORS: Record<Biome, string> = {
    OCEAN: '#2c3e50',       // Dark Slate Blue
    DOCKS: '#a0522d',       // Sienna Brown
    INDUSTRIAL: '#7f8c8d',  // Asbestos Gray
    SLUMS: '#8b4513',       // Saddle Brown
    RESIDENTIAL: '#27ae60', // Nephritis Green
    ENTERTAINMENT: '#8e44ad',// Wisteria Purple
    FINANCIAL: '#f1c40f',    // Sunflower Yellow
    GOVERNMENT: '#bdc3c7',  // Silver
};

export const TerrainView: React.FC<TerrainViewProps> = ({ terrain }) => {
  return (
    <div className="w-full h-full bg-black/50 rounded-md overflow-hidden border border-gray-700">
      <svg viewBox="0 0 1000 750" className="w-full h-full">
        <g id="terrain-biomes">
          {terrain.cells.map((cell) => (
            <path
              key={cell.id}
              d={cell.path}
              fill={BIOME_COLORS[cell.biome] || '#000'}
              stroke={BIOME_COLORS.OCEAN}
              strokeWidth="0.2"
            />
          ))}
        </g>
      </svg>
    </div>
  );
};