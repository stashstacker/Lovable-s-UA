
import React, { useState } from 'react';
import { Button } from './Button';
import { ScenarioGenerationResult, GameMode, NarrativeTemplate, ScenarioOptions, FullInitialScenario, MastermindClass } from '../types';
import { BACKGROUND_IMAGE_URL } from '../constants';
import { BookIcon, SwordsIcon, SlidersIcon, MapIcon, UploadIcon } from './icons';
import { generateInitialScenario } from '../services/gemini';

interface HomeScreenProps {
  onStartGame: (result: ScenarioGenerationResult, selectedClass: MastermindClass) => void;
  onStartEditor: () => void;
  onLoadGame: () => void;
  hasSaveGame: boolean;
}

const NARRATIVE_TEMPLATES: NarrativeTemplate[] = ['Classic Noir-Steampunk', 'Cyberpunk Yakuza', 'Gritty Cartel War'];

const Slider: React.FC<{ label: string, value: number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, min: number, max: number, step?: number, helpText?: string, displaySuffix?: string }> = 
({ label, value, onChange, min, max, step = 1, helpText, displaySuffix = '' }) => (
    <div className="text-left mb-4">
        <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-300">{label}</label>
            <span className="text-sm font-mono text-yellow-300">{value}{displaySuffix}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={onChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-thumb"
        />
        {helpText && <p className="text-xs text-gray-500 mt-1">{helpText}</p>}
        <style>{`
            .range-thumb::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                background: #f59e0b; /* yellow-500 */
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #1f2937; /* gray-800 */
            }
            .range-thumb::-moz-range-thumb {
                width: 16px;
                height: 16px;
                background: #f59e0b;
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid #1f2937;
            }
        `}</style>
    </div>
);

const QuickStartButton: React.FC<{ label: string; description: string; color: string; onClick: () => void }> = ({ label, description, color, onClick }) => (
    <button onClick={onClick} className="text-left w-full p-3 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-yellow-500 transition-colors">
        <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${color}`}></div>
            <div>
                <p className="font-semibold text-yellow-100">{label}</p>
                <p className="text-xs text-gray-400">{description}</p>
            </div>
        </div>
    </button>
);


export const HomeScreen: React.FC<HomeScreenProps> = ({ onStartGame, onStartEditor, onLoadGame, hasSaveGame }) => {
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Game Setup State
  const [gameMode, setGameMode] = useState<GameMode>('Campaign');
  const [narrativeTemplate, setNarrativeTemplate] = useState<NarrativeTemplate>('Classic Noir-Steampunk');
  const [districts, setDistricts] = useState(12);
  const [rivalFactions, setRivalFactions] = useState(6);

  // Advanced Config State
  const [difficulty, setDifficulty] = useState(3);
  const [economicVolatility, setEconomicVolatility] = useState(50);
  const [rivalAggression, setRivalAggression] = useState(50);
  const [dynamicEvents, setDynamicEvents] = useState(70);
  const [permadeath, setPermadeath] = useState(false);
  const [autoSave, setAutoSave] = useState(true);

  const setQuickStart = (type: 'Casual' | 'Balanced' | 'Hardcore') => {
      if (type === 'Casual') {
          setDifficulty(2);
          setEconomicVolatility(25);
          setRivalAggression(30);
          setDynamicEvents(50);
      } else if (type === 'Balanced') {
          setDifficulty(3);
          setEconomicVolatility(50);
          setRivalAggression(50);
          setDynamicEvents(70);
      } else { // Hardcore
          setDifficulty(5);
          setEconomicVolatility(80);
          setRivalAggression(85);
          setDynamicEvents(90);
          setPermadeath(true);
      }
  };

  const handleBeginCampaign = async () => {
    setError(null);
    
    const classes: MastermindClass[] = ['Warlord', 'Spymaster', 'Industrialist'];
    const randomClass = classes[Math.floor(Math.random() * classes.length)];

    const options: ScenarioOptions = {
        gameMode, narrativeTemplate, difficulty, districts, rivalFactions,
        economicVolatility, rivalAggression, dynamicEvents, permadeath
    };
    
    try {
      setLoadingMessage(`Destiny has chosen your path... you are a ${randomClass}. The Fates are weaving your story...`);
      const result = await generateInitialScenario(options);
      onStartGame(result, randomClass);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setLoadingMessage(null);
    }
  };

  const handleMockLaunch = () => {
    const classes: MastermindClass[] = ['Warlord', 'Spymaster', 'Industrialist'];
    const randomClass = classes[Math.floor(Math.random() * classes.length)];

    const mockScenario: FullInitialScenario = {
        worldState: { seed: 12345, template: "Mock Data", generatorVersion: "0.1.0", timestamp: new Date().toISOString() },
        narrative: {
            threeActs: [{ act: "incipit", summary: "A quick start for development and testing purposes.", triggers: [] }],
            primaryAntagonist: { id: "mock_antagonist", name: "The Placeholder", motivation: "To facilitate testing.", strengths: [], weaknesses: [] },
            branchPoints: []
        },
        cityMap: {
            wards: [{
                id: "mock_ward_1", name: "Test Ward Central", districts: [
                    { id: "d1", name: "Player District A", theme: "Industrial", type: "Industrial", initialController: "player", strategicValue: 50, coreResources: [], landmarks: [] },
                    { id: "d2", name: "Neutral District B", theme: "Residential", type: "Residential", initialController: "neutral", strategicValue: 30, coreResources: [], landmarks: [] },
                    { id: "d3", name: "Rival District C", theme: "Financial", type: "Financial", initialController: "mock_rivals", strategicValue: 70, coreResources: [], landmarks: [] }
                ]
            }],
            strategicLocations: []
        },
        factions: [{
            id: "mock_rivals", name: "The Mock Gang", description: "A rival faction for testing.", persona: "Aggressive", preferredOps: [], strengths: [], weaknesses: [],
            startingRelations: [{ factionId: "player", relation: "hostile" }],
            initialTerritories: ["d3"],
            aiProfile: { expansionism: 0.8, covertOps: 0.2, influenceFocus: 0.5 },
            cash: 20000,
            strategy: 'Aggressive',
            heat: 20,
            color: 'bg-red-700'
        }],
        recruitmentPools: [],
        lieutenants: [],
        economicClimate: {
            description: "Stable and predictable for testing.", basePrices: [], supplyDemand: [], volatility: 0, notableOpportunities: []
        },
        startingCash: 50000,
        startingHeat: 15,
        startingCrew: [
            { name: "Bobby Tables", role: "Tester", skills: { combat: 7, cunning: 4, influence: 3, logistics: 5, production: 2 } },
            { name: "Samantha Swift", role: "QA Lead", skills: { combat: 3, cunning: 6, influence: 8, logistics: 4, production: 1 } }
        ]
    };
    const mockResult: ScenarioGenerationResult = {
        scenario: mockScenario
    };
    onStartGame(mockResult, randomClass);
  };

  return (
    <div className="bg-[#1a1a1a] text-gray-200 min-h-screen flex flex-col items-center justify-center p-4 selection:bg-yellow-500 selection:text-black">
        <div 
            className="fixed inset-0 bg-cover bg-center opacity-20" 
            style={{backgroundImage: `url('${BACKGROUND_IMAGE_URL}')`}}
        ></div>
        <div className="relative z-10 text-center w-full max-w-4xl">
            <h1 className="font-title text-4xl md:text-6xl text-yellow-200 tracking-wider mb-2">
                Underworld Ascendant
            </h1>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
                Forge your criminal empire in a city of gears and shadows.
            </p>
            
            {loadingMessage ? (
                 <div className="bg-black/50 backdrop-blur-md p-8 md:p-12 rounded-xl border-2 border-yellow-800/50 shadow-2xl">
                    <p className="animate-pulse text-yellow-300 text-xl">{loadingMessage}</p>
                 </div>
            ) : (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Campaign Mode */}
                    <div onClick={() => setGameMode('Campaign')} className={`p-6 bg-black/60 backdrop-blur-sm rounded-lg border-2 transition-all cursor-pointer ${gameMode === 'Campaign' ? 'border-yellow-500' : 'border-gray-700/50 hover:border-yellow-700/50'}`}>
                        <div className="flex items-center space-x-3 mb-3">
                            <BookIcon className="w-6 h-6 text-yellow-300"/>
                            <h2 className="font-title text-xl text-yellow-200">Campaign Mode</h2>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">Experience a rich narrative journey with dynamic storylines and evolving challenges.</p>
                        <div className="text-left">
                            <label htmlFor="narrative-template" className="block text-sm font-medium text-gray-300 mb-2">Narrative Template</label>
                            <select id="narrative-template" value={narrativeTemplate} onChange={e => setNarrativeTemplate(e.target.value as NarrativeTemplate)} className="w-full bg-gray-900/70 border border-gray-600 rounded-md px-3 py-2 text-sm focus:ring-yellow-500 focus:border-yellow-500">
                                {NARRATIVE_TEMPLATES.map(t => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="mt-4">
                            <Slider label="Districts" value={districts} onChange={e => setDistricts(parseInt(e.target.value))} min={8} max={100} />
                            <Slider label="Rival Factions" value={rivalFactions} onChange={e => setRivalFactions(parseInt(e.target.value))} min={2} max={8} />
                        </div>
                    </div>

                    {/* Skirmish Mode */}
                    <div onClick={() => setGameMode('Skirmish')} className={`p-6 bg-black/60 backdrop-blur-sm rounded-lg border-2 transition-all cursor-pointer ${gameMode === 'Skirmish' ? 'border-yellow-500' : 'border-gray-700/50 hover:border-yellow-700/50'}`}>
                        <div className="flex items-center space-x-3 mb-3">
                            <SwordsIcon className="w-6 h-6 text-yellow-300"/>
                            <h2 className="font-title text-xl text-yellow-200">Skirmish Mode</h2>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">Jump straight into empire management with customizable world settings and immediate action.</p>
                        <div className="space-y-2">
                           <h3 className="text-left text-sm font-medium text-gray-300 mb-2">Quick Start Options</h3>
                           <QuickStartButton label="Casual" description="Easy start with forgiving opponents" color="bg-green-500" onClick={() => setQuickStart('Casual')} />
                           <QuickStartButton label="Balanced" description="Standard challenge level" color="bg-yellow-500" onClick={() => setQuickStart('Balanced')} />
                           <QuickStartButton label="Hardcore" description="Brutal competition and volatility" color="bg-red-500" onClick={() => setQuickStart('Hardcore')} />
                        </div>
                         <div className="mt-4 text-xs text-yellow-200/70 bg-yellow-900/30 p-2 rounded-md">
                           💡 <span className="font-semibold">Tip:</span> Skirmish mode is perfect for learning the game mechanics or testing different strategies without narrative constraints.
                        </div>
                    </div>
                </div>

                {/* Advanced Config */}
                <div className="p-6 bg-black/60 backdrop-blur-sm rounded-lg border-2 border-gray-700/50">
                    <div className="flex items-center space-x-3 mb-3">
                        <SlidersIcon className="w-6 h-6 text-yellow-300"/>
                        <h2 className="font-title text-xl text-yellow-200">Advanced Configuration</h2>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">Fine-tune your game experience with detailed settings.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <div>
                             <Slider label="Difficulty Level" value={difficulty} onChange={e => setDifficulty(parseInt(e.target.value))} min={1} max={5} helpText="Higher difficulty increases costs, rival aggression, and heat generation." />
                             <Slider label="Economic Volatility" value={economicVolatility} onChange={e => setEconomicVolatility(parseInt(e.target.value))} min={0} max={100} displaySuffix="%" helpText="How frequently prices and opportunities change in the market." />
                        </div>
                        <div>
                             <Slider label="Rival Aggression" value={rivalAggression} onChange={e => setRivalAggression(parseInt(e.target.value))} min={0} max={100} displaySuffix="%" helpText="How aggressively rival factions compete for territory." />
                             <Slider label="Dynamic Events" value={dynamicEvents} onChange={e => setDynamicEvents(parseInt(e.target.value))} min={0} max={100} displaySuffix="%" helpText="Frequency of random world events and opportunities." />
                        </div>
                    </div>
                     <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={permadeath} onChange={e => setPermadeath(e.target.checked)} className="w-4 h-4 bg-gray-700 border-gray-600 text-yellow-600 focus:ring-yellow-500 rounded" />
                            <span>Enable Permadeath (Hardcore Mode)</span>
                        </label>
                         <label className="flex items-center space-x-2 cursor-pointer">
                            <input type="checkbox" checked={autoSave} onChange={e => setAutoSave(e.target.checked)} className="w-4 h-4 bg-gray-700 border-gray-600 text-yellow-600 focus:ring-yellow-500 rounded" />
                            <span>Enable Auto-Save</span>
                        </label>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                     <Button 
                        onClick={handleBeginCampaign} 
                        className="px-6 py-3 text-lg col-span-2 md:col-span-1"
                    >
                        Begin {gameMode}
                    </Button>
                    <Button variant="secondary" className="px-6 py-3 text-lg" disabled={!hasSaveGame} onClick={onLoadGame}>
                        <div className="flex items-center justify-center space-x-2">
                            <UploadIcon className="w-5 h-5" />
                            <span>Load Game</span>
                        </div>
                    </Button>
                    <Button variant="secondary" className="px-6 py-3 text-lg" onClick={handleMockLaunch}>
                        Quick Launch
                    </Button>
                     <Button variant="secondary" className="px-6 py-3 text-lg" onClick={onStartEditor}>
                        <div className="flex items-center justify-center space-x-2">
                           <MapIcon className="w-5 h-5" />
                           <span>Map Editor</span>
                        </div>
                    </Button>
                </div>
            </div>
            )}
            
            {error && (
                <div className="mt-6 text-red-400 bg-red-900/50 p-3 rounded-lg max-w-2xl mx-auto">
                    <p className="font-semibold">A dark omen...</p>
                    <p>{error}</p>
                </div>
            )}
        </div>
        <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
};
