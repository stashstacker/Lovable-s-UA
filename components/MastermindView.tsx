

import React from 'react';
import { Mastermind, Skill, MastermindClass } from '../types';
import { CrownIcon, ZapIcon, DollarSignIcon, ShieldIcon, StarIcon } from './icons';
import { SKILL_TREES } from '../constants';

interface MastermindViewProps {
  mastermind: Mastermind;
  onUnlockSkill: (skillId: string) => void;
}

const ATTRIBUTE_ICONS: { [key: string]: React.ReactNode } = {
    cunning: <ZapIcon className="w-5 h-5 text-purple-400" />,
    charisma: <DollarSignIcon className="w-5 h-5 text-green-400" />,
    strength: <ShieldIcon className="w-5 h-5 text-red-400" />,
};

const SkillNode: React.FC<{ skill: Skill, isUnlocked: boolean, canUnlock: boolean, onUnlock: () => void }> = ({ skill, isUnlocked, canUnlock, onUnlock }) => {
    const baseClasses = 'relative w-28 h-28 border-2 p-2 flex flex-col items-center justify-center text-center rounded-lg shadow-lg transition-all duration-300';
    const stateClasses = isUnlocked
        ? 'bg-yellow-600 border-yellow-400 text-black'
        : canUnlock
        ? 'bg-gray-700 border-yellow-500 cursor-pointer hover:bg-gray-600 hover:border-yellow-400'
        : 'bg-gray-800 border-gray-600 text-gray-500';
    
    const prereqText = skill.prerequisites.map(p => {
        const className = p.split('_')[0];
        const capitalizedClassName = (className.charAt(0).toUpperCase() + className.slice(1)) as MastermindClass;
        const tree = SKILL_TREES[capitalizedClassName];
        if (!tree) return 'Unknown Skill';
        return tree.find(s => s.id === p)?.name || 'Unknown Skill';
    }).join(', ');
    
    const title = `${skill.name}\n\n${skill.description}\n\nEffect: ${skill.effectDescription}${!isUnlocked && prereqText ? `\nRequires: ${prereqText}` : ''}`;

    return (
        <div 
            className={`${baseClasses} ${stateClasses}`}
            style={{ gridRow: skill.position.row, gridColumn: skill.position.col }}
            onClick={canUnlock ? onUnlock : undefined}
            title={title}
        >
            <p className="font-bold text-xs leading-tight">{skill.name}</p>
            {isUnlocked && <div className="absolute -top-2 -right-2 w-5 h-5 bg-green-500 rounded-full border-2 border-gray-900"></div>}
        </div>
    );
};

export const MastermindView: React.FC<MastermindViewProps> = ({ mastermind, onUnlockSkill }) => {
    const nextLevelXp = mastermind.level * 1000;
    const skillTree = SKILL_TREES[mastermind.class];

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-2 border-b-2 border-yellow-700/50">
                <h2 className="font-title text-2xl text-yellow-300 flex items-center space-x-3">
                    <CrownIcon className="w-8 h-8"/>
                    <span>The Mastermind</span>
                </h2>
                <div className="text-lg font-semibold text-cyan-300">
                    Class: <span className="font-bold text-white">{mastermind.class}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Progression & Attributes */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg">
                        <h3 className="font-bold text-lg text-yellow-100 mb-3">Progression</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Level:</span>
                                <span className="font-mono font-bold text-xl">{mastermind.level}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Experience:</span>
                                <span className="font-mono">{mastermind.xp.toLocaleString()} / {nextLevelXp.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
                                <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${(mastermind.xp / nextLevelXp) * 100}%` }}></div>
                            </div>
                             <div className="flex justify-between pt-2">
                                <span className="text-gray-400">Skill Points:</span>
                                <span className="font-mono font-bold text-xl text-yellow-300">{mastermind.skillPoints}</span>
                            </div>
                             <div className="flex justify-between items-center pt-2">
                                <span className="text-gray-400">Focus:</span>
                                <div className="flex items-center space-x-2">
                                    <span className="font-mono font-bold text-xl text-cyan-300">{mastermind.focus} / {mastermind.maxFocus}</span>
                                    <ZapIcon className="w-5 h-5 text-cyan-400"/>
                                </div>
                            </div>
                             <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
                                <div className="bg-cyan-500 h-2.5 rounded-full" style={{ width: `${(mastermind.focus / mastermind.maxFocus) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg">
                         <h3 className="font-bold text-lg text-yellow-100 mb-3">Core Attributes</h3>
                         <div className="space-y-3">
                            {Object.entries(mastermind.attributes).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between bg-black/20 p-2 rounded-md">
                                    <div className="flex items-center space-x-2">
                                        {ATTRIBUTE_ICONS[key.toLowerCase()] || <div className="w-5 h-5"/>}
                                        <span className="font-semibold capitalize text-gray-300">{key}</span>
                                    </div>
                                    <span className="font-mono text-lg font-bold">{value}</span>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
                
                {/* Skill Tree */}
                <div className="md:col-span-2 bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg overflow-x-auto">
                     <h3 className="font-bold text-lg text-yellow-100 mb-3">{mastermind.class} Skill Tree</h3>
                     <div className="relative p-4 min-w-[600px]">
                        {/* Render lines first */}
                        <svg className="absolute top-0 left-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                            {skillTree.map(skill => {
                                return skill.prerequisites.map(prereqId => {
                                    const prereqSkill = skillTree.find(s => s.id === prereqId);
                                    if (!prereqSkill) return null;
                                    
                                    // Calculate center of each node (w-28, h-28 -> 112px, gap-4 -> 16px)
                                    // Node width/height is 112px, gap is 16px. Total cell size is 128px.
                                    const nodeSize = 112;
                                    const gap = 16;
                                    const cellSize = nodeSize + gap;
                                    
                                    const x1 = (prereqSkill.position.col - 1) * cellSize + nodeSize / 2 + 16; // +16 for p-4
                                    const y1 = (prereqSkill.position.row - 1) * cellSize + nodeSize / 2 + 16;
                                    const x2 = (skill.position.col - 1) * cellSize + nodeSize / 2 + 16;
                                    const y2 = (skill.position.row - 1) * cellSize + nodeSize / 2 + 16;

                                    const isUnlocked = mastermind.unlockedSkills.includes(skill.id);
                                    
                                    return <line key={`${prereqId}-${skill.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={isUnlocked ? '#f59e0b' : '#4b5563'} strokeWidth="2" />
                                })
                            })}
                        </svg>
                        <div className="grid grid-cols-5 grid-rows-5 gap-4">
                            {skillTree.map(skill => {
                                const isUnlocked = mastermind.unlockedSkills.includes(skill.id);
                                const prerequisitesMet = skill.prerequisites.every(p => mastermind.unlockedSkills.includes(p));
                                const canUnlock = !isUnlocked && prerequisitesMet && mastermind.skillPoints >= skill.cost;

                                return (
                                    <SkillNode 
                                        key={skill.id}
                                        skill={skill}
                                        isUnlocked={isUnlocked}
                                        canUnlock={canUnlock}
                                        onUnlock={() => onUnlockSkill(skill.id)}
                                    />
                                );
                            })}
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
};
