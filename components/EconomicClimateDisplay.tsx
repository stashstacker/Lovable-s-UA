
import React from 'react';
import { EconomicClimate } from '../types';

interface EconomicClimateDisplayProps {
  economicClimate: EconomicClimate;
}

export const EconomicClimateDisplay: React.FC<EconomicClimateDisplayProps> = ({ economicClimate }) => {
  return (
    <div className="bg-black/20 border border-gray-700/50 rounded-lg p-3 mb-6 text-center shadow-md">
      <p className="text-gray-400 text-sm italic">
        <span className="font-semibold text-gray-300">Economic Climate: </span>
        {economicClimate.description}
      </p>
    </div>
  );
};