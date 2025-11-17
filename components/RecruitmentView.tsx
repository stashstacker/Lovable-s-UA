

import React, { useState } from 'react';
import { District, PotentialRecruit, GangMember, ActiveOperation } from '../types';
import { Button } from './Button';
import { DollarSignIcon, ShieldIcon, ZapIcon, TruckIcon, WrenchIcon, UsersIcon, ClockIcon, StarIcon } from './icons';
// FIX: Imported GAME_MECHANICS and getHeatCostModifier to calculate dynamic costs.
import { GAME_MECHANICS, getHeatCostModifier } from '../constants';

interface RecruitmentViewProps {
  districts: District[];
  potentialRecruits: Record<number, PotentialRecruit[]>;
  onStartScouting: (districtId: number, memberId: number) => void;
  onHire: (districtId: number, recruit: PotentialRecruit) => void;
  gangMembers: GangMember[];
  activeScoutingOps: Extract<ActiveOperation, {type: 'SCOUTING'}>[];
  worldTime: Date;
  districtRecruitPools: Record<number, PotentialRecruit[]>;
  // FIX: Added heat to props to calculate correct costs.
  heat: number;
  tier: number;
}

const calculateRating = (recruit: PotentialRecruit) => Object.values(recruit.skills).reduce((sum, val) => sum + Number(val), 0);

const Skill: React.FC<{ name: string; value: number; icon: React.ReactNode }> = ({ name, value, icon }) => (
    <div className="flex items-center space-x-2 text-xs bg-gray-800/50 p-1 rounded-md" title={`${name}: ${value}`}>
      <div className="text-yellow-400">{icon}</div>
      <span className="font-mono text-gray-200">{value.toString().padStart(2, '0')}</span>
    </div>
);

const RarityTag: React.FC<{ rarity: PotentialRecruit['rarity'] }> = ({ rarity }) => {
    const styles = {
        common: 'bg-gray-700 text-gray-300',
        uncommon: 'bg-blue-800 text-blue-200',
        rare: 'bg-purple-800 text-purple-200',
    };
    return (
        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${styles[rarity]}`}>
            {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
        </span>
    );
};

const RecruitCard: React.FC<{ recruit: PotentialRecruit; onHire: () => void; }> = ({ recruit, onHire }) => {
    const rating = calculateRating(recruit);
    return (
        <div className="bg-gray-800/60 border border-gray-700 p-3 rounded-lg">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-yellow-100">{recruit.name}</h4>
                    <div className="flex items-center space-x-3 text-xs mt-1">
                        <p className="text-yellow-400">{recruit.role}</p>
                        <div className="flex items-center space-x-1 text-cyan-300" title={`Total Skill Rating: ${rating}`}>
                            <StarIcon className="w-3 h-3 text-cyan-400"/>
                            <span>{rating}</span>
                        </div>
                        <RarityTag rarity={recruit.rarity || 'common'} />
                    </div>
                </div>
                <Button size="sm" onClick={onHire}>
                    <div className="flex items-center space-x-1.5">
                        <span>Hire</span>
                        <DollarSignIcon className="w-4 h-4" />
                        <span>{recruit.hiringFee.toLocaleString()}</span>
                    </div>
                </Button>
            </div>
             {recruit.backstoryHook && <p className="text-xs text-gray-400 italic mt-2">"{recruit.backstoryHook}"</p>}
            <div className="grid grid-cols-5 gap-1 mt-3">
                <Skill name="Combat" value={recruit.skills.combat} icon={<ShieldIcon />} />
                <Skill name="Cunning" value={recruit.skills.cunning} icon={<ZapIcon />} />
                <Skill name="Influence" value={recruit.skills.influence} icon={<DollarSignIcon />} />
                <Skill name="Logistics" value={recruit.skills.logistics} icon={<TruckIcon />} />
                <Skill name="Production" value={recruit.skills.production} icon={<WrenchIcon />} />
            </div>
        </div>
    );
};

export const RecruitmentView: React.FC<RecruitmentViewProps> = ({ districts, potentialRecruits, onStartScouting, onHire, gangMembers, activeScoutingOps, worldTime, districtRecruitPools, heat, tier }) => {
    const [scoutingDistrictId, setScoutingDistrictId] = useState<number | null>(null);

    const idleMembersWithInfluence = gangMembers.filter(m => m.status === 'Idle' && m.skills.influence > 0);
    
    // FIX: Calculated the scouting cost including the heat modifier for accurate UI display.
    const scoutingCost = Math.round(GAME_MECHANICS.SCOUTING_COST * tier * getHeatCostModifier(heat));

    const handleStartScoutingClick = (districtId: number, memberId: number) => {
        onStartScouting(districtId, memberId);
        setScoutingDistrictId(null);
    };

    return (
    <div>
        <h2 className="font-title text-2xl text-yellow-300 mb-4 border-b-2 border-yellow-700/50 pb-2">Recruitment</h2>
        <p className="text-gray-400 mb-6">Your empire needs muscle, minds, and mouths. Send your influential members to scout your controlled districts for new talent. Better districts yield better prospects.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {districts.map(district => {
                const recruits = potentialRecruits[district.id] || [];
                const scoutingOp = activeScoutingOps.find(op => op.districtId === district.id);
                const poolIsEmpty = !(districtRecruitPools[district.id] && districtRecruitPools[district.id].length > 0);

                return (
                    <div key={district.id} className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 shadow-lg flex flex-col">
                        <h3 className="font-bold text-lg text-yellow-100 border-b border-gray-600 pb-2 mb-3">{district.name}</h3>
                        
                        {scoutingOp ? (
                            <div className="text-center py-8 bg-black/20 rounded-lg">
                                <p className="flex items-center justify-center space-x-2 text-yellow-300">
                                    <ClockIcon className="w-5 h-5 animate-spin" />
                                    <span>Scouting in Progress...</span>
                                </p>
                                <p className="text-xs text-gray-400 mt-2">Expected completion: {scoutingOp.completionTime.toLocaleDateString()} {scoutingOp.completionTime.toLocaleTimeString()}</p>
                            </div>
                        ) : recruits.length > 0 ? (
                            <div className="space-y-3">
                                {recruits.map(recruit => (
                                    <RecruitCard key={recruit.name} recruit={recruit} onHire={() => onHire(district.id, recruit)} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                {poolIsEmpty ? (
                                    <p className="text-gray-500">The local talent pool has run dry.</p>
                                ) : (
                                    <>
                                        <p className="text-gray-500 mb-4">No active prospects in this district.</p>
                                        <div className="relative inline-block">
                                            <Button onClick={() => setScoutingDistrictId(district.id === scoutingDistrictId ? null : district.id)} disabled={idleMembersWithInfluence.length === 0}>
                                                {idleMembersWithInfluence.length > 0 ? `Scout for Talent ($${scoutingCost.toLocaleString()})` : 'No Influencer Available'}
                                            </Button>
                                            {scoutingDistrictId === district.id && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-64 bg-gray-800 border border-yellow-700 rounded-md shadow-lg z-10 mb-2">
                                                    <div className="p-2 text-xs text-center text-gray-300 font-semibold border-b border-gray-700">Assign Influencer</div>
                                                    <div className="max-h-48 overflow-y-auto">
                                                        {idleMembersWithInfluence.map(member => (
                                                            <button key={member.id} onClick={() => handleStartScoutingClick(district.id, member.id)} className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-yellow-700/50">
                                                                {member.name} (Influence: {member.skills.influence})
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
             {districts.length === 0 && (
                <div className="text-center py-10 text-gray-500 md:col-span-2">
                    <p>You need to control districts to find new recruits.</p>
                </div>
            )}
        </div>
    </div>
    );
};
