

import React, { useState, useMemo } from 'react';
import { GangMember } from '../types';
import { Button } from './Button';
import { XIcon, ShieldIcon, ZapIcon, DollarSignIcon, TruckIcon, WrenchIcon, UsersIcon } from './icons';

interface AssignIntelModalProps {
  gangMembers: GangMember[];
  onConfirm: (memberId: number) => void;
  onCancel: () => void;
}

const getMemberArchetypeInfo = (member: GangMember): { archetype: string, description: string } => {
    const skills = member.skills;
    const primarySkill = Object.keys(skills).reduce((a, b) => skills[a as keyof typeof skills] > skills[b as keyof typeof skills] ? a : b);

    switch(primarySkill) {
        case 'combat': return { archetype: "Bruiser", description: "Likely to find opportunities for violence, shakedowns, and territorial disputes. Might attract unwanted attention." };
        case 'cunning': return { archetype: "Shadow", description: "Will likely uncover subtle opportunities like blackmail, sabotage, and high-stakes heists. Prefers the shadows." };
        case 'influence': return { archetype: "Smooth Talker", description: "Taps into the city's elite. Likely to find operations involving corruption, political manipulation, and social engineering."};
        case 'logistics':
        case 'production':
            return { archetype: "Fixer", description: "Focuses on the nuts and bolts. Might find opportunities to disrupt rival supply lines or secure valuable resources."};
        default: return { archetype: "Generalist", description: "A jack-of-all-trades who will find a mixed bag of common street-level operations."};
    }
};


export const AssignIntelModal: React.FC<AssignIntelModalProps> = ({ gangMembers, onConfirm, onCancel }) => {
    const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);

    const availableMembers = useMemo(() => gangMembers.filter(m => m.status === 'Idle'), [gangMembers]);

    const handleConfirm = () => {
        if (selectedMemberId !== null) {
            onConfirm(selectedMemberId);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
            <div className="bg-gray-900 border-2 border-yellow-800/50 rounded-lg shadow-2xl w-full max-w-xl transform transition-all max-h-[90vh] flex flex-col">
                <header className="flex justify-between items-center p-4 border-b border-yellow-900/60">
                    <h2 className="font-title text-xl text-yellow-300">Assign Operative to Gather Intel</h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors">
                        <XIcon className="w-6 h-6" />
                    </button>
                </header>
                
                <div className="p-6 overflow-y-auto">
                    <div className="mb-6 bg-black/20 p-4 rounded-md border border-gray-700">
                        <h3 className="font-bold text-lg text-yellow-100">Send an Operative</h3>
                        <p className="text-sm text-gray-300 mt-1">Choose a member of your crew to work their contacts and shake the grapevine for new opportunities. The type of intel they find will depend on their expertise. This will cost ${10000..toLocaleString()} and they will be occupied for 12 hours.</p>
                    </div>

                    <h4 className="font-semibold text-yellow-200 mb-3 flex items-center space-x-2"><UsersIcon className="w-5 h-5"/><span>Available Operatives ({availableMembers.length})</span></h4>
                    <div className="space-y-3">
                        {availableMembers.map(member => {
                            const { archetype, description } = getMemberArchetypeInfo(member);
                            return (
                            <label key={member.id} className={`flex items-start bg-gray-800/50 p-3 rounded-lg border-2 transition-colors cursor-pointer ${selectedMemberId === member.id ? 'border-yellow-500' : 'border-gray-700 hover:border-yellow-600'}`}>
                                <input 
                                    type="radio"
                                    name="intel-operative"
                                    checked={selectedMemberId === member.id}
                                    onChange={() => setSelectedMemberId(member.id)}
                                    className="w-5 h-5 bg-gray-700 border-gray-600 text-yellow-600 focus:ring-yellow-500 mt-1"
                                />
                                <div className="ml-4 flex-grow">
                                    <p className="font-semibold text-gray-100">{member.name} - <span className="text-yellow-400">{archetype}</span></p>
                                    <p className="text-xs text-gray-400 italic">{description}</p>
                                </div>
                            </label>
                        )})}
                         {availableMembers.length === 0 && (
                            <p className="text-center text-gray-500 py-4">All your crew members are currently busy.</p>
                        )}
                    </div>
                </div>

                <footer className="flex justify-end p-4 border-t border-yellow-900/60 mt-auto bg-black/20">
                    <div className="flex space-x-3">
                        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                        <Button onClick={handleConfirm} disabled={selectedMemberId === null}>
                            Confirm Assignment
                        </Button>
                    </div>
                </footer>
            </div>
        </div>
    );
};
