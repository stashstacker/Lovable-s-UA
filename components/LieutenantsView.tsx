

import React from 'react';
import { Lieutenant } from '../types';
import { Button } from './Button';
import { DollarSignIcon, StarIcon } from './icons';
// FIX: Imported GAME_MECHANICS and getHeatCostModifier to calculate dynamic costs.
import { GAME_MECHANICS, getHeatCostModifier } from '../constants';

interface LieutenantsViewProps {
  lieutenants: Lieutenant[];
  onPursue: (lieutenant: Lieutenant) => void;
  playerCash: number;
  // FIX: Added heat to props to calculate correct costs.
  heat: number;
  tier: number;
}

export const LieutenantsView: React.FC<LieutenantsViewProps> = ({ lieutenants, onPursue, playerCash, heat, tier }) => {
  // FIX: Calculated the pursuit cost including the heat modifier for accurate UI display.
  const pursuitCost = Math.round(GAME_MECHANICS.LIEUTENANT_PURSUE_COST * tier * getHeatCostModifier(heat));

  return (
    <div>
      <h2 className="font-title text-2xl text-yellow-300 mb-4 border-b-2 border-yellow-700/50 pb-2">Lieutenants</h2>
      <p className="text-gray-400 mb-6">These are the legends of the underworld. Pursuing them requires a significant investment to gather intel and set up a high-stakes recruitment operation.</p>
      
      {lieutenants.length === 0 && (
        <div className="text-center py-10 text-gray-500">
          <p>No legendary figures on your radar.</p>
          <p className="mt-2 text-sm">All available lieutenants have been recruited or the streets are quiet.</p>
        </div>
      )}

      <div className="space-y-4">
        {lieutenants.map((lt) => (
          <div key={lt.id} className="bg-gray-900/70 border border-purple-800/50 rounded-lg p-4 shadow-lg hover:border-purple-600 transition-colors duration-300">
            <h3 className="font-bold text-lg text-purple-200">{lt.name}, The {lt.role}</h3>
            <p className="text-sm text-gray-300 mt-1 mb-3">{lt.discoveryHook}</p>
            <div className="border-t border-gray-700 pt-3">
                <p className="text-sm text-gray-400 mb-2 font-semibold">Unique Abilities:</p>
                <div className="bg-black/20 p-3 rounded-md mb-4 space-y-2">
                    {lt.uniqueAbilities.map(ability => (
                        <div key={ability.id} className="flex items-center space-x-2">
                           <StarIcon className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                           <div>
                             <p className="font-semibold text-cyan-300">{ability.name}</p>
                             <p className="text-xs text-gray-400 italic">"{ability.effectHint}"</p>
                           </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex flex-wrap gap-4 items-center text-sm">
              <div className="flex items-center space-x-1" title="Personality">
                <span className="text-gray-400 font-semibold">Personality:</span> 
                <span className="font-mono">{lt.personality}</span>
              </div>
              <div className="ml-auto">
                 <Button 
                    onClick={() => onPursue(lt)}
                    disabled={playerCash < pursuitCost}
                    size="sm"
                >
                    <div className="flex items-center justify-center space-x-2">
                        <span>Pursue Lead</span>
                        <DollarSignIcon className="w-4 h-4" />
                        <span>{pursuitCost.toLocaleString()}</span>
                    </div>
                 </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
