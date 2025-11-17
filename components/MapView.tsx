import React, { useState, useMemo } from 'react';
import { District, Faction, RivalOperation, Ward, MapActivity, ActiveOperation } from '../types';
import { CpuIcon, FlameIcon, JusticeIcon, UsersIcon, DollarSignIcon, ShieldCheckIcon, HomeIcon, GlobeIcon } from './icons';

interface MapViewProps {
  wards: Ward[];
  factions: Faction[];
  rivalOperations: RivalOperation[];
  activePlayerOperations: Extract<ActiveOperation, {type: 'REGULAR'}>[];
  activeTransportOperations: Extract<ActiveOperation, {type: 'TRANSPORT'}>[];
  worldTime: Date;
  onDistrictClick: (district: District) => void;
  heat: number;
  investigationProgress: number;
  mapConnections?: [number, number][];
  mapBackgroundUrl?: string;
  mapActivities: MapActivity[];
  onMapActivityClick: (activityId: number) => void;
}

const HQ_POS: [number, number] = [500, 720];

const Gauge: React.FC<{ label: string; value: number; max: number; color: string; icon: React.ReactNode }> = ({ label, value, max, color, icon }) => {
    const percentage = Math.min(100, (value / max) * 100);
    return (
        <div className="text-center p-2 bg-gray-900/50 rounded-md border border-gray-700 w-full">
            <div className="flex items-center justify-center space-x-2">
                {icon}
                <span className="text-xs font-semibold text-gray-300">{label}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                <div className="h-1.5 rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }}></div>
            </div>
            <p className="text-xs font-mono mt-1" style={{ color }}>{Math.round(value)} / {max}</p>
        </div>
    );
};

const getWardBonusDescription = (ward: Ward): string => {
    const typeCounts = ward.districts.reduce((acc, district) => {
        acc[district.type] = (acc[district.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const dominantType = Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b, 'mixed');

    switch (dominantType) {
        case 'Financial': case 'Entertainment': return "+15% Income from all districts in this ward.";
        case 'Industrial': case 'Docks': case 'port': return "Reduced heat generation from activities in this ward.";
        case 'Slums': case 'Residential': return "Slows police investigation progress while controlled.";
        default: return "+5% generic income bonus from this ward.";
    }
};

const getWardDominantFaction = (ward: Ward, factions: Faction[]): Faction => {
    const controllerCounts = ward.districts.reduce((acc, district) => {
        acc[district.controlledBy] = (acc[district.controlledBy] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const dominantFactionId = Object.keys(controllerCounts).reduce((a, b) => controllerCounts[a] > controllerCounts[b] ? a : b, 'neutral');
    return factions.find(f => f.id === dominantFactionId) || factions.find(f => f.id === 'neutral')!;
};


export const MapView: React.FC<MapViewProps> = ({ wards, factions, rivalOperations, activePlayerOperations, activeTransportOperations, worldTime, onDistrictClick, heat, investigationProgress, mapConnections, mapBackgroundUrl, mapActivities, onMapActivityClick }) => {
  const [hoveredDistrictId, setHoveredDistrictId] = useState<number | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [hoveredWardId, setHoveredWardId] = useState<string | null>(null);
  
  const viewMode = selectedWardId ? 'City' : 'World';

  const allDistricts = useMemo(() => wards.flatMap(w => w.districts), [wards]);
  const districtCentroids = useMemo(() => new Map(allDistricts.map(d => [d.id, d.centroid])), [allDistricts]);

  const wardCentroids = useMemo(() => {
    const centroids = new Map<string, [number, number]>();
    wards.forEach(ward => {
        if (ward.districts.length > 0) {
            const validCentroids = ward.districts.map(d => d.centroid).filter(Boolean) as [number, number][];
            if (validCentroids.length > 0) {
                const sumX = validCentroids.reduce((sum, c) => sum + c[0], 0);
                const sumY = validCentroids.reduce((sum, c) => sum + c[1], 0);
                centroids.set(ward.id, [sumX / validCentroids.length, sumY / validCentroids.length]);
            }
        }
    });
    return centroids;
  }, [wards]);

  const getFaction = (factionId: string) => factions.find(f => f.id === factionId);
  const getFactionColor = (factionId: string) => getFaction(factionId)?.color || 'bg-gray-700';
  
  const getFactionFill = (factionId: string): string => {
      const colorClass = getFactionColor(factionId);
      const colorMap: Record<string, string> = {
          'bg-green-700': '#15803d',
          'bg-gray-700': '#374151',
          'bg-red-700': '#b91c1c',
          'bg-blue-700': '#1d4ed8',
          'bg-purple-700': '#6d28d9',
          'bg-amber-600': '#d97706',
          'bg-teal-700': '#0d9488',
          'bg-pink-700': '#be185d',
          'bg-indigo-700': '#4338ca',
          'bg-lime-600': '#65a30d',
      };
      return colorMap[colorClass] || '#374151';
  };
  
  const allAttacks = useMemo(() => {
    const attacks: {
        targetDistrictId: number;
        attackerFactionId: string;
        defenderFactionId: string;
        progress: number;
    }[] = [];

    // Player takeovers
    activePlayerOperations.forEach(op => {
        if (op.isTakeoverOperation && op.targetDistrictId && op.startTime) {
            const district = allDistricts.find(d => d.id === op.targetDistrictId);
            if (!district) return;
            const totalDuration = op.completionTime.getTime() - op.startTime.getTime();
            const elapsed = worldTime.getTime() - op.startTime.getTime();
            const progress = Math.min(100, (elapsed / totalDuration) * 100);
            attacks.push({
                targetDistrictId: op.targetDistrictId,
                attackerFactionId: 'player',
                defenderFactionId: district.controlledBy,
                progress: progress,
            });
        }
    });

    // Rival attacks
    rivalOperations.forEach(op => {
        if (!op.isResolved && op.startTime) {
            const district = allDistricts.find(d => d.id === op.targetDistrictId);
            if (!district) return;
            const totalDuration = op.completionTime.getTime() - op.startTime.getTime();
            const elapsed = worldTime.getTime() - op.startTime.getTime();
            const progress = Math.min(100, (elapsed / totalDuration) * 100);
             attacks.push({
                targetDistrictId: op.targetDistrictId,
                attackerFactionId: op.factionId,
                defenderFactionId: district.controlledBy,
                progress: progress,
            });
        }
    });
    return attacks;
  }, [rivalOperations, activePlayerOperations, worldTime, allDistricts]);


  const selectedWard = useMemo(() => {
    if (!selectedWardId) return null;
    return wards.find(w => w.id === selectedWardId);
  }, [selectedWardId, wards]);

  const handleMouseEnterDistrict = (district: District) => {
    setHoveredDistrictId(district.id);
    const parentWard = wards.find(w => w.districts.some(d => d.id === district.id));
    if (parentWard) {
        setHoveredWardId(parentWard.id);
    }
  };

  const handleMouseLeaveDistrict = () => {
      setHoveredDistrictId(null);
      if (viewMode === 'World') {
         setHoveredWardId(null);
      }
  };


  const WardInfoPanel: React.FC<{ ward: Ward }> = ({ ward }) => {
      const dominantFaction = getWardDominantFaction(ward, factions);
      const isPlayerControlled = ward.districts.every(d => d.controlledBy === 'player');

      return (
          <div className="mt-3 p-2 bg-black/20 rounded-md border border-gray-600 flex-grow flex flex-col">
              <div className="flex justify-between items-center border-b border-gray-600 pb-1 mb-2">
                <h3 className="font-bold text-yellow-200 text-lg">{ward.name}</h3>
                <button onClick={() => setSelectedWardId(null)} className="text-gray-400 hover:text-white" title="Back to World View">
                    <GlobeIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="text-xs space-y-2 mb-2">
                  <div className="flex justify-between">
                      <span className="text-gray-400">Dominant Faction:</span>
                      <span className={`font-semibold ${dominantFaction.id === 'player' ? 'text-green-300' : dominantFaction.id === 'neutral' ? 'text-gray-300' : 'text-red-300'}`}>
                          {dominantFaction?.name || 'Contested'}
                      </span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-gray-400">Total Income:</span>
                      <span className="font-mono text-green-300">${ward.districts.reduce((sum, d) => sum + d.baseIncome, 0).toLocaleString()}/day</span>
                  </div>
              </div>
              <div className="space-y-1 overflow-y-auto flex-grow pr-1">
                  {ward.districts.map(d => (
                      <div key={d.id} className="flex items-center space-x-2 text-xs bg-gray-900/50 p-1 rounded-md">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getFactionColor(d.controlledBy)}`}></div>
                          <span className="text-gray-300 truncate">{d.name}</span>
                      </div>
                  ))}
              </div>
              {isPlayerControlled && (
                  <div className="mt-2 pt-2 border-t border-cyan-700/50 bg-cyan-900/30 p-2 rounded-md">
                      <p className="text-xs font-bold text-cyan-200 flex items-center"><ShieldCheckIcon className="w-4 h-4 mr-2" />Ward Control Bonus</p>
                      <p className="text-xs text-cyan-300/90 italic mt-1">{getWardBonusDescription(ward)}</p>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="bg-gray-900/50 border-2 border-yellow-800/50 rounded-lg p-2 shadow-2xl flex flex-col md:flex-row gap-4 h-[80vh]">
        {/* Diegetic Frame - Left Panel */}
        <div className="flex-shrink-0 w-full md:w-56 bg-black/30 border border-gray-700 rounded-md p-3 space-y-3 flex flex-col">
            <h2 className="font-title text-xl text-yellow-300 text-center border-b border-yellow-700/50 pb-2">City Status</h2>
            <Gauge label="Global Heat" value={heat} max={200} color="#f97316" icon={<FlameIcon className="w-4 h-4 text-orange-400" />} />
            <Gauge label="Investigation" value={investigationProgress} max={100} color="#ef4444" icon={<JusticeIcon className="w-4 h-4 text-red-400" />} />
            
            {selectedWard ? <WardInfoPanel ward={selectedWard} /> : (
                <div className="flex-grow flex flex-col justify-end">
                    <div className="text-center">
                        <p className="text-xs text-gray-400">Map Legend</p>
                        <div className="mt-2 space-y-1">
                            {factions.filter(f => f.id !== 'neutral').map(f => (
                                <div key={f.id} className="flex items-center space-x-2 text-xs">
                                    <div className={`w-3 h-3 rounded-full ${f.color}`}></div>
                                    <span className="text-gray-300">{f.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
        
        {/* Main Map SVG */}
        <div className="flex-grow bg-black/50 rounded-md relative overflow-hidden border border-gray-700">
             <svg viewBox="0 0 1000 750" className="w-full h-full" onClick={() => setSelectedWardId(null)}>
                <defs>
                    <pattern id="player-influence-stripes" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                        <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" style={{ stroke: getFactionFill('player'), strokeWidth: 2 }} />
                    </pattern>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="activity-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                        <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10" result="glow" />
                        <feComposite in="SourceGraphic" in2="glow" operator="over" />
                    </filter>
                    {/* Attack progress gradients will be generated here */}
                    {allAttacks.map(attack => {
                        const attackerColor = getFactionFill(attack.attackerFactionId);
                        const defenderColor = getFactionFill(attack.defenderFactionId);
                        const progress = attack.progress / 100;
                        return (
                            <linearGradient key={`grad-${attack.targetDistrictId}`} id={`grad-${attack.targetDistrictId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset={`${progress * 100}%`} stopColor={attackerColor} />
                                <stop offset={`${progress * 100 + 0.01}%`} stopColor={defenderColor} />
                            </linearGradient>
                        )
                    })}
                </defs>
                
                {mapBackgroundUrl && <image href={mapBackgroundUrl} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" opacity="0.3" />}

                {viewMode === 'World' ? (
                    <>
                        <g id="wards-filled">
                            {wards.map(ward => {
                                const dominantFaction = getWardDominantFaction(ward, factions);
                                const fill = getFactionFill(dominantFaction.id);
                                return (
                                    <path
                                        key={`ward-fill-${ward.id}`}
                                        d={ward.svgPath}
                                        fill={fill}
                                        stroke={fill}
                                        strokeWidth="1"
                                        onClick={(e) => { e.stopPropagation(); setSelectedWardId(ward.id); }}
                                        onMouseEnter={() => setHoveredWardId(ward.id)}
                                        onMouseLeave={() => setHoveredWardId(null)}
                                        className="cursor-pointer transition-opacity duration-300"
                                        style={{ opacity: hoveredWardId === ward.id ? 0.9 : 0.6 }}
                                    />
                                );
                            })}
                        </g>
                        <g id="wards-outlines-world">
                           {wards.map(ward => (
                               <path 
                                 key={`ward-outline-world-${ward.id}`}
                                 d={ward.svgPath} 
                                 fill="none" 
                                 stroke="#f59e0b"
                                 strokeWidth={hoveredWardId === ward.id ? 3 : 2}
                                 strokeOpacity={hoveredWardId === ward.id ? 0.9 : 0.6}
                                 className="transition-all duration-300"
                                 style={{ pointerEvents: 'none' }}
                               />
                           ))}
                        </g>
                        <g id="ward-labels" style={{ pointerEvents: 'none' }}>
                            {wards.map(ward => {
                                const centroid = wardCentroids.get(ward.id);
                                if (!centroid) return null;
                                return (
                                    <text
                                        key={`ward-label-${ward.id}`}
                                        x={centroid[0]}
                                        y={centroid[1]}
                                        textAnchor="middle" dy=".3em"
                                        fontSize="24"
                                        fill="#fde047"
                                        className="font-title font-bold"
                                        style={{ textShadow: '0 0 8px black, 0 0 8px black' }}
                                    >
                                        {ward.name}
                                    </text>
                                );
                            })}
                        </g>
                    </>
                ) : (
                    <>
                        <g id="wards-outlines-city">
                           {wards.map(ward => (
                               <path 
                                 key={`ward-outline-city-${ward.id}`} 
                                 d={ward.svgPath} 
                                 fill="none" 
                                 stroke="#f59e0b"
                                 strokeWidth={ward.id === selectedWardId ? 4 : 1}
                                 strokeOpacity={ward.id === selectedWardId ? 0.9 : 0.3}
                                 className="transition-all duration-300"
                                 style={{ pointerEvents: ward.id === selectedWardId ? 'none' : 'all' }}
                                 onClick={(e) => { e.stopPropagation(); setSelectedWardId(ward.id); }}
                               />
                           ))}
                        </g>

                        <g id="districts">
                            {allDistricts.map(district => {
                                const parentWard = wards.find(w => w.districts.some(d => d.id === district.id));
                                const isSelectedWard = parentWard?.id === selectedWardId;
                                const attack = allAttacks.find(a => a.targetDistrictId === district.id);
                                const fill = attack ? `url(#grad-${district.id})` : getFactionFill(district.controlledBy);
                                
                                return (
                                    <path
                                        key={district.id}
                                        d={district.svgPath}
                                        fill={isSelectedWard ? fill : '#111827'}
                                        stroke={isSelectedWard ? fill : '#111827'}
                                        strokeWidth="1"
                                        onClick={isSelectedWard ? (e) => { e.stopPropagation(); onDistrictClick(district); } : (e) => { e.stopPropagation(); setSelectedWardId(parentWard?.id || null); }}
                                        onMouseEnter={() => handleMouseEnterDistrict(district)}
                                        onMouseLeave={handleMouseLeaveDistrict}
                                        className="cursor-pointer transition-all duration-300"
                                        style={{ opacity: isSelectedWard ? (hoveredDistrictId === district.id ? 1 : 0.8) : 0.5 }}
                                    />
                                )
                            })}
                        </g>
                        
                        <g id="player-influence">
                            {allDistricts
                                .filter(d => d.playerInfluence > 0 && d.controlledBy === 'neutral' && wards.find(w => w.districts.some(dist => dist.id === d.id))?.id === selectedWardId)
                                .map(district => (
                                    <path
                                        key={`influence-${district.id}`}
                                        d={district.svgPath}
                                        fill="url(#player-influence-stripes)"
                                        style={{ pointerEvents: 'none', opacity: (district.playerInfluence / 100) * 0.8 }}
                                    />
                                ))}
                        </g>

                        <g id="attack-borders">
                            {allAttacks.map(attack => (
                                 <path
                                    key={`op-${attack.targetDistrictId}`}
                                    d={allDistricts.find(d => d.id === attack.targetDistrictId)?.svgPath}
                                    fill="none"
                                    stroke="#ef4444"
                                    className="pulsing-attack-border"
                                    style={{ pointerEvents: 'none' }}
                                />
                            ))}
                        </g>
                        <g id="labels" style={{ pointerEvents: 'none' }}>
                            {allDistricts.map(district => {
                                const parentWard = wards.find(w => w.districts.some(d => d.id === district.id));
                                if (parentWard?.id !== selectedWardId) return null;
                                
                                const isHovered = hoveredDistrictId === district.id;
                                return (
                                     <text 
                                        key={`label-${district.id}`}
                                        x={district.centroid?.[0]}
                                        y={district.centroid?.[1]}
                                        textAnchor="middle"
                                        dy=".3em"
                                        fontSize={isHovered ? "14" : "12"}
                                        fill="#ffffff"
                                        className="font-semibold transition-all duration-300"
                                        style={{
                                            textShadow: '0 0 5px black, 0 0 5px black, 0 0 5px black',
                                            opacity: isHovered ? 1 : 0.8
                                        }}
                                     >
                                         {district.name}
                                     </text>
                                )
                            })}
                        </g>
                    </>
                )}
                
                <g id="connections">
                    {mapConnections?.map(([id1, id2], index) => {
                        const pos1 = districtCentroids.get(id1);
                        const pos2 = districtCentroids.get(id2);
                        if (!pos1 || !pos2) return null;

                        const isHighlighted = hoveredDistrictId === id1 || hoveredDistrictId === id2;
                        const opacity = viewMode === 'City' && selectedWard && (!selectedWard.districts.some(d => d.id === id1) || !selectedWard.districts.some(d => d.id === id2)) ? 0.1 : 1;

                        const pathData = `M${pos1[0]},${pos1[1]} L${pos2[0]},${pos2[1]}`;

                        return (
                            <path 
                                key={`conn-${index}`} 
                                d={pathData} 
                                fill="none" 
                                className={`transition-all duration-300 ${isHighlighted ? 'stroke-yellow-300 stroke-[2.5px]' : 'stroke-yellow-700/60 stroke-[1px]'}`}
                                style={{ pointerEvents: 'none', opacity }}
                                filter={isHighlighted ? "url(#glow)" : ""}
                            />
                        );
                    })}
                </g>

                <g id="transport-lines">
                    {activeTransportOperations.map(op => {
                        const destCentroid = districtCentroids.get(op.destinationDistrictId);
                        if (!destCentroid) return null;
                        const progress = (worldTime.getTime() - op.startTime.getTime()) / (op.completionTime.getTime() - op.startTime.getTime());
                        return (
                             <g key={op.id}>
                                <path 
                                    d={`M${HQ_POS[0]},${HQ_POS[1]} L${destCentroid[0]},${destCentroid[1]}`} 
                                    stroke="#fde047"
                                    strokeWidth="2"
                                    strokeDasharray="8 4"
                                    className="transport-line"
                                />
                                <circle 
                                    cx={HQ_POS[0] + (destCentroid[0] - HQ_POS[0]) * progress}
                                    cy={HQ_POS[1] + (destCentroid[1] - HQ_POS[1]) * progress}
                                    r="5"
                                    fill="#fde047"
                                    stroke="black"
                                    strokeWidth="1"
                                />
                            </g>
                        )
                    })}
                </g>
                
                <g transform={`translate(${HQ_POS[0]-15}, ${HQ_POS[1]-15})`}>
                    <HomeIcon className="w-8 h-8 text-yellow-200" strokeWidth="1.5" style={{ filter: 'drop-shadow(0 0 5px black)'}}/>
                </g>

                <g id="activities">
                    {mapActivities.map(activity => {
                        const parentWard = wards.find(w => w.districts.some(d => d.id === activity.districtId));
                        if(viewMode === 'City' && parentWard?.id !== selectedWardId) return null;

                        const centroid = districtCentroids.get(activity.districtId);
                        if (!centroid) return null;
                        const icon = activity.type === 'cash' ? '💲' : '📈';
                        const color = activity.type === 'cash' ? '#4ade80' : '#60a5fa';

                        return (
                            <g 
                                key={`activity-${activity.id}`}
                                transform={`translate(${centroid[0]}, ${centroid[1]})`}
                                onClick={(e) => { e.stopPropagation(); onMapActivityClick(activity.id); }}
                                className="cursor-pointer"
                                style={{ animation: 'bob 2s ease-in-out infinite' }}
                            >
                                <circle r="16" fill="rgba(0,0,0,0.7)" />
                                <text textAnchor="middle" dy=".35em" fontSize="20">{icon}</text>
                                <circle r="16" fill="transparent" stroke={color} strokeWidth="2" filter="url(#activity-glow)" />
                            </g>
                        )
                    })}
                </g>
             </svg>
             <style>{`
                @keyframes bob {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                @keyframes pulse-border {
                    0%, 100% { stroke-width: 2; stroke-opacity: 1; }
                    50% { stroke-width: 4; stroke-opacity: 0.7; }
                }
                .pulsing-attack-border {
                    animation: pulse-border 1.5s ease-in-out infinite;
                }
                @keyframes move-dashes {
                    from { stroke-dashoffset: 24; }
                    to { stroke-dashoffset: 0; }
                }
                .transport-line {
                    animation: move-dashes 1s linear infinite;
                }
             `}</style>
        </div>
    </div>
  );
};