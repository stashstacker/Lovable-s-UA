

import React, { useState, useMemo } from 'react';
import { Operation, ActiveOperation, GangMember, RivalOperation } from '../types';
import { Button } from './Button';
import { DollarSignIcon, FlameIcon, ShieldIcon, ZapIcon, WrenchIcon, TruckIcon, UsersIcon, AlertOctagonIcon, MapPinIcon, LightbulbIcon, CrownIcon, StarIcon } from './icons';
import { GAME_MECHANICS, getHeatCostModifier } from '../constants';

interface OperationsViewProps {
  operations: Operation[];
  activeOperations: ActiveOperation[];
  gangMembers: GangMember[];
  rivalOperations: RivalOperation[];
  worldTime: Date;
  onStartIntelGathering: () => void;
  isLoading: boolean;
  error: string | null;
  onStartAssign: (operation: Operation) => void;
  tier: number;
  heat: number;
}

const SkillIcon: React.FC<{ skill: string }> = ({ skill }) => {
  const s = skill.toLowerCase();
  const props = { className: "w-5 h-5", title: skill.charAt(0).toUpperCase() + skill.slice(1) };
  if (s.includes('combat')) return <ShieldIcon {...props} />;
  if (s.includes('cunning')) return <ZapIcon {...props} />;
  if (s.includes('influence')) return <DollarSignIcon {...props} />;
  if (s.includes('logistics')) return <TruckIcon {...props} />;
  if (s.includes('production')) return <WrenchIcon {...props} />;
  return null;
}

const formatDuration = (ms: number) => {
    if (ms <= 0) return "Completed";
    const totalHours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h`;
    return result.trim() || "< 1h";
}

export const OperationsView: React.FC<OperationsViewProps> = ({ operations, activeOperations, gangMembers, rivalOperations, worldTime, onStartIntelGathering, isLoading, error, onStartAssign, tier, heat }) => {
  const [activeTab, setActiveTab] = useState<'available' | 'active'>('available');

  const getMemberName = (id: number) => gangMembers.find(m => m.id === id)?.name || 'Unknown';
  
  const intelOpInProgress = useMemo(() => activeOperations.some(op => op.type === 'INTEL'), [activeOperations]);
  
  const intelCost = Math.round(GAME_MECHANICS.GATHER_INTEL_COST * tier * getHeatCostModifier(heat));

  const sortedOperations = useMemo(() => {
    const rivalOpStates = new Map(rivalOperations.map(op => [op.id, op.isResolved]));
    const filteredOps = operations.filter(op => {
        if (!op.isCounterOperation || !op.rivalOperationId) return true;
        return !rivalOpStates.get(op.rivalOperationId);
    });

    return [...filteredOps].sort((a, b) => {
      if (a.isNarrativeOperation && !b.isNarrativeOperation) return -1;
      if (!a.isNarrativeOperation && b.isNarrativeOperation) return 1;
      if (a.isMastermindOperation && !b.isMastermindOperation) return -1;
      if (!a.isMastermindOperation && b.isMastermindOperation) return 1;
      if (a.isCounterOperation && !b.isCounterOperation) return -1;
      if (!a.isCounterOperation && b.isCounterOperation) return 1;
      if (a.isTakeoverOperation && !b.isTakeoverOperation) return -1;
      if (!a.isTakeoverOperation && b.isTakeoverOperation) return 1;
      return 0;
    });
  }, [operations, rivalOperations]);

  const activeOpsToDisplay = activeOperations.filter(op => op.type === 'REGULAR' || op.type === 'TRANSPORT' || op.type === 'INTEL');

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-2 border-b-2 border-yellow-700/50">
        <h2 className="font-title text-2xl text-yellow-300">Operations</h2>
        <div className="flex items-center space-x-2 bg-black/20 p-1 rounded-md mt-2 sm:mt-0">
          <button onClick={() => setActiveTab('available')} className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'available' ? 'bg-yellow-600 text-black' : 'bg-gray-700 hover:bg-gray-600 text-yellow-200'}`}>
            Available ({sortedOperations.length})
          </button>
          <button onClick={() => setActiveTab('active')} className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'active' ? 'bg-yellow-600 text-black' : 'bg-gray-700 hover:bg-gray-600 text-yellow-200'}`}>
            Active ({activeOpsToDisplay.length})
          </button>
        </div>
      </div>

      {activeTab === 'available' && (
        <div>
            <div className="flex justify-end mb-4">
                 <Button onClick={onStartIntelGathering} disabled={isLoading || intelOpInProgress} title={intelOpInProgress ? "An operative is already gathering intel." : ""}>
                    <div className="flex items-center space-x-2">
                        <LightbulbIcon className="w-5 h-5"/>
                        <span>{isLoading ? 'Generating...' : 'Gather Intel'}</span>
                        <DollarSignIcon className="w-4 h-4" />
                        <span>{intelCost.toLocaleString()}</span>
                    </div>
                </Button>
            </div>
            {error && <p className="text-center text-red-400 bg-red-900/50 p-3 rounded-lg mb-4">{error}</p>}
            {sortedOperations.length === 0 && !isLoading && (
                <div className="text-center py-10 text-gray-400">
                <p>No operations on the wire.</p>
                <p className="mt-2 text-sm">Click "Gather Intel" to send an operative to find new leads.</p>
                </div>
            )}
            <div className="space-y-4">
                {sortedOperations.map((op) => {
                  const isCounterOp = op.isCounterOperation;
                  const isTakeoverOp = op.isTakeoverOperation;
                  const isNarrativeOp = op.isNarrativeOperation;
                  const isMastermindOp = op.isMastermindOperation;

                  const borderClass = isNarrativeOp
                    ? 'border-purple-600 hover:border-purple-400'
                    : isMastermindOp
                    ? 'border-cyan-600 hover:border-cyan-400'
                    : isCounterOp 
                    ? 'border-red-600 hover:border-red-400' 
                    : isTakeoverOp
                    ? 'border-yellow-700 hover:border-yellow-500'
                    : 'border-gray-700 hover:border-yellow-600';

                  return (
                    <div key={op.id} className={`bg-gray-900/70 border rounded-lg p-4 shadow-lg transition-colors duration-300 ${borderClass}`}>
                        {isNarrativeOp && (
                            <div className="flex items-center space-x-2 text-purple-300 mb-2 pb-2 border-b border-purple-800/50" title="Narrative Operations are critical story missions that advance the plot.">
                                <StarIcon className="w-5 h-5" />
                                <span className="font-semibold text-sm">NARRATIVE OPERATION</span>
                            </div>
                        )}
                        {isMastermindOp && (
                            <div className="flex items-center space-x-2 text-cyan-300 mb-2 pb-2 border-b border-cyan-800/50" title="Mastermind Operations are special missions exclusive to your chosen class.">
                                <CrownIcon className="w-5 h-5" />
                                <span className="font-semibold text-sm">MASTERMIND OPERATION</span>
                            </div>
                        )}
                        {isCounterOp && (
                            <div className="flex items-center space-x-2 text-red-300 mb-2 pb-2 border-b border-red-800/50">
                                <AlertOctagonIcon className="w-5 h-5 animate-pulse" />
                                <span className="font-semibold text-sm">URGENT: DEFENSE REQUIRED</span>
                            </div>
                        )}
                        {isTakeoverOp && (
                             <div className="flex items-center space-x-2 text-yellow-300 mb-2 pb-2 border-b border-yellow-800/50">
                                <MapPinIcon className="w-5 h-5" />
                                <span className="font-semibold text-sm">DISTRICT TAKEOVER</span>
                            </div>
                        )}
                        <h3 className="font-bold text-lg text-yellow-100">{op.title}</h3>
                        <p className="text-sm text-gray-300 mt-1 mb-3">{op.description}</p>
                        {op.prerequisiteDescription && <p className="text-xs italic text-purple-300/80 mb-3">Prerequisite: {op.prerequisiteDescription}</p>}

                        <div className="flex flex-wrap gap-4 items-center text-sm border-t border-gray-700 pt-3">
                        <div className="flex items-center space-x-1" title="Difficulty">
                            <span className="text-gray-400 font-semibold">Difficulty:</span> 
                            <span className="font-mono">{op.difficulty}/10</span>
                        </div>
                        <div className="flex items-center space-x-1" title="Required Skills">
                            <span className="text-gray-400 font-semibold">Skills:</span>
                            <div className="flex space-x-2 text-yellow-400">
                            {op.requiredSkills.map(s => <SkillIcon key={s} skill={s}/>)}
                            </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-auto" title="Reward">
                            <DollarSignIcon className="text-green-400" />
                            <span className="text-green-300">{isCounterOp ? 'Valuable Spoils' : isTakeoverOp ? 'Territory' : (op.reward || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1" title="Heat Generated">
                            <FlameIcon className="text-orange-400" />
                            <span className="text-orange-300">+{op.heat}</span>
                        </div>
                        <Button size="sm" onClick={() => onStartAssign(op)}>Assign Crew</Button>
                        </div>
                    </div>
                  )
                })}
            </div>
        </div>
      )}

      {activeTab === 'active' && (
        <div className="space-y-4">
            {activeOpsToDisplay.length === 0 && (
                 <div className="text-center py-10 text-gray-400">
                    <p>No active operations.</p>
                    <p className="mt-2 text-sm">Your crew is waiting for orders.</p>
                </div>
            )}
            {activeOpsToDisplay.map((op) => {
                if(op.type === 'SCOUTING') return null; // Should not happen due to filter but for type safety
                
                const isIntel = op.type === 'INTEL';
                if (isIntel) {
                    const timeRemaining = op.completionTime.getTime() - worldTime.getTime();
                    const memberName = getMemberName(op.assignedMemberId);
                    return (
                        <div key={op.id} className="bg-gray-900/70 border rounded-lg p-4 shadow-lg border-yellow-700">
                            <div className="flex items-center space-x-2 text-yellow-300 mb-2 pb-2 border-b border-yellow-800/50">
                                <LightbulbIcon className="w-5 h-5 animate-pulse" />
                                <span className="font-semibold text-sm">GATHERING INTEL</span>
                            </div>
                            <h3 className="font-bold text-lg text-yellow-100">Shaking the Grapevine</h3>
                            <div className="my-3 space-y-2">
                               <div className="flex items-center space-x-2 text-sm text-gray-300" title="Assigned Operative">
                                   <UsersIcon className="w-4 h-4 text-yellow-400" />
                                   <span>{memberName}</span>
                               </div>
                               <div>
                                    <p className="text-xs text-gray-400 mb-1">Time Remaining: {formatDuration(timeRemaining)}</p>
                                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                                        <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: `100%` }}></div>
                                    </div>
                               </div>
                            </div>
                        </div>
                    );
                }

                const timeRemaining = op.completionTime.getTime() - worldTime.getTime();
                const totalDuration = op.completionTime.getTime() - op.startTime.getTime();
                const progress = Math.max(0, 100 - (timeRemaining / totalDuration) * 100);
                
                const isTransport = op.type === 'TRANSPORT';
                const regularOp = op.type === 'REGULAR' ? op : null;

                const title = isTransport ? `Transporting to District...` : regularOp?.title;

                return (
                    <div key={op.id} className={`bg-gray-900/70 border rounded-lg p-4 shadow-lg ${regularOp?.isMastermindOperation ? 'border-cyan-700' : regularOp?.isCounterOperation ? 'border-red-700' : regularOp?.isTakeoverOperation ? 'border-purple-700' : isTransport ? 'border-blue-700' : 'border-gray-700'}`}>
                        {regularOp?.isMastermindOperation && (
                            <div className="flex items-center space-x-2 text-cyan-300 mb-2 pb-2 border-b border-cyan-800/50">
                                <CrownIcon className="w-5 h-5" />
                                <span className="font-semibold text-sm">MASTERMIND OPERATION</span>
                            </div>
                        )}
                        {regularOp?.isCounterOperation && (
                            <div className="flex items-center space-x-2 text-red-300 mb-2 pb-2 border-b border-red-800/50">
                                <AlertOctagonIcon className="w-5 h-5" />
                                <span className="font-semibold text-sm">DEFENDING</span>
                            </div>
                        )}
                         {regularOp?.isTakeoverOperation && (
                             <div className="flex items-center space-x-2 text-purple-300 mb-2 pb-2 border-b border-purple-800/50">
                                <MapPinIcon className="w-5 h-5" />
                                <span className="font-semibold text-sm">ASSAULT IN PROGRESS</span>
                            </div>
                        )}
                        {isTransport && (
                            <div className="flex items-center space-x-2 text-blue-300 mb-2 pb-2 border-b border-blue-800/50">
                               <TruckIcon className="w-5 h-5" />
                               <span className="font-semibold text-sm">LOGISTICS RUN: {op.amount} Units Moonshine</span>
                           </div>
                        )}
                        <h3 className="font-bold text-lg text-yellow-100">{title}</h3>
                        <div className="my-3 space-y-2">
                           <div className="flex items-center space-x-2 text-sm text-gray-300" title="Assigned Crew">
                               <UsersIcon className="w-4 h-4 text-yellow-400" />
                               <span>{op.assignedMemberIds.map(getMemberName).join(', ')}</span>
                           </div>
                           <div>
                                <p className="text-xs text-gray-400 mb-1">Time Remaining: {formatDuration(timeRemaining)}</p>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-yellow-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                </div>
                           </div>
                        </div>
                        {!isTransport && regularOp && !regularOp.isMastermindOperation && (
                            <div className="flex flex-wrap gap-4 items-center text-sm border-t border-gray-700 pt-3">
                                <div className="flex items-center space-x-1 ml-auto" title="Reward">
                                    <DollarSignIcon className="text-green-400" />
                                    <span className="text-green-300">{regularOp.isCounterOperation ? 'Valuable Spoils' : regularOp.isTakeoverOperation ? 'Territory' : regularOp.reward.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center space-x-1" title="Heat Generated">
                                    <FlameIcon className="text-orange-400" />
                                    <span className="text-orange-300">+{regularOp.heat}</span>
                                </div>
                            </div>
                        )}
                         {regularOp?.isMastermindOperation && (
                            <div className="text-sm border-t border-gray-700 pt-3 text-center text-cyan-300/80 italic">
                                Awaiting your direct intervention...
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
      )}
    </div>
  );
};
