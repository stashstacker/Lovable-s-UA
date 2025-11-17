

import React, { useState, useCallback, useEffect } from 'react';
import { App } from './App';
import { HomeScreen } from './components/HomeScreen';
import { MapEditorApp } from './MapEditorApp';
import { GameState, ScenarioGenerationResult, FullInitialScenario, Ward, District, GangMember, Faction, PotentialRecruit, Mastermind, MastermindClass, NarrativeTemplate, Lieutenant } from './types';
import { INITIAL_HQ_UPGRADES, INITIAL_WORLD_EVENTS } from './constants';
import { generateProceduralMap } from './services/localAutomations';
import { generateMapBackground } from './services/gemini';

const getTier = (totalEarnings: number): number => {
    const TIER_THRESHOLDS = [0, 250000, 1000000, 10000000, 50000000];
    for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalEarnings >= TIER_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
};

const SAVE_GAME_KEY = 'underworldAscendantSave';

// This reviver is used with JSON.parse to automatically convert ISO date strings back into Date objects.
const dateReviver = (key: string, value: any) => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
        return new Date(value);
    }
    return value;
};

export const Root: React.FC = () => {
    const [mode, setMode] = useState<'home' | 'game' | 'editor'>('home');
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [hasSaveGame, setHasSaveGame] = useState(false);

    useEffect(() => {
        // On initial mount, check if a save game exists to enable the 'Load Game' button.
        try {
            const savedGame = localStorage.getItem(SAVE_GAME_KEY);
            setHasSaveGame(!!savedGame);
        } catch (e) {
            console.error("Could not access localStorage:", e);
            setHasSaveGame(false);
        }
    }, []);

    const handleSaveGame = (currentState: GameState | null) => {
        if (!currentState) return;
        try {
            // Date objects are automatically converted to ISO strings by JSON.stringify.
            const jsonString = JSON.stringify(currentState);
            localStorage.setItem(SAVE_GAME_KEY, jsonString);
            setHasSaveGame(true);
        } catch (e) {
            console.error("Failed to save game state:", e);
        }
    };

    const handleLoadGame = () => {
        try {
            const savedGame = localStorage.getItem(SAVE_GAME_KEY);
            if (savedGame) {
                const loadedState: GameState = JSON.parse(savedGame, dateReviver);
                setGameState(loadedState);
                setMode('game');
            }
        } catch (e) {
            console.error("Failed to load game state:", e);
            // If loading fails, clear the corrupted save file.
            localStorage.removeItem(SAVE_GAME_KEY);
            setHasSaveGame(false);
        }
    };


    const handleStartGame = useCallback(async (result: ScenarioGenerationResult, selectedClass: MastermindClass) => {
        const { scenario, usage } = result;
        const districtIdMap = new Map<string, number>();
        let districtCounter = 1;

        const newWards: Ward[] = scenario.cityMap.wards.map(wardData => {
            const newDistricts: District[] = wardData.districts.map(d => {
                const newId = districtCounter++;
                districtIdMap.set(d.id, newId);
                return {
                    id: newId,
                    name: d.name,
                    type: d.type as District['type'],
                    controlledBy: d.initialController,
                    heat: 20,
                    resource: d.coreResources[0]?.resource || 'General Goods',
                    baseIncome: d.strategicValue * 100,
                    playerInfluence: 0,
                    fortification: 0,
                    strategicValue: d.strategicValue,
                    landmark: d.landmarks[0] ? { name: d.landmarks[0].name, description: d.landmarks[0].effectHint, effect: d.landmarks[0].effect } : undefined,
                    hideoutModules: [],
                };
            });
            return {
                id: wardData.id,
                name: wardData.name,
                districts: newDistricts
            };
        });

        const capSkills = (skills: GangMember['skills']): GangMember['skills'] => ({
            combat: Math.min(10, skills.combat),
            cunning: Math.min(10, skills.cunning),
            influence: Math.min(10, skills.influence),
            logistics: Math.min(10, skills.logistics),
            production: Math.min(10, skills.production),
        });

        const newGangMembers: GangMember[] = scenario.startingCrew.map((member, index) => ({
            ...member,
            id: index + 1,
            loyalty: 90,
            status: 'Idle',
            skills: capSkills(member.skills),
        }));

        const RIVAL_COLORS = ['bg-red-700', 'bg-blue-700', 'bg-purple-700', 'bg-amber-600', 'bg-teal-700', 'bg-pink-700', 'bg-indigo-700', 'bg-lime-600'];
        const rivalFactionsWithColor = scenario.factions.map((rf, index) => ({
            ...rf,
            color: RIVAL_COLORS[index % RIVAL_COLORS.length],
        }));

        const allFactions: Faction[] = [
            { id: 'player', name: 'Your Syndicate', color: 'bg-green-700' },
            { id: 'neutral', name: 'Uncontested', color: 'bg-gray-700' },
            ...rivalFactionsWithColor
        ];
        
        const initialTier = getTier(scenario.startingCash);
        
        const districtRecruitPools = scenario.recruitmentPools.reduce((acc, pool) => {
            const clientSideId = districtIdMap.get(pool.districtId);
            if (clientSideId) {
                acc[clientSideId] = pool.recruits.map(recruit => {
                    const cappedSkills = capSkills(recruit.skills);
                    const totalSkills = Object.values(cappedSkills).reduce((sum, val) => sum + Number(val), 0);
                    const rarityMultiplier = { common: 1, uncommon: 1.5, rare: 2.5 }[recruit.rarity] || 1;
                    const hiringFee = Math.round((totalSkills * 150 + Math.random() * 2000) * rarityMultiplier);
                    return { ...recruit, skills: cappedSkills, hiringFee };
                });
            }
            return acc;
        }, {} as Record<number, PotentialRecruit[]>);

        const cappedLieutenants: Lieutenant[] = scenario.lieutenants.map(lt => ({
            ...lt,
            skills: capSkills(lt.skills),
        }));

        const initialMastermind: Mastermind = {
            class: selectedClass,
            xp: 0,
            level: 1,
            attributes: {
                strength: 5,
                cunning: 5,
                charisma: 5,
            },
            skillPoints: 1,
            unlockedSkills: [],
            focus: 100,
            maxFocus: 100,
        };

        const narrativeTemplate = (scenario.worldState.template as NarrativeTemplate) || 'Classic Noir-Steampunk';

        const baseGameState: Omit<GameState, 'mapConnections' | 'mapBackgroundUrl'> = {
            cash: scenario.startingCash,
            heat: scenario.startingHeat,
            cashFlow: 0,
            heatTrend: 0,
            wards: newWards,
            gangMembers: newGangMembers,
            hqUpgrades: INITIAL_HQ_UPGRADES.map(u => ({...u, owned: false})),
            factions: allFactions,
            worldEvents: INITIAL_WORLD_EVENTS,
            highHeatDuration: 0,
            storyline: scenario.narrative.threeActs[0].summary,
            rivalFactions: rivalFactionsWithColor,
            rivalOperations: [],
            potentialRecruits: {},
            districtRecruitPools: districtRecruitPools,
            totalEarnings: scenario.startingCash,
            tier: initialTier,
            investigationProgress: 0,
            transactionLog: [],
            eventLog: [],
            activeWardBonuses: [],
            mapActivities: [],
            narrative: scenario.narrative,
            narrativeTemplate: narrativeTemplate,
            economicClimate: scenario.economicClimate,
            lieutenants: cappedLieutenants,
            currentAct: 0,
            hqMoonshine: 0,
            districtMoonshine: {},
            lastTokenUsage: usage,
            mastermind: initialMastermind,
            hqActionCooldowns: {},
            activeHqBuffs: [],
        };

        const { enrichedWards, connections } = await generateProceduralMap(baseGameState.wards);
        
        const backgroundUrl = usage 
            ? await generateMapBackground(narrativeTemplate) 
            : 'https://images.unsplash.com/photo-1519818187425-8e35f71e2b28?q=80&w=1974&auto=format=fit=crop';

        const finalGameState: GameState = {
          ...baseGameState,
          wards: enrichedWards,
          mapConnections: connections,
          mapBackgroundUrl: backgroundUrl,
        };

        setGameState(finalGameState);
        handleSaveGame(finalGameState); // Save the game immediately on start
        setMode('game');
    }, []);

    const handleStartEditor = () => {
        setMode('editor');
    };

    const handleExit = () => {
        setGameState(null);
        setMode('home');
    };

    if (mode === 'game' && gameState) {
        return <App initialGameState={gameState} onExitGame={handleExit} onSaveGame={handleSaveGame} />;
    }

    if (mode === 'editor') {
        return <MapEditorApp onExit={handleExit} />;
    }

    return <HomeScreen onStartGame={handleStartGame} onStartEditor={handleStartEditor} onLoadGame={handleLoadGame} hasSaveGame={hasSaveGame} />;
};
