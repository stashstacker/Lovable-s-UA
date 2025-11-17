

import React, { useState, useMemo } from 'react';
import { Operation, GangMember } from '../types';
import { Button } from './Button';
import { XIcon, ShieldIcon, ZapIcon, DollarSignIcon, TruckIcon, WrenchIcon, ClockIcon } from './icons';

interface AssignCrewModalProps {
  operation: Operation;
  gangMembers: GangMember[];
  onConfirm: (operationId: string, memberIds: number[], finalReward: number, rewardModifier: number) => void;
  onCancel: () => void;
}

// Helper to get a skill value from a member by skill name
const getSkillValue = (member: GangMember, skillName: string): number => {
    const skillKey = skillName.toLowerCase() as keyof GangMember['skills'];
    return member.skills[skillKey] || 0;
}

// Helper to render skill icons
const SkillIcon: React.FC<{ skill: string, className?: string }> = ({ skill, className }) => {
    const s = skill.toLowerCase();
    const props = { className: className || "w-5 h-5", title: skill };
    if (s.includes('combat')) return <ShieldIcon {...props} />;
    if (s.includes('cunning')) return <ZapIcon {...props} />;
    if (s.includes('influence')) return <DollarSignIcon {...props} />;
    if (s.includes('logistics')) return <TruckIcon {...props} />;
    if (s.includes('production')) return <WrenchIcon {...props} />;
    return null;
}

export const AssignCrewModal: React.FC<AssignCrewModalProps> = ({ operation, gangMembers, onConfirm, onCancel }) => {
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());

    const sortedAvailableMembers = useMemo(() => {
        const idleMembers = gangMembers.filter(m => m.status === 'Idle');
        
        const calculateScore = (member: GangMember) => {
            return operation.requiredSkills.reduce((score, skill) => {
                return score + getSkillValue(member, skill);
            }, 0);
        };

        return idleMembers.sort((a, b) => calculateScore(b) - calculateScore(a));
    }, [gangMembers, operation.requiredSkills]);

    const handleSelectMember = (memberId: number) => {
        setSelectedMemberIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(memberId)) {
                newSet.delete(memberId);
            } else {
                newSet.add(memberId);
            }
            return newSet;
        });
    };

    const successChance = useMemo(() => {
        if (selectedMemberIds.size === 0) return 0;

        const selectedMembers = sortedAvailableMembers.filter(m => selectedMemberIds.has(m.id));
        
        // Calculate the crew's total skill points relevant to the operation.
        const totalSkillPoints = operation.requiredSkills.reduce((total, requiredSkill) => {
            const skillTotalForOp = selectedMembers.reduce((sum, member) => sum + getSkillValue(member, requiredSkill), 0);
            return total + skillTotalForOp;
        }, 0);
        
        // The target skill level needed for a baseline 50% chance.
        const difficultyTarget = operation.difficulty * 5;
        
        // Success starts at a base of 50% and is modified by how much the crew's skills
        // exceed or fall short of the difficulty target.
        let chance = 50 + (totalSkillPoints - difficultyTarget) * 2;
        
        // Clamp the chance to prevent extreme values.
        return Math.max(5, Math.min(95, Math.round(chance)));

    }, [selectedMemberIds, sortedAvailableMembers, operation]);

    const rewardModifier = useMemo(() => {
        if (selectedMemberIds.size === 0) return 1.0;
        // The rewardModifier is derived from the success chance. A 50% chance is a baseline 1.0 modifier.
        // Higher success chance leads to better rewards and faster completion times.
        // A 95% chance gives a 1.45x modifier, while a 5% chance gives a 0.55x modifier.
        return 1 + (successChance - 50) / 100;
    }, [successChance, selectedMemberIds]);

    const modifiedReward = useMemo(() => {
        if (operation.reward === 0) return 0;
        if (selectedMemberIds.size === 0) return operation.reward;
        return Math.round(operation.reward * rewardModifier);
    }, [operation.reward, rewardModifier, selectedMemberIds]);

    const baseDurationHours = operation.difficulty * 3;
    const modifiedDurationHours = useMemo(() => {
        if (selectedMemberIds.size === 0) return baseDurationHours;
        // A more skilled crew (higher rewardModifier) completes the mission faster.
        // The modifier acts as a performance multiplier.
        return baseDurationHours / rewardModifier;
    }, [baseDurationHours, rewardModifier, selectedMemberIds]);

    const handleConfirm = () => {
        onConfirm(operation.id, Array.from(selectedMemberIds), modifiedReward, rewardModifier);
    };
    
    const probabilityColor = successChance > 75 ? 'text-green-400' : successChance > 40 ? 'text-yellow-400' : 'text-red-400';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-900 border-2 border-yellow-800/50 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b border-yellow-900/60">
                    <h2 className="font-title text-xl text-yellow-300">Assign Crew To Operation</h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="p-6 overflow-y-auto">
                    <div className="mb-6 bg-black/20 p-4 rounded-md border border-gray-700">
                        <h3 className="font-bold text-lg text-yellow-100">{operation.title}</h3>
                        <p className="text-sm text-gray-300 mt-1">{operation.description}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-gray-400">
                            <span>Difficulty: <span className="font-mono text-white">{operation.difficulty}/10</span></span>
                            <div className="flex items-center space-x-2">
                                <span>Required Skills:</span>
                                <div className="flex space-x-2 text-yellow-400">
                                    {operation.requiredSkills.map(s => <SkillIcon key={s} skill={s} />)}
                                </div>
                            </div>
                            <div className="flex items-center space-x-1" title="Estimated time to complete with selected crew">
                                <ClockIcon className="w-4 h-4"/>
                                <span>Est. Duration:</span>
                                <span className="font-mono text-white">{Math.round(modifiedDurationHours)} hours</span>
                            </div>
                        </div>
                    </div>

                    <h4 className="font-semibold text-yellow-200 mb-3">Available Crew ({sortedAvailableMembers.length})</h4>
                    <div className="space-y-3">
                        {sortedAvailableMembers.map(member => (
                            <label key={member.id} className="flex items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700 hover:border-yellow-600 transition-colors cursor-pointer">
                                <input 
                                    type="checkbox"
                                    checked={selectedMemberIds.has(member.id)}
                                    onChange={() => handleSelectMember(member.id)}
                                    className="w-5 h-5 bg-gray-700 border-gray-600 text-yellow-600 focus:ring-yellow-500 rounded"
                                />
                                <div className="ml-4 flex-grow">
                                    <p className="font-semibold text-gray-100">{member.name}</p>
                                    <p className="text-xs text-gray-400">{member.role}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                    {operation.requiredSkills.map(skill => (
                                        <div key={skill} className="flex items-center space-x-1 bg-gray-900/50 px-2 py-1 rounded-md" title={skill}>
                                            <SkillIcon skill={skill} className="w-4 h-4 text-yellow-500" />
                                            <span className="text-xs font-mono">{getSkillValue(member, skill)}</span>
                                        </div>
                                    ))}
                                </div>
                            </label>
                        ))}
                         {sortedAvailableMembers.length === 0 && (
                            <p className="text-center text-gray-500 py-4">All your crew members are currently busy.</p>
                        )}
                    </div>
                </div>

                <footer className="flex flex-col md:flex-row justify-between md:items-center p-4 border-t border-yellow-900/60 mt-auto bg-black/20 gap-4">
                    <div className="flex-grow space-y-1 text-center md:text-left">
                        <div>
                            <span className="font-semibold text-gray-300">Success Probability: </span>
                            <span className={`font-bold text-xl ${probabilityColor}`}>{successChance}%</span>
                        </div>
                        {operation.reward > 0 && (
                            <div>
                                <span className="font-semibold text-gray-300">Projected Reward: </span>
                                <span className="font-bold text-lg text-green-300">${modifiedReward.toLocaleString()}</span>
                                {rewardModifier !== 1 && selectedMemberIds.size > 0 && (
                                    <span className={`text-xs ml-1 ${rewardModifier > 1 ? 'text-green-400' : 'text-red-400'}`}>
                                        ({rewardModifier > 1 ? '+' : ''}{(Math.round((rewardModifier - 1) * 100))}%)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex space-x-3 self-center">
                        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                        <Button onClick={handleConfirm} disabled={selectedMemberIds.size === 0}>
                            Confirm Assignment
                        </Button>
                    </div>
                </footer>
            </div>
        </div>
    );
};