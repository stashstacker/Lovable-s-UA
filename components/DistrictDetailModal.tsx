

import React, { useState, useMemo } from 'react';
import { District, Faction, RivalOperation, Operation, GangMember, Ward, Mastermind } from '../types';
import { Button } from './Button';
import { XIcon, BuildingIcon, SwordsIcon, ShieldCheckIcon, HomeIcon, TruckIcon } from './icons';
import { WAREHOUSE_LEVELS, HIDEOUT_MODULES, SKILL_TREES } from '../constants';

interface DistrictDetailModalProps {
    district: District;
    factions: Faction[];
    rivalOperations: RivalOperation[];
    operations: Operation[];
    worldTime: Date;
    onClose: () => void;
    onInitiateTakeover: (district: District) => void;
    onLaunchAttack: (district: District) => void;
    onLaunchDefense: (district: District) => void;
    onFortify: (district: District) => void;
    playerCash: number;
    gangMembers: GangMember[];
    onBuildHideoutModule: (district: District, moduleId: string) => void;
    onSetAssignment: (memberId: number, assignment: GangMember['assignment'] | null) => void;
    onUpgradeWarehouse: (district: District, amount: number) => void;
    onInitiateTransport: (district: District, amount: number) => void;
    districtMoonshine: number;
    hqMoonshine: number;
    wards: Ward[];
    mapConnections?: [number, number][];
    mastermind: Mastermind;
}

export const DistrictDetailModal: React.FC<DistrictDetailModalProps> = ({ 
    district, factions, rivalOperations, operations, worldTime, onClose, onInitiateTakeover, onLaunchAttack, onLaunchDefense, onFortify, playerCash, gangMembers, onBuildHideoutModule, onSetAssignment, onUpgradeWarehouse, onInitiateTransport, districtMoonshine, hqMoonshine, wards, mapConnections, mastermind
}) => {
    const [isAssigning, setIsAssigning] = useState(false);
    
    const controller = factions.find(f => f.id === district.controlledBy);
    const isPlayerControlled = district.controlledBy === 'player';
    const takeoverCost = district.controlledBy === 'neutral' ? 30000 : 80000;
    
    const activeRivalAttack = rivalOperations.find(op => op.targetDistrictId === district.id && !op.isResolved);
    const attacker = activeRivalAttack ? factions.find(f => f.id === activeRivalAttack.factionId) : null;

    const isTakeoverOpAvailable = operations.some(op => op.isTakeoverOperation && op.targetDistrictId === district.id);

    const isOnCooldown = district.takeoverCooldownUntil && new Date(district.takeoverCooldownUntil) > worldTime;
    const remainingMs = isOnCooldown ? new Date(district.takeoverCooldownUntil!).getTime() - worldTime.getTime() : 0;
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
    const remainingDays = Math.ceil(remainingHours / 24);
    
    const fortificationCost = district.strategicValue * 100;

    const playerDistrictIds = useMemo(() => 
        wards.flatMap(w => w.districts).filter(d => d.controlledBy === 'player').map(d => d.id),
        [wards]
    );

    const isAdjacentToPlayer = useMemo(() => {
        if (isPlayerControlled) return true;
        if (playerDistrictIds.length === 0) return true; // Can take any district if you have no territory
        if (!mapConnections) return false;
        return mapConnections.some(([id1, id2]) => 
            (playerDistrictIds.includes(id1) && id2 === district.id) || 
            (playerDistrictIds.includes(id2) && id1 === district.id)
        );
    }, [mapConnections, playerDistrictIds, district, isPlayerControlled]);

    const totalFortification = district.fortification + (district.temporaryFortification?.amount || 0);
    
    const renderPlayerAssets = () => {
        if (!isPlayerControlled) return null;

        const builtModules = district.hideoutModules.map(id => HIDEOUT_MODULES.find(m => m.id === id)).filter(Boolean);
        const availableModules = HIDEOUT_MODULES.filter(m => !district.hideoutModules.includes(m.id));
        
        const assignedHideoutMembers = gangMembers.filter(m => m.assignment?.type === 'hideout' && m.assignment.districtId === district.id);
        const availableMembers = gangMembers.filter(m => m.status === 'Idle' && !m.assignment);
        
        const hideoutCapacity = builtModules.reduce((acc, mod) => acc + (mod.effect.type === 'PROTECTION' ? mod.effect.value : 0), 0);

        const currentWarehouseLevel = district.warehouse?.level || 0;
        const warehouseInfo = WAREHOUSE_LEVELS[currentWarehouseLevel];
        const nextWarehouseLevelInfo = WAREHOUSE_LEVELS[currentWarehouseLevel + 1];
        const warehouseCapacity = warehouseInfo.effect.capacity;

        const transportAmount = Math.min(50, hqMoonshine);

        return (
            <div className="mt-6 pt-4 border-t border-gray-700">
                <h3 className="font-semibold text-yellow-200 mb-2 flex items-center space-x-2"><HomeIcon /><span>District Assets</span></h3>
                
                {/* Hideout Section */}
                <div className="bg-black/20 p-4 rounded-md mb-3">
                    <p className="font-bold">Hideout</p>
                    {builtModules.length === 0 && <p className="text-xs text-gray-400 mt-1">This district is exposed. Build modules to provide security and new capabilities.</p>}
                    {builtModules.length > 0 && (
                        <div className="mt-2 space-y-1">
                            {builtModules.map(mod => (
                                <div key={mod.id} className="text-xs bg-gray-800/50 p-2 rounded-md" title={mod.description}>
                                    <p className="font-semibold text-green-300">{mod.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                     <div className="mt-3 pt-3 border-t border-gray-700/50">
                        <p className="text-sm font-semibold text-gray-300 mb-2">Available Modules</p>
                        <div className="space-y-2">
                            {availableModules.map(mod => {
                                const allSkills = Object.values(SKILL_TREES).flat();
                                const requiredSkillInfo = mod.requiredSkill ? allSkills.find(s => s.id === mod.requiredSkill) : null;
                                const hasSkill = !mod.requiredSkill || mastermind.unlockedSkills.includes(mod.requiredSkill);
                                const canAfford = playerCash >= mod.cost;
                                const isDisabled = !hasSkill || !canAfford;

                                let tooltip = '';
                                if (!canAfford) tooltip += 'Not enough cash. ';
                                if (!hasSkill && requiredSkillInfo) tooltip += `Requires Mastermind skill: ${requiredSkillInfo.name}.`;

                                return (
                                <div key={mod.id} className="flex items-center justify-between bg-gray-800/50 p-2 rounded-md text-sm" title={tooltip}>
                                    <div>
                                        <p className="font-semibold">{mod.name}</p>
                                        <p className="text-xs text-gray-400">{mod.description}</p>
                                        {requiredSkillInfo && <p className={`text-xs mt-1 ${hasSkill ? 'text-cyan-400' : 'text-red-400'}`}>Requires: {requiredSkillInfo.name}</p>}
                                    </div>
                                    <Button size="sm" onClick={() => onBuildHideoutModule(district, mod.id)} disabled={isDisabled}>Build: ${mod.cost.toLocaleString()}</Button>
                                </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Warehouse Section */}
                <div className="bg-black/20 p-4 rounded-md">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                        <div className="flex-grow">
                            <p className="font-bold">{warehouseInfo.name}</p>
                            <p className="text-xs text-gray-400 mt-1">{warehouseInfo.description}</p>
                        </div>
                        {nextWarehouseLevelInfo && nextWarehouseLevelInfo.upgradeCost > 0 && (
                             <Button onClick={() => onUpgradeWarehouse(district, nextWarehouseLevelInfo.upgradeCost)} disabled={playerCash < nextWarehouseLevelInfo.upgradeCost} size="sm" className="flex-shrink-0">
                                {currentWarehouseLevel === 0 ? 'Build' : 'Upgrade'}: ${nextWarehouseLevelInfo.upgradeCost.toLocaleString()}
                            </Button>
                        )}
                        {currentWarehouseLevel > 0 && !nextWarehouseLevelInfo && (
                            <span className="text-xs font-semibold text-green-400 bg-green-900/50 px-2 py-1 rounded-md">Max Level</span>
                        )}
                    </div>
                    {currentWarehouseLevel > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-700/50">
                            <p className="text-sm font-semibold text-gray-300 mb-2">Inventory ({Math.floor(districtMoonshine)} / {warehouseCapacity})</p>
                             <div className="flex justify-between items-center bg-gray-800/50 p-2 rounded-md text-sm">
                                <span className="font-semibold text-cyan-300">Moonshine</span>
                                <Button size="sm" onClick={() => onInitiateTransport(district, transportAmount)} disabled={transportAmount <= 0}>
                                    <div className="flex items-center space-x-1.5">
                                        <TruckIcon className="w-4 h-4" />
                                        <span>Transport ({transportAmount})</span>
                                    </div>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        );
    };

    const renderActions = () => {
        if (isPlayerControlled) {
            if (activeRivalAttack) {
                return (
                     <div className="bg-black/20 p-4 rounded-md flex justify-between items-center">
                        <div>
                            <p className="font-bold">Repel Attackers</p>
                            <p className="text-xs text-gray-400">A defense operation is available.</p>
                        </div>
                        <Button onClick={() => onLaunchDefense(district)}>
                            Launch Defense
                        </Button>
                    </div>
                )
            }
            return (
                 <div className="bg-black/20 p-4 rounded-md flex justify-between items-center">
                    <div>
                        <p className="font-bold flex items-center space-x-2"><ShieldCheckIcon className="w-4 h-4" /><span>Fortify District</span></p>
                        <p className="text-xs text-gray-400">Increase defenses against takeovers.</p>
                    </div>
                    <Button onClick={() => onFortify(district)} disabled={playerCash < fortificationCost}>
                        Cost: ${fortificationCost.toLocaleString()}
                    </Button>
                </div>
            )
        }

        // Not player controlled
        if (activeRivalAttack) return null; // Can't do anything if a rival is already attacking it

        if (isOnCooldown) {
            return (
                <div className="bg-black/20 p-4 rounded-md text-center">
                    <p className="font-bold text-yellow-200">District is Fortified</p>
                    <p className="text-xs text-gray-400 mt-1">This district was recently contested. Takeovers are unavailable for another {remainingDays} day(s).</p>
                </div>
            )
        }

        if (isTakeoverOpAvailable) {
             return (
                <div className="bg-black/20 p-4 rounded-md flex justify-between items-center">
                    <div>
                        <p className="font-bold">Takeover Planned</p>
                        <p className="text-xs text-gray-400">An operation is ready to be launched.</p>
                    </div>
                    <Button onClick={() => onLaunchAttack(district)}>
                        Launch Attack
                    </Button>
                </div>
            )
        }

        return (
            <div className="bg-black/20 p-4 rounded-md flex justify-between items-center" title={!isAdjacentToPlayer ? 'You can only attack districts adjacent to your territory.' : ''}>
                <div>
                    <p className="font-bold">Initiate Takeover</p>
                    <p className="text-xs text-gray-400">Prepare an operation to seize this district.</p>
                </div>
                <Button onClick={() => onInitiateTakeover(district)} disabled={playerCash < takeoverCost || !isAdjacentToPlayer}>
                    Cost: ${takeoverCost.toLocaleString()}
                </Button>
            </div>
        )
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-900 border-2 border-yellow-800/50 rounded-lg shadow-2xl w-full max-w-lg transform transition-all">
                <header className="flex justify-between items-center p-4 border-b border-yellow-900/60">
                    <h2 className="font-title text-xl text-yellow-300">{district.name}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>

                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    {district.landmark && (
                        <div className="mb-4 bg-cyan-900/30 border border-cyan-700/50 p-3 rounded-lg">
                            <div className="flex items-center space-x-3">
                                <BuildingIcon className="w-8 h-8 text-cyan-300 flex-shrink-0"/>
                                <div>
                                    <h3 className="font-bold text-cyan-200">{district.landmark.name}</h3>
                                    <p className="text-sm text-cyan-300/90 italic">{district.landmark.description}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-400">District Type</p>
                            <p className="font-semibold">{district.type}</p>
                        </div>
                         <div>
                            <p className="text-gray-400">Strategic Value</p>
                            <p className="font-semibold">{district.strategicValue}</p>
                        </div>
                         <div>
                            <p className="text-gray-400">Base Income</p>
                            <p className="font-semibold text-green-400">${district.baseIncome.toLocaleString()} / day</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Controlled By</p>
                            <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${controller?.color || 'bg-gray-700'}`}></div>
                                <span className="font-semibold">{controller?.name || 'Unknown'}</span>
                            </div>
                        </div>
                         <div>
                            <p className="text-gray-400">Fortification</p>
                            <p className="font-semibold text-blue-300">
                                {Math.round(totalFortification)} / 100
                                {district.temporaryFortification && ` (+${district.temporaryFortification.amount})`}
                            </p>
                        </div>
                         <div>
                            <p className="text-gray-400">Local Heat</p>
                            <p className="font-semibold text-orange-400">{Math.round(district.heat)} / 100</p>
                        </div>
                    </div>
                    
                    {renderPlayerAssets()}

                    {activeRivalAttack && (
                        <div className="mt-6 pt-4 border-t border-red-700/50">
                             <h3 className="font-semibold text-red-300 mb-2 flex items-center space-x-2"><SwordsIcon /><span>Under Attack!</span></h3>
                             <div className="bg-black/20 p-4 rounded-md">
                                <p className="text-sm">The <span className="font-bold text-red-400">{attacker?.name}</span> are making a move on this district.</p>
                             </div>
                        </div>
                    )}
                    
                    <div className="mt-6 pt-4 border-t border-gray-700">
                        <h3 className="font-semibold text-yellow-200 mb-2">Actions</h3>
                        {renderActions()}
                    </div>
                </div>
                 <footer className="p-4 bg-black/20 text-right border-t border-yellow-900/60">
                    <Button variant="secondary" onClick={onClose}>Close</Button>
                </footer>
            </div>
        </div>
    );
};
