

import React, { useState, useMemo } from 'react';
import { GangMember, District, HqUpgrade, Trait } from '../types';
import { HeartIcon, ZapIcon, ShieldIcon, TruckIcon, WrenchIcon, DollarSignIcon, BandageIcon, SortAscendingIcon, SortDescendingIcon, InfinityIcon, BookOpenIcon, TagIcon, StarIcon, LightbulbIcon } from './icons';
import { Button } from './Button';

interface GangViewProps {
  gangMembers: GangMember[];
  districts: District[];
  hqUpgrades: HqUpgrade[];
  onSetAssignment: (memberId: number, assignment: GangMember['assignment'] | null) => void;
}

type SortKey = 'name' | 'loyalty' | 'combat' | 'rating';
type SkillKey = keyof GangMember['skills'];

const calculateRating = (member: GangMember) => Object.values(member.skills).reduce((sum, val) => sum + Number(val), 0);

const Skill: React.FC<{ name: string; value: number; icon: React.ReactNode }> = ({ name, value, icon }) => (
    <div className="flex items-center space-x-2 text-sm bg-gray-800/50 p-1 rounded-md" title={`${name}: ${value}`}>
      <div className="text-yellow-400">{icon}</div>
      <span className="font-mono text-gray-200">{value.toString().padStart(2, '0')}</span>
    </div>
);

const StatusTag: React.FC<{ status: GangMember['status'], recoveryTime?: number }> = ({ status, recoveryTime }) => {
    const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full flex items-center space-x-1.5';
    if (status === 'Idle') {
        return <div className={`${baseClasses} bg-green-800/70 text-green-200`}><div className="w-2 h-2 bg-green-400 rounded-full"></div><span>{status}</span></div>;
    }
    if (status === 'On Operation') {
        return <div className={`${baseClasses} bg-blue-800/70 text-blue-200`}>{status}</div>;
    }
     if (status === 'Training') {
        return <div className={`${baseClasses} bg-purple-800/70 text-purple-200`}><BookOpenIcon className="w-3 h-3"/><span>{status}</span></div>;
    }
    if (status === 'Wounded') {
        const time = recoveryTime ? ` (${recoveryTime}h)` : '';
        return <div className={`${baseClasses} bg-indigo-800/70 text-indigo-200`}><BandageIcon className="w-3 h-3" /><span>{status}{time}</span></div>;
    }
    if (status === 'Gathering Intel') {
        return <div className={`${baseClasses} bg-yellow-800/70 text-yellow-200`}><LightbulbIcon className="w-3 h-3"/><span>{status}</span></div>;
    }
    return null;
}

const TraitTag: React.FC<{ trait: Trait }> = ({ trait }) => {
    const isPositive = trait.name === 'Survivor' || trait.name === 'Rock Solid'; // Example logic
    const colorClasses = isPositive ? 'bg-green-900/80 text-green-300' : 'bg-red-900/80 text-red-300';
    return (
        <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-xs ${colorClasses}`} title={trait.description}>
            <TagIcon className="w-3 h-3"/>
            <span>{trait.name}</span>
        </div>
    );
};

export const GangView: React.FC<GangViewProps> = ({ gangMembers, districts, hqUpgrades, onSetAssignment }) => {
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [assigningMemberId, setAssigningMemberId] = useState<number | null>(null);

  const sortedMembers = useMemo(() => {
    const sortableMembers = [...gangMembers];
    sortableMembers.sort((a, b) => {
      const { key, direction } = sortConfig;

      if (key === 'loyalty') {
        const aLoyalty = a.loyalty === 'infinity' ? Infinity : a.loyalty;
        const bLoyalty = b.loyalty === 'infinity' ? Infinity : b.loyalty;
        if (aLoyalty < bLoyalty) return direction === 'asc' ? -1 : 1;
        if (aLoyalty > bLoyalty) return direction === 'asc' ? 1 : -1;
        return 0;
      }
      
      if (key === 'rating') {
        const aRating = calculateRating(a);
        const bRating = calculateRating(b);
        if (aRating < bRating) return direction === 'asc' ? -1 : 1;
        if (aRating > bRating) return direction === 'asc' ? 1 : -1;
        return 0;
      }

      const aValue = key === 'combat' ? a.skills.combat : a[key];
      const bValue = key === 'combat' ? b.skills.combat : b[key];

      if (aValue < bValue) {
        return direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return sortableMembers;
  }, [gangMembers, sortConfig]);

  const requestSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortKey): React.ReactNode => {
      if (sortConfig.key !== key) return null;
      return sortConfig.direction === 'asc' ? <SortAscendingIcon /> : <SortDescendingIcon />;
  }

  const sortButtons: {key: SortKey, label: string}[] = [
      { key: 'name', label: 'Name' },
      { key: 'loyalty', label: 'Loyalty' },
      { key: 'combat', label: 'Combat' },
      { key: 'rating', label: 'Rating' },
  ];
  
  const handleAssignment = (assignment: GangMember['assignment'] | null) => {
    if (assigningMemberId) {
      onSetAssignment(assigningMemberId, assignment);
    }
    setAssigningMemberId(null);
  };

  const getAssignmentName = (assignment: GangMember['assignment']) => {
      if (!assignment) return 'None';
      if (assignment.type === 'district') {
          const district = districts.find(d => d.id === assignment.districtId);
          if (!district) return 'Managing: Unknown District';
          const action = district.controlledBy === 'player' ? 'Managing' : 'Influencing';
          return `${action}: ${district.name}`;
      }
      if (assignment.type === 'hq') {
          return `Assigned to: ${hqUpgrades.find(h => h.id === assignment.upgradeId)?.name || 'Unknown Upgrade'}`;
      }
      if (assignment.type === 'training') {
          const skillName = assignment.skill.charAt(0).toUpperCase() + assignment.skill.slice(1);
          return `Training: ${skillName} (${assignment.progress}%)`;
      }
      return 'Unknown Assignment';
  }

  const getAvailableAssignments = (member: GangMember) => {
      const districtAssignments: { label: string; value: { type: 'district'; districtId: number } }[] = districts.map(d => ({
          label: `${d.name} (${d.controlledBy === 'player' ? 'Manage' : 'Influence'})`,
          value: { type: 'district', districtId: d.id }
      }));

      const hqAssignments: { label: string; value: { type: 'hq'; upgradeId: number } }[] = hqUpgrades
        .filter(u => u.owned && u.assignmentSlot && u.assignmentSlot.requiredRole === member.role && !gangMembers.some(m => m.assignment?.type === 'hq' && m.assignment.upgradeId === u.id))
        .map(u => ({
            label: u.name,
            value: { type: 'hq', upgradeId: u.id }
        }));
      
      const skillTrainingAssignments: { label: string; value: { type: 'training'; skill: SkillKey; progress: number } }[] = 
        (Object.keys(member.skills) as SkillKey[]).map(skill => ({
            label: `Train ${skill.charAt(0).toUpperCase() + skill.slice(1)}`,
            value: { type: 'training', skill, progress: 0 }
        }));

      return { districtAssignments, hqAssignments, skillTrainingAssignments };
  }


  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 pb-2 border-b-2 border-yellow-700/50">
            <h2 className="font-title text-2xl text-yellow-300 mb-2 sm:mb-0">Your Crew</h2>
            <div className="flex items-center space-x-2 bg-black/20 p-1 rounded-md">
                <span className="text-sm text-gray-400 px-2">Sort by:</span>
                {sortButtons.map(({key, label}) => (
                    <button 
                        key={key} 
                        onClick={() => requestSort(key)}
                        className={`px-3 py-1 text-sm rounded-md flex items-center space-x-2 transition-colors ${
                            sortConfig.key === key ? 'bg-yellow-600 text-black' : 'bg-gray-700 hover:bg-gray-600 text-yellow-200'
                        }`}
                        title={`Sort by ${label}`}
                    >
                        <span>{label}</span>
                        {getSortIcon(key)}
                    </button>
                ))}
            </div>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sortedMembers.map(member => {
            const availableAssignments = getAvailableAssignments(member);
            const canBeAssigned = member.status === 'Idle' && (availableAssignments.districtAssignments.length > 0 || availableAssignments.hqAssignments.length > 0 || availableAssignments.skillTrainingAssignments.length > 0);
            const assignmentTooltip = member.assignment ? getAssignmentName(member.assignment) : undefined;
            const rating = calculateRating(member);

            return (
              <div 
                key={member.id} 
                className={`bg-gray-900/70 border rounded-lg p-4 shadow-lg transition-all duration-300 flex flex-col justify-between ${
                    member.status === 'Idle' ? 'border-green-800/50 hover:border-green-600' : 'border-gray-700 hover:border-yellow-600'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                      <div>
                          <h3 className="font-bold text-xl text-yellow-100">{member.name}</h3>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-light text-yellow-400">{member.role}</p>
                            <div className="flex items-center space-x-1 text-sm text-cyan-300" title={`Total Skill Rating: ${rating}`}>
                                <StarIcon className="w-4 h-4 text-cyan-400"/>
                                <span>{rating}</span>
                            </div>
                          </div>
                      </div>
                      <div title={assignmentTooltip} className="flex-shrink-0">
                        <StatusTag status={member.status} recoveryTime={member.recoveryTime} />
                      </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 my-3 text-sm">
                      <div className="flex items-center space-x-1" title="Loyalty">
                          {member.loyalty === 'infinity' ? (
                              <InfinityIcon className="text-cyan-400" />
                          ) : (
                              <HeartIcon className="text-red-400" />
                          )}
                          <span>{member.loyalty === 'infinity' ? 'Unbreakable' : `${member.loyalty}%`}</span>
                      </div>
                  </div>
                  
                  {member.traits && member.traits.length > 0 && (
                        <div className="border-t border-gray-700 pt-3 mb-3">
                            <p className="text-xs text-gray-400 mb-2">Traits</p>
                            <div className="flex flex-wrap gap-2">
                                {member.traits.map(trait => <TraitTag key={trait.name} trait={trait} />)}
                            </div>
                        </div>
                  )}

                  <div className="border-t border-gray-700 pt-3">
                      <p className="text-xs text-gray-400 mb-2">Skills</p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        <Skill name="Combat" value={member.skills.combat} icon={<ShieldIcon />} />
                        <Skill name="Cunning" value={member.skills.cunning} icon={<ZapIcon />} />
                        <Skill name="Influence" value={member.skills.influence} icon={<DollarSignIcon />} />
                        <Skill name="Logistics" value={member.skills.logistics} icon={<TruckIcon />} />
                        <Skill name="Production" value={member.skills.production} icon={<WrenchIcon />} />
                      </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-700 mt-4 pt-3">
                    {member.assignment ? (
                        <div className="text-sm">
                            <p className="text-gray-400">Assignment:</p>
                            <div className="flex justify-between items-center bg-gray-800/50 p-2 rounded-md">
                                <span className="font-semibold text-blue-300">{getAssignmentName(member.assignment)}</span>
                                <Button size="sm" variant="secondary" onClick={() => onSetAssignment(member.id, null)}>Unassign</Button>
                            </div>
                        </div>
                    ) : canBeAssigned ? (
                        <div className="relative">
                            <Button size="sm" className="w-full" onClick={() => setAssigningMemberId(member.id === assigningMemberId ? null : member.id)}>Assign Task</Button>
                            {assigningMemberId === member.id && (
                                <div className="absolute bottom-full left-0 w-full max-h-48 overflow-y-auto bg-gray-800 border border-yellow-700 rounded-md shadow-lg z-10 mb-2">
                                    {availableAssignments.skillTrainingAssignments.length > 0 && (
                                        <>
                                            <div className="px-4 py-2 text-xs text-gray-400 font-bold uppercase">Training</div>
                                            {availableAssignments.skillTrainingAssignments.map(as => (
                                                <button key={`t-${String(as.value.skill)}`} onClick={() => handleAssignment(as.value)} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-yellow-700/50">
                                                    {as.label}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {availableAssignments.districtAssignments.length > 0 && (
                                        <>
                                            <div className="px-4 py-2 text-xs text-gray-400 font-bold uppercase">Districts</div>
                                            {availableAssignments.districtAssignments.map(as => (
                                                <button key={`d-${as.value.districtId}`} onClick={() => handleAssignment(as.value)} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-yellow-700/50">
                                                    {as.label}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                     {availableAssignments.hqAssignments.length > 0 && (
                                        <>
                                            <div className="px-4 py-2 text-xs text-gray-400 font-bold uppercase">Headquarters</div>
                                            {availableAssignments.hqAssignments.map(as => (
                                                <button key={`h-${as.value.upgradeId}`} onClick={() => handleAssignment(as.value)} className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-yellow-700/50">
                                                    {as.label}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-center text-gray-500 italic">Unavailable for assignment</p>
                    )}
                </div>
              </div>
            )
        })}
      </div>
    </div>
  );
};
