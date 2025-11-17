import { GameState, District, GangMember, HqUpgrade, WorldEvent, Ward } from '../../types';
import { WAREHOUSE_LEVELS, HIDEOUT_MODULES, SKILL_TREES } from '../../constants';

interface DistrictUpdate {
  districtId: number;
  newHeat?: number;
  newPlayerInfluence?: number;
  newFortification?: number;
  flippedToPlayer?: boolean;
}

interface AutomationResult {
  cashGained: number;
  heatChange: number;
  districtUpdates: DistrictUpdate[];
  updatedMembers: GangMember[];
  updatedWorldEvents: WorldEvent[];
  newHighHeatDuration: number;
  globalIncomeModifier: number;
  heatModifier: number;
  investigationProgressChange: number;
  activeWardBonuses: { wardName: string; bonusDescription: string }[];
  newHqMoonshine: number;
  newDistrictMoonshine: Record<number, number>;
}

const getWardBonus = (ward: Ward): { type: 'INCOME' | 'HEAT' | 'INVESTIGATION', value: number, description: string } => {
    const typeCounts = ward.districts.reduce((acc, district) => {
        acc[district.type] = (acc[district.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const dominantType = Object.keys(typeCounts).reduce((a, b) => typeCounts[a] > typeCounts[b] ? a : b, 'mixed');

    switch (dominantType) {
        case 'Financial': case 'Entertainment': return { type: 'INCOME', value: 0.15, description: "+15% Income from all districts in this ward." };
        case 'Industrial': case 'Docks': case 'port': return { type: 'HEAT', value: -0.2, description: "The ward's heavy industry provides cover, reducing passive heat generation." };
        case 'Slums': case 'Residential': return { type: 'INVESTIGATION', value: -0.05, description: "It's hard to find informants here, slowing police investigation progress." };
        default: return { type: 'INCOME', value: 0.05, description: "+5% income bonus from this ward." };
    }
};

export const processAutomation = (gameState: GameState, worldTime: Date): AutomationResult => {
  let cashGained = 0;
  let heatChange = 0;
  let investigationProgressChange = 0;
  let newHqMoonshine = gameState.hqMoonshine;
  let newDistrictMoonshine = { ...gameState.districtMoonshine };

  const districtUpdates: DistrictUpdate[] = [];
  const allDistricts = gameState.wards.flatMap(w => w.districts);
  const districtsMap = new Map<number, District>(allDistricts.map(d => [d.id, d]));
  const hqUpgradesMap = new Map<number, HqUpgrade>(gameState.hqUpgrades.map(u => [u.id, u]));

  const updatedMembers = JSON.parse(JSON.stringify(gameState.gangMembers)) as GangMember[];
  let updatedWorldEvents = JSON.parse(JSON.stringify(gameState.worldEvents)) as WorldEvent[];
  let newHighHeatDuration = gameState.highHeatDuration;
  const activeWardBonuses: { wardName: string; bonusDescription: string }[] = [];

  const { mastermind } = gameState;
  const skillTree = SKILL_TREES[mastermind.class];
  const unlockedSkills = new Set(mastermind.unlockedSkills);

  // --- Mastermind Focus Regeneration ---
  mastermind.focus = Math.min(mastermind.maxFocus, mastermind.focus + 1); // 1 focus per hour

  // --- World Event Management ---
  for (const event of updatedWorldEvents) {
    if (event.isActive) {
      event.duration -= 1;
      if (event.duration <= 0) {
        event.isActive = false;
      }
    }
  }

  // Trigger new events
  if (gameState.heat > 80) {
    newHighHeatDuration += 1;
  } else {
    newHighHeatDuration = 0;
  }
  
  const crackdownEvent = updatedWorldEvents.find(e => e.id === 'police_crackdown');
  if (crackdownEvent && !crackdownEvent.isActive && newHighHeatDuration > 48) {
    crackdownEvent.isActive = true;
    crackdownEvent.duration = 120;
    newHighHeatDuration = 0;
  }
  
  if (worldTime.getDay() === 0 && worldTime.getHours() === 0) {
      updatedWorldEvents.forEach(e => {
        if (e.id === 'economic_boom' || e.id === 'recession') e.isActive = false;
      });
      const roll = Math.random();
      if (roll < 0.15) {
        const boom = updatedWorldEvents.find(e => e.id === 'economic_boom');
        if (boom) {
            boom.isActive = true;
            boom.duration = 168;
        }
      } else if (roll < 0.3) {
        const recession = updatedWorldEvents.find(e => e.id === 'recession');
        if (recession) {
            recession.isActive = true;
            recession.duration = 168;
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
            if (event.id === 'economic_boom') districtIncomeModifiers.set('Entertainment', 2);
            if (event.id === 'recession') districtIncomeModifiers.set('Docks', 0.5);
        }
    }
  }

  // --- Passive Healing ---
  for (const member of updatedMembers) {
    if (member.status === 'Wounded' && member.recoveryTime) {
      member.recoveryTime -= 1;
      if (member.recoveryTime <= 0) {
        member.status = 'Idle';
        delete member.recoveryTime;
      }
    }
  }

  // --- Passive Heat Management & Investigation Progress ---
  heatChange -= 0.1; // Base hourly heat decay
  const legalFront = gameState.hqUpgrades.find(u => u.id === 6 && u.owned);
  if (legalFront) {
    heatChange -= 0.2; // Bonus decay from the upgrade
  }
  const informantNetwork = gameState.hqUpgrades.find(u => u.id === 4 && u.owned);
  if (informantNetwork) {
    let informantHeatReduction = -0.1;
    if (unlockedSkills.has('spymaster_expanded_network')) {
        informantHeatReduction *= 2;
    }
    heatChange += informantHeatReduction;
  }
  
  // Apply Spymaster passive heat reduction skills
  if (unlockedSkills.has('spymaster_black_mirror')) {
      heatChange -= 0.1;
  }

  let heatIncomeModifier = 1.0;
  // NEW: Tiered consequences for high heat, aligning with GDD
  if (gameState.heat > 200) { // CATASTROPHIC
      heatIncomeModifier = 0.5; // -50% income penalty
      investigationProgressChange += 0.5; // Investigation accelerates dramatically
      heatChange -= 0.3; // Add bonus decay to help manage catastrophic heat
  } else if (gameState.heat > 150) { // CRITICAL
      heatIncomeModifier = 0.8; // -20% income penalty
      investigationProgressChange += 0.3;
      heatChange -= 0.2; // Add bonus decay to help manage critical heat
  } else if (gameState.heat > 100) { // RED
      investigationProgressChange += 0.2;
      heatChange -= 0.1; // Add bonus decay to help manage high heat
  } else if (gameState.heat > 75) { // ORANGE
      investigationProgressChange += 0.1;
  } else if (gameState.heat < 40) { // COOL
      investigationProgressChange -= 0.05; // Investigation stalls and regresses
  }

  // --- HQ Production & Effects Aggregation ---
  let moonshineBaseProduction = 0;
  let moonshineSalePriceModifier = 1.0;

  gameState.hqUpgrades.filter(u => u.owned).forEach(upgrade => {
    if (upgrade.structuredEffects) {
      upgrade.structuredEffects.forEach(effect => {
        if (effect.type === 'BASE_PRODUCTION' && effect.resource === 'MOONSHINE') {
          moonshineBaseProduction += effect.value;
        }
        if (effect.type === 'SALE_PRICE_MODIFIER' && effect.resource === 'MOONSHINE') {
          moonshineSalePriceModifier += effect.value;
        }
      });
    }
  });
  
  let moonshineProductionModifier = 1.0;
  if (unlockedSkills.has('industrialist_efficiency')) {
      moonshineProductionModifier += 0.25;
  }
  
  newHqMoonshine += moonshineBaseProduction * moonshineProductionModifier;


  // --- Base Income from Player-Controlled Districts & Landmark Effects---
  let landmarkIncomeMultiplier = 1.0;
  let landmarkHeatMultiplier = 1.0;

  allDistricts.forEach(district => {
    if (district.controlledBy === 'player') {
        // District base income
        const districtModifier = districtIncomeModifiers.get(district.type) || 1;
        const tempIncome = (district.baseIncome / 24) * districtModifier;
        cashGained += tempIncome;
        
        // Landmark effects
        if (district.landmark) {
            if (district.landmark.effect.type === 'GLOBAL_INCOME_MOD') {
                landmarkIncomeMultiplier += district.landmark.effect.value;
            }
             if (district.landmark.effect.type === 'GLOBAL_HEAT_REDUCTION') {
                landmarkHeatMultiplier -= district.landmark.effect.value;
            }
        }
    }
  });


  // --- Process Assignments (Districts, HQ, Training) ---
  for (const member of updatedMembers) {
    if (!member.assignment || member.assignment.type === 'hideout') continue;

    if (member.assignment.type === 'training') {
        const skill = member.assignment.skill;
        if (member.skills[skill] < 10) { // Skill cap
            let progressRate = 1; // 1 point of progress per hour (100 hours to level up).
            if (unlockedSkills.has('warlord_drill_sergeant')) {
                progressRate *= 1.25;
            }
            member.assignment.progress += progressRate;
            if (member.assignment.progress >= 100) {
                member.skills[skill] = Math.min(10, member.skills[skill] + 1);
                member.assignment.progress = 0;
            }
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

      // Role-based bonus effects
      if (district.controlledBy === 'player') {
          switch(member.role) {
              case 'Underboss':
                const districtModifier = districtIncomeModifiers.get(district.type) || 1;
                const bonusIncome = (district.baseIncome / 24) * 0.25 * districtModifier; // +25% income bonus
                cashGained += bonusIncome;
                break;
              case 'Enforcer Lead':
                if (member.skills.combat >= 7) {
                  const fortificationCap = 100;
                  currentUpdate.newFortification = Math.min(fortificationCap, (currentUpdate.newFortification ?? district.fortification) + 0.2);
                }
                break;
          }
      }

      // Passive Influence Generation in neutral districts
      if (district.controlledBy === 'neutral') {
          const influenceCap = 100;
          let influenceGained = member.skills.influence * 0.1;
          if (unlockedSkills.has('warlord_iron_fist')) {
              influenceGained *= 2;
          }
          const newInfluence = Math.min(influenceCap, (currentUpdate.newPlayerInfluence ?? district.playerInfluence) + influenceGained);
          
          if (newInfluence >= influenceCap) {
              currentUpdate.flippedToPlayer = true;
              currentUpdate.newPlayerInfluence = 0;
          } else {
              currentUpdate.newPlayerInfluence = newInfluence;
          }
      }
    }

    if (member.assignment.type === 'hq') {
        const upgrade = hqUpgradesMap.get(member.assignment.upgradeId);
        if (!upgrade || !upgrade.owned || !upgrade.assignmentSlot?.bonusCalculation) continue;

        const calc = upgrade.assignmentSlot.bonusCalculation;
        const skillValue = member.skills[calc.skill] || 0;
        const bonus = calc.base + (skillValue * calc.multiplier);
        
        if (calc.type === 'INCOME') {
            cashGained += bonus / 24; // Convert daily bonus to hourly
        } else if (calc.type === 'PRODUCTION') {
            newHqMoonshine += bonus; // Production is hourly
        }
    }
  }
  
  // --- Process District Asset Effects (Hideouts & Warehouses) ---
    allDistricts.forEach(district => {
        if (district.controlledBy === 'player') {
            // Hideouts
            if (district.hideoutModules && district.hideoutModules.length > 0) {
                district.hideoutModules.forEach(moduleId => {
                    const moduleInfo = HIDEOUT_MODULES.find(m => m.id === moduleId);
                    if (moduleInfo?.effect.type === 'HEAT_REDUCTION') {
                         let currentUpdate = districtUpdates.find(d => d.districtId === district.id);
                        if (!currentUpdate) {
                            currentUpdate = { districtId: district.id };
                            districtUpdates.push(currentUpdate);
                        }
                        const currentHeat = district.heat;
                        currentUpdate.newHeat = Math.max(0, (currentUpdate.newHeat ?? currentHeat) - moduleInfo.effect.value);
                    }
                });
            }
            // Warehouses (Sales)
            if (district.warehouse && district.warehouse.level > 0) {
                const warehouseInfo = WAREHOUSE_LEVELS[district.warehouse.level];
                const currentStock = newDistrictMoonshine[district.id] || 0;
                if (currentStock > 0) {
                    const amountToSell = Math.min(currentStock, 5); // Sell up to 5 units per hour
                    const districtTypeBonus = district.type === 'Entertainment' ? 1.5 : 1.0;
                    let incomePerUnit = 150 * districtTypeBonus * warehouseInfo.effect.saleBonus;

                    if(unlockedSkills.has('industrialist_black_market_maven')) {
                        incomePerUnit *= 1.10;
                    }
                    
                    // Apply HQ specialization bonus
                    incomePerUnit *= moonshineSalePriceModifier;

                    cashGained += amountToSell * incomePerUnit;
                    newDistrictMoonshine[district.id] = currentStock - amountToSell;
                }
            }
        }
    });

  // --- Ward Control Bonuses ---
  gameState.wards.forEach(ward => {
      const isPlayerControlled = ward.districts.every(d => d.controlledBy === 'player');
      if (isPlayerControlled) {
          const bonus = getWardBonus(ward);
          activeWardBonuses.push({ wardName: ward.name, bonusDescription: bonus.description });

          switch (bonus.type) {
              case 'INCOME':
                  const wardBaseIncome = ward.districts.reduce((sum, d) => sum + (d.baseIncome / 24), 0);
                  cashGained += wardBaseIncome * bonus.value;
                  break;
              case 'HEAT':
                  heatChange += bonus.value;
                  break;
              case 'INVESTIGATION':
                  investigationProgressChange += bonus.value;
                  break;
          }
      }
  });


  // Apply Economic Volatility
  if (gameState.economicClimate && gameState.economicClimate.volatility > 0) {
      const volatilityEffect = 1 + (Math.random() - 0.5) * gameState.economicClimate.volatility * 2;
      cashGained *= volatilityEffect;
  }
  
  // --- Mastermind Passive Bonuses ---
  let finalPassiveIncomeModifier = 1.0;
  for (const skill of skillTree) {
      if(unlockedSkills.has(skill.id) && skill.effect.type === 'INCOME_MODIFIER' && skill.effect.category === 'PASSIVE') {
          finalPassiveIncomeModifier += skill.effect.value;
      }
  }
  cashGained *= finalPassiveIncomeModifier;

  return { 
    cashGained: cashGained * globalIncomeModifier * landmarkIncomeMultiplier * heatIncomeModifier, 
    heatChange: heatChange * landmarkHeatMultiplier,
    districtUpdates, 
    updatedMembers, 
    updatedWorldEvents, 
    newHighHeatDuration,
    globalIncomeModifier,
    heatModifier,
    investigationProgressChange,
    activeWardBonuses,
    newHqMoonshine,
    newDistrictMoonshine,
  };
};