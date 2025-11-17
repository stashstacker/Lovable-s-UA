
import React from 'react';
import { DollarSignIcon, FlameIcon, ClockIcon, ArrowUpIcon, ArrowDownIcon, AwardIcon, JusticeIcon, BellIcon, SaveIcon } from './icons';
import { TIER_NAMES, TIER_THRESHOLDS } from '../constants';

interface HeaderProps {
  cash: number;
  heat: number;
  worldTime: Date;
  cashFlow: number;
  heatTrend: number;
  tier: number;
  totalEarnings: number;
  investigationProgress: number;
  onToggleEventLog: () => void;
  onSaveGame: () => void;
}

const TrendIndicator: React.FC<{ value: number; positiveIsGood: boolean; unit: string; precision?: number }> = ({ value, positiveIsGood, unit, precision = 0 }) => {
  if (Math.abs(value) < 0.01) return null;

  const isPositive = value > 0;
  const isGood = (isPositive && positiveIsGood) || (!isPositive && !positiveIsGood);

  const color = isGood ? 'text-green-400' : 'text-red-400';
  const icon = isPositive ? <ArrowUpIcon className={`w-4 h-4 ${color}`} /> : <ArrowDownIcon className={`w-4 h-4 ${color}`} />;
  const prefix = isPositive ? '+' : '';

  return (
    <div className="flex items-center text-xs font-mono pl-2 border-l border-gray-600 ml-2" title={`${prefix}${value.toFixed(2)} per hour`}>
      {icon}
      <span className={color}>
        {prefix}{value.toFixed(precision)}{unit}
      </span>
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({ cash, heat, worldTime, cashFlow, heatTrend, tier, totalEarnings, investigationProgress, onToggleEventLog, onSaveGame }) => {
  const heatColor = heat > 75 ? 'text-red-500' : heat > 50 ? 'text-orange-400' : 'text-yellow-400';

  const formattedDate = worldTime.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).toUpperCase();

  const formattedTime = worldTime.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const currentTierName = TIER_NAMES[tier - 1] || 'Unknown';
  const currentTierThreshold = TIER_THRESHOLDS[tier - 1] ?? 0;
  const nextTierThreshold = TIER_THRESHOLDS[tier] ?? Infinity;
  
  const tierProgress = nextTierThreshold === Infinity 
    ? 100 
    : Math.max(0, Math.min(100, ((totalEarnings - currentTierThreshold) / (nextTierThreshold - currentTierThreshold)) * 100));

  return (
    <header className="bg-black/50 backdrop-blur-md p-4 text-white shadow-lg border-b-2 border-yellow-800/50">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-4">
            <h1 className="font-title text-2xl md:text-4xl text-yellow-200 tracking-wider">
            Underworld Ascendant
            </h1>
            <div className="hidden lg:flex items-center space-x-2 bg-gray-900/50 px-3 py-1 rounded-md border border-gray-700 text-yellow-300">
                <ClockIcon className="w-5 h-5" />
                <span className="font-mono text-sm">{formattedDate} - {formattedTime}</span>
            </div>
        </div>
        <div className="flex items-center space-x-2 md:space-x-4 text-sm md:text-lg">
          <button onClick={onSaveGame} className="p-2 rounded-md bg-gray-900/50 border border-gray-700 hover:bg-gray-800 transition-colors" title="Save Game">
            <SaveIcon className="w-5 h-5 text-yellow-300"/>
          </button>
          <button onClick={onToggleEventLog} className="p-2 rounded-md bg-gray-900/50 border border-gray-700 hover:bg-gray-800 transition-colors" title="View Event Chronicle">
            <BellIcon className="w-5 h-5 text-yellow-300"/>
          </button>
          <div className="flex flex-col items-start bg-gray-900/50 px-2 py-1 rounded-md border border-gray-700" title={`Empire Tier (based on Total Earnings: $${totalEarnings.toLocaleString()})`}>
              <div className="flex items-center space-x-1.5">
                  <AwardIcon className="text-cyan-400 w-4 h-4" />
                  <span className="font-bold text-cyan-300 text-xs md:text-base">Empire: {currentTierName}</span>
              </div>
              {nextTierThreshold !== Infinity && (
                  <div className="w-full bg-gray-600 rounded-full h-1 mt-1">
                      <div className="bg-cyan-400 h-1 rounded-full" style={{ width: `${tierProgress}%` }}></div>
                  </div>
              )}
          </div>
          {investigationProgress > 0 && (
             <div className="hidden md:flex flex-col items-start bg-gray-900/50 px-2 py-1 rounded-md border border-gray-700" title={`Police Investigation Progress. At 100%, a RICO raid may occur.`}>
                <div className="flex items-center space-x-1.5">
                    <JusticeIcon className="text-red-400 w-4 h-4" />
                    <span className="font-bold text-red-300 text-xs md:text-base">Investigation</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1 mt-1">
                    <div className="bg-red-500 h-1 rounded-full" style={{ width: `${investigationProgress}%` }}></div>
                </div>
            </div>
          )}
          <div className="flex items-center space-x-2 bg-gray-900/50 px-3 py-1 rounded-md border border-gray-700">
            <DollarSignIcon className="text-green-400" />
            <span className="font-bold text-green-300">${cash.toLocaleString()}</span>
            <TrendIndicator value={cashFlow} positiveIsGood={true} unit="/hr" />
          </div>
          <div className="flex items-center space-x-2 bg-gray-900/50 px-3 py-1 rounded-md border border-gray-700">
            <FlameIcon className={heatColor} />
            <span className={`font-bold ${heatColor}`}>{heat}</span>
            <TrendIndicator value={heatTrend} positiveIsGood={false} unit="/hr" precision={1} />
          </div>
        </div>
      </div>
    </header>
  );
};
