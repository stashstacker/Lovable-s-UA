import React, { useMemo } from 'react';
import { Mastermind, ActiveOperation } from '../types';
import { Button } from './Button';
import { SKILL_TREES } from '../constants';
import { XIcon, StarIcon, ZapIcon } from './icons';

interface MastermindOperationModalProps {
  // FIX: Specified that the operation must be of type 'REGULAR'. This ensures properties like `title` and `description` are available.
  activeOp: { operation: Extract<ActiveOperation, { type: 'REGULAR' }>; memberIds: number[] };
  mastermind: Mastermind;
  onResolve: (outcome: 'standard' | 'ability' | 'check', data: any) => void;
  onCancel: () => void;
}

export const MastermindOperationModal: React.FC<MastermindOperationModalProps> = ({ activeOp, mastermind, onResolve, onCancel }) => {
    const { operation } = activeOp;
    const { crucialMoment } = operation;

    const unlockedAbilities = useMemo(() => {
        const skillTree = SKILL_TREES[mastermind.class];
        return skillTree.filter(skill => 
            mastermind.unlockedSkills.includes(skill.id) &&
            skill.effect.type === 'ACTIVE_ABILITY'
        );
    }, [mastermind.unlockedSkills, mastermind.class]);
    
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-900 border-2 border-cyan-700/50 rounded-lg shadow-2xl w-full max-w-2xl transform transition-all max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b border-cyan-900/60">
                    <h2 className="font-title text-xl text-cyan-300 flex items-center space-x-2">
                        <StarIcon />
                        <span>Mastermind Intervention</span>
                    </h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="p-6 overflow-y-auto">
                    <div className="mb-6 bg-black/20 p-4 rounded-md border border-gray-700">
                        <h3 className="font-bold text-lg text-yellow-100">{operation.title}</h3>
                        <p className="text-sm text-gray-300 mt-1">{crucialMoment ? crucialMoment.scenario : operation.description}</p>
                        <p className="text-sm text-cyan-300/80 italic mt-4">This is a critical moment. Your personal intervention can change the outcome. How do you proceed?</p>
                    </div>

                    <div className="space-y-4">
                         {/* Attribute Checks */}
                        {crucialMoment && crucialMoment.choices.map((choice, index) => {
                            const canAttempt = mastermind.attributes[choice.attribute] >= choice.check;
                            const attributeValue = mastermind.attributes[choice.attribute];
                            const chance = Math.round(attributeValue * 10); // Simple 1-10 check, so it's attribute * 10% chance.
                            
                            return (
                                <Button
                                    key={index}
                                    className="w-full text-left p-4"
                                    onClick={() => onResolve('check', { choice })}
                                    disabled={!canAttempt}
                                    title={!canAttempt ? `Requires ${choice.attribute} ${choice.check}` : `Your ${choice.attribute} of ${attributeValue} gives you a ~${chance}% chance.`}
                                >
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold">[{choice.attribute.charAt(0).toUpperCase() + choice.attribute.slice(1)} {choice.check}+] {choice.description}</h4>
                                        <span className={`font-mono font-bold text-lg ${canAttempt ? 'text-yellow-300' : 'text-red-500'}`}>{chance}%</span>
                                    </div>
                                </Button>
                            );
                        })}

                        {/* Ascendant Abilities */}
                        {unlockedAbilities.map(skill => {
                            const focusCost = skill.effect.value;
                            const canAfford = mastermind.focus >= focusCost;
                            return (
                                <Button
                                    key={skill.id}
                                    className="w-full text-left p-4 border-2 border-transparent hover:border-cyan-400"
                                    onClick={() => onResolve('ability', { skillId: skill.id, focusCost: skill.effect.value, skillName: skill.name })}
                                    disabled={!canAfford}
                                    title={!canAfford ? `Not enough Focus (requires ${focusCost})` : ''}
                                >
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-lg flex items-center space-x-2"><ZapIcon className="w-5 h-5 text-cyan-300"/><span>{skill.name}</span></h4>
                                        <span className={`font-mono font-bold text-lg ${canAfford ? 'text-cyan-300' : 'text-red-500'}`}>{focusCost} Focus</span>
                                    </div>
                                    <p className="text-sm font-normal text-gray-200 mt-1">{skill.effectDescription}</p>
                                    <p className="text-xs font-normal text-green-400/80 mt-1 italic">Guarantees a critical success with bonus rewards.</p>
                                </Button>
                            );
                        })}
                        
                        {/* Standard Approach */}
                        <Button 
                            className="w-full text-left p-4"
                            variant="secondary"
                            onClick={() => onResolve('standard', {})}
                        >
                            <h4 className="font-bold">Let the Crew Handle It</h4>
                            <p className="text-sm font-normal text-gray-300">Rely on your crew's skills and the plan as briefed. A solid, if predictable, path to success.</p>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};