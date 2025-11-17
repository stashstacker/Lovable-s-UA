import React, { useState, useMemo } from 'react';
import { MusclesData, KMeansIterationData } from '../services/localAutomations/musclesGenerationService';
import { TargetIcon } from './icons';

interface MusclesViewProps {
  musclesData: MusclesData | null;
  animationData: KMeansIterationData | null;
  showSupplyLines: boolean;
  showPois: boolean;
}

const getFactionFill = (id: string | number): string => {
    const seed = String(id).split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    const h = seed % 360;
    const s = 70 + (seed % 10);
    const l = 40 + (seed % 10);
    return `hsl(${h}, ${s}%, ${l}%)`;
};

export const MusclesView: React.FC<MusclesViewProps> = ({ musclesData, animationData, showSupplyLines, showPois }) => {
    const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
    const viewMode = selectedWardId ? 'City' : 'World';

    const wards = musclesData?.wards || [];
    const districts = musclesData ? wards.flatMap(w => w.districts) : [];
    const supplyLines = musclesData?.supplyLines || [];
    const pois = musclesData?.pois || [];
    
    const wardCentroids = useMemo(() => {
        if (!musclesData) return new Map();
        return new Map(musclesData.wards.map(w => [w.id, w.centroid]));
    }, [musclesData]);

    const districtCentroids = useMemo(() => {
        if (!musclesData) return new Map();
        const allDistricts = musclesData.wards.flatMap(w => w.districts);
        return new Map(allDistricts.map(d => [d.id, d.centroid]));
    }, [musclesData]);

    const renderContent = () => {
        const renderData = musclesData || animationData?.muscles;
        if (!renderData) return null;

        const currentCentroids = animationData?.centroids || [];

        return (
            <>
                {/* Layer 1: Base Terrain (Land/Water) */}
                <g id="terrain-base">
                    {renderData.terrain.cells.map((cell) => {
                        const color = cell.terrainType === 'WATER' ? '#2c3e50' : '#4a5568'; // Dark blue for water, gray for land
                        return (
                            <path
                                key={`terrain-${cell.id}`}
                                d={cell.path}
                                fill={color}
                                stroke={color}
                                strokeWidth="0.5" // Small stroke to cover anti-aliasing seams
                            />
                        );
                    })}
                </g>

                {/* Layer 2: Animated Cells or Final Districts */}
                {animationData ? (
                    <g id="animated-cells">
                        {renderData.terrain.cells.map((cell) => {
                            const districtId = animationData.cellToDistrictMap.get(cell.id);
                            if (districtId === undefined || cell.terrainType === 'WATER') return null;
                            const fill = getFactionFill(districtId);
                            return (
                                <path
                                    key={`anim-cell-${cell.id}`}
                                    d={cell.path}
                                    fill={fill}
                                    stroke={fill}
                                    strokeWidth="1"
                                    style={{ transition: 'fill 0.2s ease-in-out' }}
                                />
                            );
                        })}
                    </g>
                ) : viewMode === 'World' ? (
                     <g id="wards-filled">
                        {wards.map(ward => {
                            const fill = getFactionFill(ward.id);
                            return (
                                <path
                                    key={`ward-fill-${ward.id}`}
                                    d={ward.svgPath}
                                    fill={fill}
                                    stroke={fill}
                                    strokeWidth="1"
                                    onClick={(e) => { e.stopPropagation(); setSelectedWardId(ward.id); }}
                                    className="cursor-pointer"
                                    opacity="0.7"
                                />
                            );
                        })}
                    </g>
                ) : (
                    <>
                        <g id="districts-filled">
                            {districts.map(district => {
                                const parentWard = wards.find(w => w.districts.some(d => d.id === district.id));
                                if (parentWard?.id !== selectedWardId) return null;
                                const fill = getFactionFill(district.id);
                                return (
                                    <path
                                        key={`dist-fill-${district.id}`}
                                        d={district.svgPath}
                                        fill={fill}
                                        stroke={fill}
                                        strokeWidth="1"
                                        opacity="0.8"
                                    />
                                );
                            })}
                        </g>
                         <g id="other-wards-dimmed" opacity="0.3">
                            {wards.filter(w => w.id !== selectedWardId).map(ward => (
                                <path
                                    key={`ward-dim-${ward.id}`}
                                    d={ward.svgPath}
                                    fill="#111"
                                    onClick={(e) => { e.stopPropagation(); setSelectedWardId(ward.id); }}
                                    className="cursor-pointer"
                                />
                            ))}
                        </g>
                    </>
                )}
                
                {/* Overlays */}
                {showSupplyLines && musclesData && (
                     <g id="supply-lines" pointerEvents="none">
                        {supplyLines.map(([ward1Id, ward2Id], i) => {
                            const p1 = wardCentroids.get(ward1Id);
                            const p2 = wardCentroids.get(ward2Id);
                            if (!p1 || !p2) return null;
                            return (
                                <line 
                                    key={`line-${i}`}
                                    x1={p1[0]} y1={p1[1]}
                                    x2={p2[0]} y2={p2[1]}
                                    stroke="#f59e0b"
                                    strokeWidth="1.5"
                                    strokeDasharray="4 2"
                                    opacity="0.8"
                                />
                            )
                        })}
                    </g>
                )}

                {showPois && musclesData && (
                     <g id="pois" pointerEvents="none">
                        {pois.map(poi => {
                            const districtCentroid = districtCentroids.get(poi.districtId);
                            if (!districtCentroid) return null;
                            const parentWard = wards.find(w => w.districts.some(d => d.id === poi.districtId));
                            if (viewMode === 'City' && parentWard?.id !== selectedWardId) return null;

                            return (
                                <g key={poi.id} transform={`translate(${districtCentroid[0]}, ${districtCentroid[1]})`}>
                                   <title>{`${poi.type} in District ${poi.districtId}`}</title>
                                    <TargetIcon className="text-yellow-300 opacity-80" style={{ filter: 'drop-shadow(0 0 3px black)'}} />
                                </g>
                            )
                        })}
                    </g>
                )}
                
                {viewMode === 'City' ? (
                    <g id="district-borders">
                        {districts.filter(d => wards.some(w => w.id === selectedWardId && w.districts.some(wd => wd.id === d.id))).map(district => (
                            <path key={`dist-border-${district.id}`} d={district.svgPath} fill="none" stroke="white" strokeWidth="0.5" />
                        ))}
                    </g>
                ) : (
                     <g id="ward-borders">
                        {wards.map(ward => (
                            <path key={`ward-border-${ward.id}`} d={ward.svgPath} fill="none" stroke="white" strokeWidth="1" />
                        ))}
                    </g>
                )}

                {animationData && (
                    <g id="animating-centroids">
                        {currentCentroids.map(c => (
                            <circle
                                key={`centroid-${c.id}`}
                                cx={c.x}
                                cy={c.y}
                                r="5"
                                fill={getFactionFill(c.id)}
                                stroke="white"
                                strokeWidth="1.5"
                                style={{ transition: 'cx 0.2s ease-in-out, cy 0.2s ease-in-out' }}
                            />
                        ))}
                    </g>
                )}
            </>
        )
    };

    return (
        <div className="w-full h-full bg-black">
            <svg viewBox="0 0 1000 750" className="w-full h-full" onClick={() => setSelectedWardId(null)}>
                {renderContent()}
            </svg>
        </div>
    );
};