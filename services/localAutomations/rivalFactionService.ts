

import { GameState, RivalFaction, RivalOperation, District } from '../../types';

interface RivalTurnResult {
    updatedRival: RivalFaction;
    newOperation: RivalOperation | null;
    stimulusApplied?: { amount: number };
}

export const processRivalTurn = (gameState: GameState, rival: RivalFaction, worldTime: Date): RivalTurnResult => {
    // If a city-wide blackout is active, rivals do not take their turns.
    if (gameState.blackoutUntil && worldTime < new Date(gameState.blackoutUntil)) {
        return { updatedRival: rival, newOperation: null };
    }

    let updatedRival = { ...rival };
    let newOperation: RivalOperation | null = null;
    const allDistricts = gameState.wards.flatMap(w => w.districts);
    
    // --- Phase 1: Income, Heat Decay, & Economic Balancing ---
    const rivalDistricts = allDistricts.filter(d => d.controlledBy === rival.id);
    const playerTier = gameState.tier || 1;
    const tierMultiplier = 1 + (playerTier - 1) * 0.25;
    const dailyIncome = rivalDistricts.reduce((sum, d) => sum + d.baseIncome, 0);
    updatedRival.cash += dailyIncome * tierMultiplier;
    updatedRival.heat = Math.max(0, updatedRival.heat - 1); // Passive heat decay each day

    let stimulusApplied: { amount: number } | undefined = undefined;
    
    // "Catch-up" economics for struggling factions
    const getEconomicValue = (cash: number, districts: District[]): number => {
        const territoryValue = districts.reduce((sum, d) => sum + d.strategicValue * 1500, 0);
        return cash + territoryValue;
    };
    const playerDistricts = allDistricts.filter(d => d.controlledBy === 'player');
    const playerValue = getEconomicValue(gameState.cash, playerDistricts);
    const rivalValue = getEconomicValue(updatedRival.cash, rivalDistricts);

    if (rivalValue < playerValue * 0.40) {
        const injection = playerValue * 0.15;
        updatedRival.cash += injection;
        stimulusApplied = { amount: injection };
    }

    // --- Phase 2: Decision Making ---
    const rivalOperations = gameState.rivalOperations.filter(op => op.factionId === rival.id && !op.isResolved);
    if (rivalOperations.length > 0) {
        // Faction is busy, do nothing else this turn.
        return { updatedRival, newOperation, stimulusApplied };
    }
    
    // High heat prevents new operations
    if (updatedRival.heat > 80) {
        return { updatedRival, newOperation: null, stimulusApplied };
    }


    const currentlyTargetedDistrictIds = new Set(
        gameState.rivalOperations.filter(op => !op.isResolved).map(op => op.targetDistrictId)
    );

    // NEW LOGIC: Determine valid targets based on adjacency
    const rivalTerritoryIds = new Set(rivalDistricts.map(d => d.id));
    const adjacentDistrictIds = new Set<number>();
    if (gameState.mapConnections) {
        for (const [id1, id2] of gameState.mapConnections) {
            if (rivalTerritoryIds.has(id1) && !rivalTerritoryIds.has(id2)) {
                adjacentDistrictIds.add(id2);
            }
            if (rivalTerritoryIds.has(id2) && !rivalTerritoryIds.has(id1)) {
                adjacentDistrictIds.add(id1);
            }
        }
    }

    const validTargets = allDistricts.filter(d =>
        adjacentDistrictIds.has(d.id) &&
        (d.controlledBy === 'player' || d.controlledBy === 'neutral') &&
        (!d.takeoverCooldownUntil || new Date(d.takeoverCooldownUntil) <= worldTime) &&
        !currentlyTargetedDistrictIds.has(d.id)
    );

    const availablePlayerDistricts = validTargets.filter(d => d.controlledBy === 'player');
    const availableNeutralDistricts = validTargets.filter(d => d.controlledBy === 'neutral');
    
    const profile = rival.aiProfile;
    const actionRoll = Math.random();
    let actionTaken = false;

    // 1. Decide whether to ATTACK PLAYER
    if (profile.expansionism > actionRoll && availablePlayerDistricts.length > 0) {
        const attackCost = 25000 * tierMultiplier;
        if (updatedRival.cash >= attackCost) {
            // Target player's most valuable, least defended adjacent district
            const targetDistrict = availablePlayerDistricts.sort((a, b) => {
                const totalFortificationA = a.fortification + (a.temporaryFortification?.amount || 0);
                const totalFortificationB = b.fortification + (b.temporaryFortification?.amount || 0);
                const scoreA = a.strategicValue / (totalFortificationA + 1);
                const scoreB = b.strategicValue / (totalFortificationB + 1);
                return scoreB - scoreA;
            })[0];

            if(targetDistrict) {
                updatedRival.cash -= attackCost;
                updatedRival.heat += 20; // Heat for attacking player
                
                const totalFortification = targetDistrict.fortification + (targetDistrict.temporaryFortification?.amount || 0);
                const baseDurationMs = 77 * 60 * 60 * 1000; // ~3.2 days
                const fortificationPenaltyMs = totalFortification * 60 * 60 * 1000; // 1 hour per fortification point

                newOperation = {
                    id: `rival-op-${Date.now()}`,
                    factionId: rival.id,
                    targetDistrictId: targetDistrict.id,
                    type: 'ATTACK_PLAYER',
                    startTime: worldTime,
                    completionTime: new Date(worldTime.getTime() + baseDurationMs + fortificationPenaltyMs),
                    isResolved: false,
                };
                actionTaken = true;
            }
        }
    }
    
    // 2. Decide whether to EXPAND into neutral territory
    if (!actionTaken && (profile.expansionism + profile.influenceFocus) / 2 > actionRoll && availableNeutralDistricts.length > 0) {
        const expansionCost = 15000;
        if (updatedRival.cash >= expansionCost) {
            // Target most valuable adjacent neutral district
            const targetDistrict = availableNeutralDistricts.sort((a, b) => b.strategicValue - a.strategicValue)[0];
            
            if(targetDistrict) {
                updatedRival.cash -= expansionCost;
                updatedRival.heat += 10; // Heat for expanding
                newOperation = {
                    id: `rival-op-${Date.now()}`,
                    factionId: rival.id,
                    targetDistrictId: targetDistrict.id,
                    type: 'EXPAND_NEUTRAL',
                    startTime: worldTime,
                    completionTime: new Date(worldTime.getTime() + 72 * 60 * 60 * 1000), // 3 days
                    isResolved: false,
                };
                actionTaken = true;
            }
        }
    }

    // 3. IDLE: If no action was taken, do nothing else. Income was already handled.

    return { updatedRival, newOperation, stimulusApplied };
};
