import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from './components/Button';
import { generateSkeleton, SkeletonData } from './services/localAutomations/skeletonGenerationService';
import { generateMuscles, MusclesData, KMeansIterationData } from './services/localAutomations/musclesGenerationService';
import { SkeletonView } from './components/SkeletonView';
import { MusclesView } from './components/MusclesView';
import { HomeIcon, SlidersIcon, SaveIcon, UploadIcon } from './components/icons';

interface MapEditorAppProps {
    onExit: () => void;
}

const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void; }> = ({ label, checked, onChange }) => (
    <label className="flex items-center space-x-2 cursor-pointer text-sm text-gray-300">
        <input 
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 bg-gray-700 border-gray-600 text-yellow-600 focus:ring-yellow-500 rounded"
        />
        <span>{label}</span>
    </label>
);

export const MapEditorApp: React.FC<MapEditorAppProps> = ({ onExit }) => {
    const [skeleton, setSkeleton] = useState<SkeletonData | null>(null);
    const [muscles, setMuscles] = useState<MusclesData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generationTime, setGenerationTime] = useState<number | null>(null);
    const [progressMessage, setProgressMessage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Animation state
    const [animatingData, setAnimatingData] = useState<KMeansIterationData | null>(null);
    const iterationQueue = useRef<KMeansIterationData[]>([]);
    const animationFrameId = useRef<number | null>(null);
    const [animationSpeed, setAnimationSpeed] = useState(100); // ms per frame

    // Layer visibility state
    const [showPoints, setShowPoints] = useState(true);
    const [showTriangulation, setShowTriangulation] = useState(true);
    const [showCells, setShowCells] = useState(false);
    const [showSupplyLines, setShowSupplyLines] = useState(true);
    const [showPois, setShowPois] = useState(true);

    const processAnimationQueue = useCallback(() => {
        if (iterationQueue.current.length > 0) {
            const nextFrame = iterationQueue.current.shift();
            setAnimatingData(nextFrame);
            animationFrameId.current = window.setTimeout(processAnimationQueue, animationSpeed);
        } else {
            animationFrameId.current = null;
        }
    }, [animationSpeed]);

    useEffect(() => {
        return () => {
            if (animationFrameId.current) {
                window.clearTimeout(animationFrameId.current);
            }
        };
    }, []);

    const handleGenerateSkeleton = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setSkeleton(null);
        setMuscles(null);
        setAnimatingData(null);
        iterationQueue.current = [];
        setGenerationTime(null);
        setProgressMessage('Generating geometric skeleton...');

        try {
            const { data, duration } = await generateSkeleton(12000);
            setSkeleton(data);
            setGenerationTime(duration);
            setProgressMessage('Skeleton generated.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleGenerateMuscles = useCallback(async () => {
        if (!skeleton) {
            setError('A skeleton must be generated first.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setMuscles(null);
        setAnimatingData(null);
        iterationQueue.current = [];
        setGenerationTime(null);
        
        try {
            const { duration } = await generateMuscles(
                { numWards: 20, numDistricts: 300 },
                skeleton,
                (progress) => {
                    if (progress.type === 'status') {
                        setProgressMessage(progress.message);
                    } else if (progress.type === 'iteration') {
                        iterationQueue.current.push(progress);
                        if (!animationFrameId.current) {
                            processAnimationQueue();
                        }
                    } else if (progress.type === 'complete') {
                        setMuscles(progress.data);
                        setProgressMessage('Generation Complete!');
                        if (animationFrameId.current) {
                            window.clearTimeout(animationFrameId.current);
                            animationFrameId.current = null;
                        }
                        iterationQueue.current = [];
                        setAnimatingData(null);
                    }
                }
            );
            setGenerationTime(duration);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    }, [skeleton, processAnimationQueue]);


    const handleSaveSeed = () => {
        if (!muscles) return;
        const dataStr = JSON.stringify(muscles);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `underworld-map-seed-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleLoadSeed = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    const data = JSON.parse(text) as MusclesData;
                    if (data.wards && data.terrain) {
                        setMuscles(data);
                        setSkeleton(null); // Loaded muscles don't have a separate skeleton
                        setAnimatingData(null);
                        iterationQueue.current = [];
                        setIsLoading(false);
                        setError(null);
                        setProgressMessage('Loaded map from seed file.');
                    } else {
                        throw new Error("Invalid seed file format.");
                    }
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to parse seed file.");
            }
        };
        reader.readAsText(file);
    };
    
    const renderMainView = () => {
        if (muscles || animatingData) {
            return (
                 <MusclesView 
                    musclesData={muscles}
                    animationData={animatingData}
                    showSupplyLines={showSupplyLines}
                    showPois={showPois}
                />
            );
        }
        if (skeleton) {
            return (
                <SkeletonView 
                    skeleton={skeleton}
                    showPoints={showPoints}
                    showTriangulation={showTriangulation}
                    showCells={showCells}
                />
            );
        }
        return <p className="text-gray-500">Click "Generate New Skeleton" to build the world.</p>;
    };

    return (
        <div className="bg-[#1a1a1a] text-gray-200 min-h-screen p-4 flex flex-col">
            <header className="flex-shrink-0 flex justify-between items-center mb-4 pb-2 border-b-2 border-yellow-700/50">
                <h1 className="font-title text-3xl text-yellow-200">Map Editor</h1>
                <div className="flex space-x-4">
                    <Button onClick={onExit} variant="secondary">
                        <div className="flex items-center space-x-2">
                           <HomeIcon className="w-5 h-5"/>
                           <span>Back to Home</span>
                        </div>
                    </Button>
                </div>
            </header>
            <div className="flex-grow flex gap-4">
                <aside className="w-64 flex-shrink-0 bg-black/30 border border-gray-700 rounded-md p-3">
                    <h2 className="font-title text-xl text-yellow-300 flex items-center space-x-2 border-b border-yellow-700/50 pb-2 mb-3">
                        <SlidersIcon className="w-5 h-5"/>
                        <span>Controls</span>
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <h3 className="font-semibold text-gray-400 text-sm mb-2">Generation Steps</h3>
                            <div className="space-y-2">
                                <Button onClick={handleGenerateSkeleton} disabled={isLoading} size="sm" className="w-full">
                                    {isLoading && progressMessage.includes('skeleton') ? 'Generating...' : '1. Generate New Skeleton'}
                                </Button>
                                <Button onClick={handleGenerateMuscles} disabled={!skeleton || isLoading} size="sm" className="w-full">
                                     {isLoading && !progressMessage.includes('skeleton') ? 'Generating...' : '2. Generate Muscles'}
                                </Button>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-400 text-sm mb-2">Seed Management</h3>
                            <div className="space-y-2">
                                <Button onClick={handleSaveSeed} disabled={!muscles || isLoading} size="sm" className="w-full">
                                    <div className="flex items-center justify-center space-x-2"><SaveIcon className="w-4 h-4" /><span>Save Final Map</span></div>
                                </Button>
                                <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm" className="w-full">
                                    <div className="flex items-center justify-center space-x-2"><UploadIcon className="w-4 h-4" /><span>Load Final Map</span></div>
                                </Button>
                                <input type="file" ref={fileInputRef} onChange={handleLoadSeed} accept=".json" className="hidden" />
                            </div>
                        </div>
                         <div>
                            <h3 className="font-semibold text-gray-400 text-sm mb-2">View Options</h3>
                            <div className="space-y-1">
                                <h4 className="font-bold text-xs text-gray-500 uppercase">Skeleton Layers</h4>
                                <Checkbox label="Show Points" checked={showPoints} onChange={setShowPoints} />
                                <Checkbox label="Show Triangulation" checked={showTriangulation} onChange={setShowTriangulation} />
                                <Checkbox label="Show Voronoi Cells" checked={showCells} onChange={setShowCells} />
                                <h4 className="font-bold text-xs text-gray-500 uppercase mt-2">Muscle Layers</h4>
                                <Checkbox label="Show Supply Lines" checked={showSupplyLines} onChange={setShowSupplyLines} />
                                <Checkbox label="Show POIs" checked={showPois} onChange={setShowPois} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400">Animation Speed</label>
                             <input
                                type="range" min="10" max="500" step="10"
                                value={animationSpeed}
                                onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-xs text-gray-500 text-center">{animationSpeed}ms / step</p>
                        </div>
                    </div>

                    {(generationTime !== null || progressMessage) && (
                        <div className="mt-6 pt-4 border-t border-gray-700">
                             <h3 className="font-semibold text-gray-400 text-sm mb-2">Generation Status</h3>
                             <div className="text-xs space-y-1">
                                 <p><span className="text-gray-400">Status: </span><span className="font-mono text-yellow-300">{progressMessage}</span></p>
                                 {generationTime && <p><span className="text-gray-400">Time: </span><span className="font-mono text-cyan-300">{generationTime} ms</span></p>}
                             </div>
                        </div>
                    )}
                     {error && <p className="text-red-400 mt-4 text-xs">{error}</p>}
                </aside>
                <main className="flex-grow flex items-center justify-center bg-black/50 rounded-md border border-gray-700">
                    {isLoading && !animatingData && !skeleton && <p className="text-yellow-300 animate-pulse text-xl">{progressMessage || 'Initializing...'}</p>}
                    {renderMainView()}
                </main>
            </div>
        </div>
    );
};