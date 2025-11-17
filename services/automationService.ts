
import { GameState, District, GangMember, HqUpgrade, WorldEvent } from '../types';

interface DistrictUpdate {
  districtId: number;
  newHeat?: number;
  newPlayerInfluence?: number;
  newFortification?: number;
  flippedToPlayer?: boolean;
}

interface AutomationResult {
  cashGained: number;
  districtUpdates: DistrictUpdate[];
  updatedMembers: GangMember[];
  updatedWorldEvents: WorldEvent[];
  newHighHeatDuration: number;
  globalIncomeModifier: number;
  heatModifier: number;
}

export const processAutomation = (gameState: GameState, worldTime: Date): AutomationResult => {
  let cashGained = 0;
  const districtUpdates: DistrictUpdate[] = [];
  const districtsMap = new Map<number, District>(gameState.wards.flatMap(w => w.districts).map(d => [d.id, d]));
  const hqUpgradesMap = new Map<number, HqUpgrade>(gameState.hqUpgrades.map(u => [u.id, u]));

  const updatedMembers = JSON.parse(JSON.stringify(gameState.gangMembers)) as GangMember[];
  let updatedWorldEvents = JSON.parse(JSON.stringify(gameState.worldEvents)) as WorldEvent[];
  let newHighHeatDuration = gameState.highHeatDuration;

  // --- Phase 3: World Event Management ---
  // Tick down active events
  for (const event of updatedWorldEvents) {
    if (event.isActive) {
      event.duration -= 1;
      if (event.duration <= 0) {
        event.isActive = false;
      }
    }
  }

  // Trigger new events
  // Police Crackdown
  if (gameState.heat > 80) {
    newHighHeatDuration += 1;
  } else {
    newHighHeatDuration = 0;
  }
  
  const crackdownEvent = updatedWorldEvents.find(e => e.id === 'police_crackdown');
  if (crackdownEvent && !crackdownEvent.isActive && newHighHeatDuration > 48) { // 2 days of high heat
    crackdownEvent.isActive = true;
    crackdownEvent.duration = 120; // 5 days
    newHighHeatDuration = 0; // Reset counter
  }
  
  // Economic Events (check once a week on Sunday midnight)
  if (worldTime.getDay() === 0 && worldTime.getHours() === 0) {
      // Deactivate any existing economic events
      updatedWorldEvents.forEach(e => {
        if (e.id === 'economic_boom' || e.id === 'recession') e.isActive = false;
      });
      // Roll for a new one
      const roll = Math.random();
      if (roll < 0.15) { // 15% chance of a boom
        const boom = updatedWorldEvents.find(e => e.id === 'economic_boom');
        if (boom) {
            boom.isActive = true;
            boom.duration = 168; // 7 days
        }
      } else if (roll < 0.3) { // 15% chance of a recession
        const recession = updatedWorldEvents.find(e => e.id === 'recession');
        if (recession) {
            recession.isActive = true;
            recession.duration = 168; // 7 days
        }
      }
  }

  // Calculate active modifiers
  let globalIncomeModifier = 1;
  let heatModifier = 1;
  const districtIncomeModifiers = new Map<District['type'], number>();

  for (const event of updatedWorldEvents) {
    if (event.isActive) {
        if (event.globalIncomeModifier) globalIncomeModifier *= event.globalIncomeModifier;
        if (event.heatModifier) heatModifier *= event.heatModifier;
        if (event.incomeModifier) {
            districtIncomeModifiers.set(event.incomeModifier.districtType, event.incomeModifier.multiplier);
            // Quick hack for boom/recession applying to more than one district type
            if (event.id === 'economic_boom') districtIncomeModifiers.set('Entertainment', 2);
            if (event.id === 'recession') districtIncomeModifiers.set('Docks', 0.5);
        }
    }
  }


  // --- Phase 1: Passive Healing ---
  for (const member of updatedMembers) {
    if (member.status === 'Wounded' && member.recoveryTime) {
      member.recoveryTime -= 1; // Game loop ticks per hour
      if (member.recoveryTime <= 0) {
        member.status = 'Idle';
        delete member.recoveryTime;
      }
    }
  }

  // --- Base Income from Owned HQ Upgrades ---
  const ownedDistillery = gameState.hqUpgrades.find(u => u.id === 1 && u.owned);
  if (ownedDistillery) {
      cashGained += 2000 / 24; // Daily income broken down by hour
  }

  // --- Process Assignments (Districts, HQ, Training) ---
  for (const member of updatedMembers) {
    if (!member.assignment) continue;

    // --- Phase 3: Skill Training ---
    if (member.assignment.type === 'training') {
        const skill = member.assignment.skill;
        if (member.skills[skill] < 10) { // Skill cap
            member.skills[skill] = parseFloat((member.skills[skill] + 0.01).toFixed(2)); // ~100 hours to gain a point
        }
        continue; // Training members do nothing else
    }

    if (member.assignment.type === 'district') {
      const district = districtsMap.get(member.assignment.districtId);
      if (!district) continue;
      
      let currentUpdate = districtUpdates.find(d => d.districtId === district.id);
      if (!currentUpdate) {
        currentUpdate = { districtId: district.id };
        districtUpdates.push(currentUpdate);
      }

      // Calculate district income with modifiers
      const districtModifier = districtIncomeModifiers.get(district.type) || 1;
      const districtHourlyIncome = Math.floor(district.baseIncome / 24) * districtModifier;
      
      // Role-based effects
      switch (member.role) {
        case 'Underboss':
          cashGained += districtHourlyIncome;
          currentUpdate.newHeat = Math.max(0, district.heat - 0.1);
          break;
        case 'Enforcer Lead':
          currentUpdate.newHeat = Math.max(0, district.heat - 0.05);
          // Phase 2: District Fortification
          if (district.controlledBy === 'player') {
              const fortificationCap = 100;
              currentUpdate.newFortification = Math.min(fortificationCap, district.fortification + 0.2);
          }
          break;
        default: // Other roles assigned to districts also generate income
          cashGained += districtHourlyIncome * 0.5; // Less effective than an Underboss
          break;
      }

      // Phase 2: Passive Influence Generation
      if (district.controlledBy === 'neutral') {
          const influenceCap = 100;
          const influenceGained = member.skills.influence * 0.1; // 0.1 influence per skill point per hour
          const newInfluence = Math.min(influenceCap, district.playerInfluence + influenceGained);
          
          if (newInfluence >= influenceCap) {
              currentUpdate.flippedToPlayer = true;
              currentUpdate.newPlayerInfluence = 0;
          } else {
              currentUpdate.newPlayerInfluence = newInfluence;
          }
      }
    }

    // --- Phase 1: HQ Specialist Assignments ---
    if (member.assignment.type === 'hq') {
        const upgrade = hqUpgradesMap.get(member.assignment.upgradeId);
        if (!upgrade || !upgrade.owned) continue;

        if (upgrade.id === 1 && member.role === 'Master Forger') {
            cashGained += (2000 / 24) * 0.50; // +50% bonus
        }
        if (upgrade.id === 4 && member.role === 'Hacker') {
            cashGained += 2400 / 24; // Flat bonus
        }
    }
  }

  return { 
    cashGained: cashGained * globalIncomeModifier, 
    districtUpdates, 
    updatedMembers, 
    updatedWorldEvents, 
    newHighHeatDuration,
    globalIncomeModifier, // Pass this back for display/logging if needed
    heatModifier 
  };
};
