import React, { useState, useMemo } from 'react';
import { HqUpgrade, GangMember, Mastermind } from '../types';
import { Button } from './Button';
// FIX: Added ZapIcon to the import list.
import { DollarSignIcon, UserCheckIcon, WrenchIcon, CrownIcon, ZapIcon } from './icons';
import { GAME_MECHANICS } from '../constants';

interface HqViewProps {
  upgrades: HqUpgrade[];
  gangMembers: GangMember[];
  onPurchase: (upgrade: HqUpgrade) => void;
  onSetAssignment: (memberId: number, assignment: GangMember['assignment'] | null) => void;
  playerCash: number;
  onBribe: () => void;
  lastBribeTimestamp?: Date;
  worldTime: Date;
  hqMoonshine: number;
  mastermind: Mastermind;
  onActivateHqAction: (actionId: string, upgradeId: number) => void;
  hqActionCooldowns: Record<string, Date>;
  tier: number;
}

const UpgradeLine: React.FC<{
    lineName: string;
    upgrades: HqUpgrade[];
    ownedUpgradeIds: Set<number>;
    playerCash: number;
    mastermind: Mastermind;
    onPurchase: (upgrade: HqUpgrade) => void;
}> = ({ lineName, upgrades, ownedUpgradeIds, playerCash, mastermind, onPurchase }) => {
    const ownedInLine = upgrades.filter(u => ownedUpgradeIds.has(u.id));
    const highestOwnedLevel = Math.max(0, ...ownedInLine.map(u => u.level || 0));

    const nextUpgrades = upgrades.filter(u => 
        (u.level === highestOwnedLevel + 1) &&
        (!u.prerequisiteUpgradeId || ownedUpgradeIds.has(u.prerequisiteUpgradeId)) &&
        (!u.exclusiveWithId || !ownedUpgradeIds.has(u.exclusiveWithId))
    );
    
    return (
        <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg">
            <h3 className="font-bold text-lg text-yellow-100 capitalize">{lineName}</h3>
            <div className="mt-2 space-y-3">
                {ownedInLine.map(u => (
                    <div key={u.id} className="bg-green-900/20 p-3 rounded-md border border-green-800/50">
                        <p className="font-semibold text-green-300">✓ {u.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{u.effect}</p>
                    </div>
                ))}
                {nextUpgrades.length > 0 && (
                    <div className={nextUpgrades.length > 1 ? "border-t border-yellow-700/50 pt-3" : ""}>
                        {nextUpgrades.length > 1 && <h4 className="font-semibold text-yellow-200 text-center mb-2">Choose Specialization</h4>}
                        <div className={`grid ${nextUpgrades.length > 1 ? 'grid-cols-2 gap-3' : ''}`}>
                            {nextUpgrades.map(u => {
                                const { requiredAttribute } = u;
                                const meetsAttributeReq = !requiredAttribute || mastermind.attributes[requiredAttribute.attribute] >= requiredAttribute.value;
                                const canAfford = playerCash >= u.cost;
                                const isDisabled = !meetsAttributeReq || !canAfford;

                                let tooltip = '';
                                if (!canAfford) tooltip = 'Not enough cash. ';
                                if (!meetsAttributeReq && requiredAttribute) tooltip += `Requires ${requiredAttribute.value} ${requiredAttribute.attribute}.`;

                                return (
                                    <div key={u.id} className="bg-gray-800/50 p-3 rounded-md border border-gray-600 flex flex-col justify-between">
                                        <div>
                                            <p className="font-semibold text-yellow-100">{u.name}</p>
                                            <p className="text-xs text-gray-400 mt-1">{u.description}</p>
                                            <p className="text-xs text-cyan-400 mt-2 font-semibold">{u.effect}</p>
                                        </div>
                                        <Button size="sm" onClick={() => onPurchase(u)} disabled={isDisabled} title={tooltip} className="mt-3 w-full">
                                            Purchase: ${u.cost.toLocaleString()}
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


export const HqView: React.FC<HqViewProps> = ({ upgrades, gangMembers, onPurchase, onSetAssignment, playerCash, onBribe, lastBribeTimestamp, worldTime, hqMoonshine, mastermind, onActivateHqAction, hqActionCooldowns, tier }) => {
  const [assigningToUpgradeId, setAssigningToUpgradeId] = useState<number | null>(null);

  const ownedUpgradeIds = useMemo(() => new Set(upgrades.filter(u => u.owned).map(u => u.id)), [upgrades]);
  const ownedUpgrades = useMemo(() => upgrades.filter(u => u.owned), [upgrades]);

  const getAssignedMember = (upgradeId: number) => {
      return gangMembers.find(m => m.assignment?.type === 'hq' && m.assignment.upgradeId === upgradeId);
  }

  const bribeCost = GAME_MECHANICS.BRIBE_COST * tier;
  const bribeCooldownMs = GAME_MECHANICS.BRIBE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const timeSinceLastBribe = lastBribeTimestamp ? worldTime.getTime() - new Date(lastBribeTimestamp).getTime() : Infinity;
  const isBribeOnCooldown = timeSinceLastBribe < bribeCooldownMs;
  const remainingCooldownHours = isBribeOnCooldown ? Math.ceil((bribeCooldownMs - timeSinceLastBribe) / (1000 * 60 * 60)) : 0;
  const remainingCooldownDays = Math.ceil(remainingCooldownHours / 24);

  const getBonusText = (upgrade: HqUpgrade, member: GangMember | undefined) => {
    if (!upgrade.assignmentSlot?.bonusCalculation || !member) {
        return upgrade.assignmentSlot?.bonusEffect || '';
    }
    const calc = upgrade.assignmentSlot.bonusCalculation;
    const skillValue = member.skills[calc.skill] || 0;
    const bonus = calc.base + (skillValue * calc.multiplier);

    if (calc.type === 'INCOME') {
        return `Generating +$${bonus.toLocaleString()}/day (from ${calc.skill}: ${skillValue})`;
    }
    if (calc.type === 'PRODUCTION') {
        return `Producing +${bonus.toFixed(1)} units/hr (from ${calc.skill}: ${skillValue})`;
    }
    return '';
  };
  
  const upgradeLines = useMemo(() => {
    const lines: Record<string, HqUpgrade[]> = {};
    const singleUpgrades: HqUpgrade[] = [];
    upgrades.forEach(u => {
      if (u.upgradeLineId) {
        if (!lines[u.upgradeLineId]) lines[u.upgradeLineId] = [];
        lines[u.upgradeLineId].push(u);
      } else {
        singleUpgrades.push(u);
      }
    });
    Object.values(lines).forEach(line => line.sort((a, b) => (a.level || 0) - (b.level || 0)));
    return { lines, singleUpgrades };
  }, [upgrades]);


  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-2 border-b-2 border-yellow-700/50">
            <h2 className="font-title text-2xl text-yellow-300">Headquarters</h2>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Upgrades Column */}
            <div className="lg:col-span-2 space-y-6">
                 {Object.entries(upgradeLines.lines).map(([lineId, lineUpgrades]) => (
                    <UpgradeLine 
                        key={lineId}
                        lineName={lineId}
                        upgrades={lineUpgrades}
                        ownedUpgradeIds={ownedUpgradeIds}
                        playerCash={playerCash}
                        mastermind={mastermind}
                        onPurchase={onPurchase}
                    />
                ))}
            </div>

            {/* Side Column for Assignments, Actions, etc. */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg">
                    <h3 className="font-bold text-lg text-yellow-100 flex items-center space-x-2"><WrenchIcon /><span>HQ Production & Inventory</span></h3>
                    <div className="mt-2 text-sm">
                        <div className="flex justify-between items-center py-1"><span className="text-gray-300">Moonshine Stockpile:</span><span className="font-mono font-semibold text-cyan-300">{Math.floor(hqMoonshine)} units</span></div>
                    </div>
                </div>

                <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg">
                    <h3 className="font-bold text-lg text-yellow-100 flex items-center space-x-2"><UserCheckIcon /><span>Specialist Assignments</span></h3>
                    <div className="mt-2 space-y-3">
                        {ownedUpgrades.filter(u => u.assignmentSlot || u.lieutenantSlot).map(upgrade => {
                            const assignedMember = getAssignedMember(upgrade.id);
                            const availableMembers = gangMembers.filter(m => m.status === 'Idle' && upgrade.assignmentSlot && m.role === upgrade.assignmentSlot.requiredRole);
                            const availableLieutenants = gangMembers.filter(m => m.status === 'Idle' && m.isLieutenant && upgrade.lieutenantSlot && m.archetype === upgrade.lieutenantSlot.requiredArchetype);
                            const canAssign = (availableMembers.length > 0) || (availableLieutenants.length > 0);

                            return (
                                <div key={`assign-${upgrade.id}`} className="bg-black/20 p-3 rounded-md border border-gray-700/50">
                                    <p className="text-sm font-semibold text-gray-300">{upgrade.name}</p>
                                    <p className="text-xs text-cyan-300 italic">{assignedMember ? getBonusText(upgrade, assignedMember) : (upgrade.assignmentSlot?.bonusEffect || upgrade.lieutenantSlot?.slotName)}</p>
                                    <div className="mt-2">
                                        {assignedMember ? (
                                            <div className="flex justify-between items-center"><span className="font-semibold text-blue-300 text-sm">{assignedMember.name}</span><Button size="sm" variant="secondary" onClick={() => onSetAssignment(assignedMember.id, null)}>Unassign</Button></div>
                                        ) : (
                                            <div className="relative">
                                                <Button size="sm" className="w-full" onClick={() => setAssigningToUpgradeId(assigningToUpgradeId === upgrade.id ? null : upgrade.id)} disabled={!canAssign}>
                                                    {canAssign ? 'Assign Specialist' : 'No Specialist Available'}
                                                </Button>
                                                {assigningToUpgradeId === upgrade.id && canAssign && (
                                                    <div className="absolute bottom-full right-0 w-full bg-gray-800 border border-yellow-700 rounded-md shadow-lg z-10 mb-2 max-h-48 overflow-y-auto">
                                                        {availableMembers.map(member => (<button key={member.id} onClick={() => { onSetAssignment(member.id, { type: 'hq', upgradeId: upgrade.id }); setAssigningToUpgradeId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-yellow-700/50">{member.name} ({upgrade.assignmentSlot?.bonusCalculation?.skill}: {member.skills[upgrade.assignmentSlot?.bonusCalculation?.skill || 'cunning']})</button>))}
                                                        {availableLieutenants.map(lt => (<button key={lt.id} onClick={() => { onSetAssignment(lt.id, { type: 'hq', upgradeId: upgrade.id }); setAssigningToUpgradeId(null); }} className="block w-full text-left px-4 py-2 text-sm text-yellow-200 hover:bg-yellow-700/50 flex items-center space-x-2"><CrownIcon className="w-4 h-4" /><span>{lt.name}</span></button>))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg">
                    <h3 className="font-bold text-lg text-yellow-100 flex items-center space-x-2"><ZapIcon /><span>HQ Actions</span></h3>
                    <div className="mt-2 space-y-3">
                        <div className="bg-black/20 p-3 rounded-md border border-gray-700/50">
                            <h4 className="font-semibold text-gray-300">Bribe the Cops</h4>
                            <p className="text-xs text-gray-400 mt-1">Make a generous "donation" to reduce heat and investigation progress.</p>
                            {isBribeOnCooldown ? <p className="text-xs text-orange-400 mt-2">Cooldown: {remainingCooldownDays} day(s) remaining.</p> : <Button onClick={onBribe} disabled={playerCash < bribeCost} className="w-full mt-2" size="sm">Pay Off: ${bribeCost.toLocaleString()}</Button>}
                        </div>
                        {ownedUpgrades.filter(u => u.lieutenantSlot && getAssignedMember(u.id)?.isLieutenant).flatMap(u => u.lieutenantSlot!.unlocks.map(action => {
                            const cooldownEnd = hqActionCooldowns[action.id];
                            const isOnCooldown = cooldownEnd && worldTime < new Date(cooldownEnd);
                            const remainingHours = isOnCooldown ? Math.ceil((new Date(cooldownEnd).getTime() - worldTime.getTime()) / (1000*60*60)) : 0;
                            return (
                                <div key={action.id} className="bg-black/20 p-3 rounded-md border border-gray-700/50">
                                    <h4 className="font-semibold text-cyan-300">{action.name}</h4>
                                    <p className="text-xs text-gray-400 mt-1">{action.description}</p>
                                    {isOnCooldown ? <p className="text-xs text-orange-400 mt-2">Cooldown: {remainingHours} hour(s) remaining.</p> : <Button onClick={() => onActivateHqAction(action.id, u.id)} className="w-full mt-2" size="sm">Activate</Button>}
                                </div>
                            )
                        }))}
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};
