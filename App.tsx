

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { GangView } from './components/GangView';
import { OperationsView } from './components/OperationsView';
import { HqView } from './components/HqView';
import { LieutenantsView } from './components/LieutenantsView';
import { RecruitmentView } from './components/RecruitmentView';
import { FinanceView } from './components/FinanceView';
import { MastermindView } from './components/MastermindView';
import { AssignCrewModal } from './components/AssignCrewModal';
import { AssignIntelModal } from './components/AssignIntelModal';
import { DistrictDetailModal } from './components/DistrictDetailModal';
import { WorldEventsDisplay } from './components/WorldEventsDisplay';
import { NotificationLog } from './components/NotificationLog';
import { EconomicClimateDisplay } from './components/EconomicClimateDisplay';
import { TokenCountDisplay } from './components/TokenCountDisplay';
import { EventLogModal } from './components/EventLogModal';
import { MastermindOperationModal } from './components/MastermindOperationModal';
import { GameState, Operation, ActiveOperation, HqUpgrade, View, RecruitmentMission, GangMember, Notification, Reward, PotentialRecruit, Faction, FullInitialScenario, District, Trait, Lieutenant, Transaction, GameEvent, Ward, MapActivity, UsageMetadata } from './types';
// FIX: Imported getHeatCostModifier from constants.
import { WAREHOUSE_LEVELS, GAME_MECHANICS, TIER_NAMES, SKILL_TREES, HIDEOUT_MODULES, getHeatCostModifier } from './constants';
import { generateOperations } from './services/gemini';
import { processAutomation, processRivalTurn, generateReward } from './services/localAutomations';
import { MapIcon, UsersIcon, BriefcaseIcon, HomeIcon, CrownIcon, SearchIcon, PieChartIcon, StarIcon } from './components/icons';

const getTier = (totalEarnings: number): number => {
    const TIER_THRESHOLDS = [0, 250000, 1000000, 10000000, 50000000];
    for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalEarnings >= TIER_THRESHOLDS[i]) {
            return i + 1;
        }
    }
    return 1;
};

// FIX: Moved getHeatCostModifier to constants.ts to be shared across components.


interface AppProps {
    initialGameState: GameState;
    onExitGame: () => void;
    onSaveGame: (currentState: GameState) => void;
}

export const App: React.FC<AppProps> = ({ initialGameState, onSaveGame }) => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  const [operations, setOperations] = useState<Operation[]>([]);
  const [activeOperations, setActiveOperations] = useState<ActiveOperation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentView, setCurrentView] = useState<View>(View.HQ);
  const [isLoadingOps, setIsLoadingOps] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [assigningOperation, setAssigningOperation] = useState<Operation | null>(null);
  const [isAssigningIntel, setIsAssigningIntel] = useState<boolean>(false);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [worldTime, setWorldTime] = useState(() => new Date('1931-01-01T08:00:00'));
  const [isEventLogVisible, setIsEventLogVisible] = useState(false);
  // FIX: Changed the type of `operation` to be more specific. Mastermind operations are always 'REGULAR' ops,
  // which ensures properties like `difficulty`, `title`, and `description` are available and resolves type errors.
  const [resolvingMastermindOp, setResolvingMastermindOp] = useState<{ operation: Extract<ActiveOperation, { type: 'REGULAR' }>, memberIds: number[] } | null>(null);
  const intelProcessingQueue = useRef<{ member: GangMember; completionTime: Date }[]>([]);


  const logTransaction = useCallback((state: GameState, transaction: Omit<Transaction, 'timestamp'>): GameState => {
    const newTransaction: Transaction = { ...transaction, timestamp: worldTime };
    const newLog = [...state.transactionLog, newTransaction];
    if (newLog.length > 500) {
      newLog.shift();
    }
    return { ...state, transactionLog: newLog };
  }, [worldTime]);

  const logEvent = useCallback((message: string, type: Notification['type'] = 'info', relatedView?: View, relatedId?: string) => {
      const newNotification: Notification = { id: Date.now() + Math.random(), message, type, relatedView, relatedId };
      setNotifications(prev => [newNotification, ...prev]);

      setGameState(prev => {
          if (!prev) return null;
          const newGameEvent: GameEvent = {
              id: newNotification.id,
              timestamp: worldTime,
              message,
              type: type || 'info'
          };
          const newLog = [newGameEvent, ...prev.eventLog];
          if (newLog.length > 100) { // Cap log size
              newLog.pop();
          }
          return { ...prev, eventLog: newLog };
      });
  }, [worldTime]);

  const handleSaveGame = useCallback(() => {
    if (gameState) {
        onSaveGame(gameState);
        logEvent('Game Saved!', 'success');
    }
  }, [gameState, onSaveGame, logEvent]);


  // Game Loop
  useEffect(() => {
    if (!gameState) return;

    const timer = setInterval(() => {
      setWorldTime(prevTime => {
        const newTime = new Date(prevTime.getTime() + 60 * 60 * 1000); // Advance 1 hour
        const isNewDay = newTime.getDate() !== prevTime.getDate();
        const cooldownDuration = GAME_MECHANICS.DISTRICT_TAKEOVER_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

        setGameState(currentGameState => {
            if (!currentGameState) return null;
            
            const eventsToLog: { message: string, type: Notification['type'], relatedView?: View, relatedId?: string }[] = [];

            let updatedState = { ...currentGameState };

            // Expire buffs and temporary effects
            updatedState.activeHqBuffs = (updatedState.activeHqBuffs || []).filter(buff => new Date(buff.expirationTime) > newTime);
            updatedState.wards = updatedState.wards.map(w => ({
                ...w,
                districts: w.districts.map(d => {
                    if (d.temporaryFortification && new Date(d.temporaryFortification.expirationTime) <= newTime) {
                        const { temporaryFortification, ...rest } = d;
                        return rest;
                    }
                    return d;
                })
            }));

            const allDistricts = updatedState.wards.flatMap(w => w.districts);
            const oldCash = updatedState.cash;
            const oldHeat = updatedState.heat;
            const previousBonuses = new Set(currentGameState.activeWardBonuses.map(b => b.wardName));

            // 1. Process Automation (All Phases)
            const automationResults = processAutomation(updatedState, newTime);
            if (automationResults.cashGained > 0) {
              updatedState.cash += automationResults.cashGained;
              updatedState.totalEarnings += automationResults.cashGained;
              // Only log significant transactions to avoid clutter
              if(automationResults.cashGained > 100) {
                 updatedState = logTransaction(updatedState, { type: 'income', category: 'Passive Income', amount: automationResults.cashGained });
              }
            }
            updatedState.hqMoonshine = automationResults.newHqMoonshine;
            updatedState.districtMoonshine = automationResults.newDistrictMoonshine;
            updatedState.heat = Math.max(0, updatedState.heat + automationResults.heatChange);
            updatedState.investigationProgress = Math.max(0, Math.min(100, updatedState.investigationProgress + automationResults.investigationProgressChange));
            updatedState.gangMembers = automationResults.updatedMembers;
            updatedState.worldEvents = automationResults.updatedWorldEvents;
            updatedState.highHeatDuration = automationResults.newHighHeatDuration;
            updatedState.activeWardBonuses = automationResults.activeWardBonuses; // Update active bonuses
            updatedState.wards = updatedState.wards.map(ward => ({
                ...ward,
                districts: ward.districts.map(d => {
                    const update = automationResults.districtUpdates.find(du => du.districtId === d.id);
                    if (!update) return d;
                    const newDistrict = { ...d, ...update };
                    if (update.flippedToPlayer) {
                        newDistrict.controlledBy = 'player';
                        newDistrict.takeoverCooldownUntil = new Date(newTime.getTime() + cooldownDuration);
                        eventsToLog.push({ message: `Your influence in ${d.name} has paid off. The district is now under your control!`, type: 'success' });
                        // On influence flip, cancel all rival operations targeting this district
                        updatedState.rivalOperations.forEach(ro => {
                            if (ro.targetDistrictId === d.id) ro.isResolved = true;
                        });
                    }
                    return newDistrict;
                })
            }));
            
            // 1.5 Check for Ward Bonus Notifications
            const currentBonuses = new Set(automationResults.activeWardBonuses.map(b => b.wardName));
            for (const bonus of automationResults.activeWardBonuses) {
                if (!previousBonuses.has(bonus.wardName)) {
                    eventsToLog.push({ message: `You now control all of ${bonus.wardName}, gaining a bonus: ${bonus.bonusDescription}!`, type: 'success' });
                }
            }
            for (const announcedBonus of previousBonuses) {
                if (!currentBonuses.has(announcedBonus)) {
                    eventsToLog.push({ message: `You've lost control of ${announcedBonus}, losing its strategic bonus.`, type: 'warning' });
                }
            }
            
            // 2. Process Rival Faction Turns (Once per day)
            if (isNewDay) {
                const existingDefenseOps = new Set(
                    operations.filter(op => op.isCounterOperation).map(op => op.targetDistrictId)
                );

                const turnResults = updatedState.rivalFactions.map(rival => processRivalTurn(updatedState, rival, newTime));
                turnResults.forEach(result => {
                    const rivalFaction = updatedState.rivalFactions.find(f => f.id === result.updatedRival.id);
                    if (result.stimulusApplied && rivalFaction) {
                        eventsToLog.push({ message: `A shadowy patron props up the ${rivalFaction.name}, injecting $${Math.round(result.stimulusApplied.amount).toLocaleString()} into their coffers to counter your influence.`, type: 'warning' });
                    }
                    if (result.newOperation) {
                        updatedState.rivalOperations.push(result.newOperation);
                        const targetDistrict = allDistricts.find(d => d.id === result.newOperation!.targetDistrictId);

                        if (result.newOperation.type === 'ATTACK_PLAYER' && targetDistrict && !existingDefenseOps.has(targetDistrict.id)) {
                             const counterOp: Operation = {
                                id: `counter-op-${result.newOperation.id}`,
                                title: `Defend ${targetDistrict.name}`,
                                description: `The ${rivalFaction?.name} are making a move on ${targetDistrict.name}. We need to repel their forces before they dig in.`,
                                requiredSkills: ['Combat', 'Cunning'],
                                difficulty: 7, // Make defense hard
                                reward: 20000,
                                heat: 5,
                                isCounterOperation: true,
                                rivalOperationId: result.newOperation.id,
                                targetDistrictId: targetDistrict.id,
                            };
                            setOperations(prev => [counterOp, ...prev]);
                            eventsToLog.push({ message: `The ${rivalFaction?.name} are attacking ${targetDistrict.name}! A defense operation is now available.`, type: 'warning', relatedView: View.OPERATIONS, relatedId: String(counterOp.id) });
                            existingDefenseOps.add(targetDistrict.id); // Prevent duplicate ops in the same tick
                        } else if (targetDistrict) {
                             eventsToLog.push({ message: `The ${rivalFaction?.name} are making a move on the neutral district of ${targetDistrict.name}.`, type: 'info' });
                        }
                    }
                    updatedState.rivalFactions = updatedState.rivalFactions.map(rf => rf.id === result.updatedRival.id ? result.updatedRival : rf);
                });
            }

            // 3. Check for completed operations (Player & Scouting)
            let completedOps = activeOperations.filter(op => newTime >= op.completionTime);
            
            if (completedOps.length > 0) {
              const mastermindOpToResolve = completedOps.find(
                  (op): op is Extract<ActiveOperation, { type: 'REGULAR' }> => 
                      op.type === 'REGULAR' && !!op.isMastermindOperation
              );

              if (mastermindOpToResolve && !resolvingMastermindOp) {
                  setResolvingMastermindOp({ operation: mastermindOpToResolve, memberIds: mastermindOpToResolve.assignedMemberIds });
                  // FIX: All ActiveOperation types now have an 'id', so a type guard is no longer needed.
                  completedOps = completedOps.filter(op => op.id !== mastermindOpToResolve.id);
              }

              // FIX: All ActiveOperation types now have a unique 'id', simplifying the collection of completed operation IDs.
              const completedOpIds = new Set(completedOps.map(op => op.id));
              const membersToUpdate = new Set(completedOps.flatMap(op => op.type === 'INTEL' ? op.assignedMemberId : op.assignedMemberIds));
              
              let totalReward = 0;
              let totalHeat = 0;
              let totalXpGained = 0;

              completedOps.forEach(op => {
                  if (op.type === 'REGULAR') {
                      totalHeat += op.heat;
                      
                      // Apply XP multiplier from 'Drill Troops' HQ action buff
                      let xpMultiplier = 1.0;
                      const drillTroopsBuff = updatedState.activeHqBuffs.find(b => b.buffId === 'drill_troops');
                      if (drillTroopsBuff && op.requiredSkills.includes('Combat')) {
                          xpMultiplier = 2.0;
                      }
                      totalXpGained += op.difficulty * 100 * xpMultiplier; // XP Gain

                      if (op.targetDistrictId) {
                          updatedState.wards = updatedState.wards.map(ward => ({
                              ...ward,
                              districts: ward.districts.map(d => {
                                  if (d.id === op.targetDistrictId) {
                                      const newDistrictHeat = Math.min(100, d.heat + op.heat);
                                      return { ...d, heat: newDistrictHeat };
                                  }
                                  return d;
                              })
                          }));
                      }

                      if (op.rewardModifier < 0.7 && Math.random() < 0.25) { // 25% chance if op was very risky
                          const trait: Trait = { name: 'Shaken', description: 'Survived a close call, but is now more hesitant.', effect: '-5% skill effectiveness on ops' };
                          const reward: Reward = { type: 'TRAIT_GAIN', memberIds: op.assignedMemberIds, trait, message: `The last operation was a close call. ${op.assignedMemberIds.map(id => updatedState.gangMembers.find(m=>m.id === id)?.name).join(', ')} gained the 'Shaken' trait.` };
                          updatedState = applyReward(updatedState, reward);
                          eventsToLog.push({ message: reward.message, type: 'warning' });
                      }

                      // Rare chance for skill gain from experience
                      if (Math.random() < 1/7) {
                          const memberToRewardId = op.assignedMemberIds[Math.floor(Math.random() * op.assignedMemberIds.length)];
                          const memberToReward = updatedState.gangMembers.find(m => m.id === memberToRewardId);
                          if (memberToReward && op.requiredSkills.length > 0) {
                              const relevantSkills = op.requiredSkills.map(s => s.toLowerCase()) as (keyof GangMember['skills'])[];
                              const skillToUpgrade = relevantSkills[Math.floor(Math.random() * relevantSkills.length)];
                              
                              if (memberToReward.skills[skillToUpgrade] < 10) {
                                  const skillUpReward: Reward = {
                                      type: 'SKILL_PROMOTION',
                                      memberIds: [memberToReward.id],
                                      skill: skillToUpgrade,
                                      amount: 1,
                                      message: `${memberToReward.name} learned a thing or two on the last job. Their ${skillToUpgrade} skill has improved!`
                                  };
                                  updatedState = applyReward(updatedState, skillUpReward);
                                  eventsToLog.push({ message: skillUpReward.message, type: 'success' });
                              }
                          }
                      }

                      if (op.isTakeoverOperation && op.targetDistrictId) {
                         const targetId = op.targetDistrictId;
                         updatedState.wards = updatedState.wards.map(ward => ({
                             ...ward,
                             districts: ward.districts.map(d => {
                                if (d.id === targetId) {
                                    eventsToLog.push({ message: `Operation successful! You have seized control of ${d.name}.`, type: 'success' });
                                    return { ...d, controlledBy: 'player', playerInfluence: 0, takeoverCooldownUntil: new Date(newTime.getTime() + cooldownDuration) };
                                }
                                return d;
                             })
                         }));
                         updatedState.rivalOperations.forEach(ro => {
                           if (ro.targetDistrictId === targetId) ro.isResolved = true;
                         });
                      } else if (op.isCounterOperation && op.rivalOperationId) {
                          const rivalOp = updatedState.rivalOperations.find(ro => ro.id === op.rivalOperationId);
                          if (rivalOp) {
                              const targetId = rivalOp.targetDistrictId;
                              updatedState.rivalOperations.forEach(ro => {
                                if (ro.targetDistrictId === targetId) ro.isResolved = true;
                              });

                              updatedState.wards = updatedState.wards.map(ward => ({
                                  ...ward,
                                  districts: ward.districts.map(d => {
                                      if (d.id === targetId) {
                                          eventsToLog.push({ message: `Defense of ${d.name} successful! The district is fortified against takeovers for a short period.`, type: 'success' });
                                          return { ...d, takeoverCooldownUntil: new Date(newTime.getTime() + cooldownDuration) };
                                      }
                                      return d;
                                  })
                              }));

                              let reward = generateReward(updatedState, op.assignedMemberIds);
                              
                              const skillTree = SKILL_TREES[updatedState.mastermind.class];
                              const unlockedSkills = new Set(updatedState.mastermind.unlockedSkills);
                              let hasSpoilsOfWar = false;
                              for (const skill of skillTree) {
                                  if(unlockedSkills.has(skill.id) && skill.id === 'warlord_spoils_of_war') {
                                      hasSpoilsOfWar = true;
                                      break;
                                  }
                              }

                              if (hasSpoilsOfWar && reward.type === 'CASH') {
                                  const bonus = Math.round(reward.amount * 0.10);
                                  reward.amount += bonus;
                                  reward.message = `${reward.message} An extra $${bonus.toLocaleString()} was secured thanks to your Warlord's expertise!`;
                              }

                              updatedState = applyReward(updatedState, reward);
                              eventsToLog.push({ message: reward.message, type: 'info' });
                          }
                      } else if (op.isLieutenantMission && op.lieutenantId) {
                          const lieutenant = updatedState.lieutenants.find(lt => lt.id === op.lieutenantId);
                          if (lieutenant) {
                              const newMember: GangMember = {
                                  id: Date.now(),
                                  name: lieutenant.name,
                                  role: lieutenant.role,
                                  skills: lieutenant.skills,
                                  status: 'Idle',
                                  loyalty: 'infinity',
                              };
                              updatedState.gangMembers.push(newMember);
                              updatedState.lieutenants = updatedState.lieutenants.filter(lt => lt.id !== op.lieutenantId);
                              eventsToLog.push({ message: `Success! The legendary ${lieutenant.role}, ${lieutenant.name}, has joined your crew!`, type: 'success' });
                          }
                      } else {
                          totalReward += op.reward;
                          updatedState = logTransaction(updatedState, { type: 'income', category: 'Operation Payout', amount: op.reward });
                      }
                  } else if (op.type === 'SCOUTING') {
                        const districtId = op.districtId;
                        const pool = updatedState.districtRecruitPools[districtId] || [];
                        if (pool.length > 0) {
                            const scout = updatedState.gangMembers.find(m => m.id === op.assignedMemberIds[0]);
                            // FIX: Changed `continue` to `return` because it's inside a forEach callback. `continue` is only valid in loops.
                            if (!scout) return;

                            const scoutInfluence = scout.skills.influence || 1;
                            const calculateRating = (recruit: PotentialRecruit) => Object.values(recruit.skills).reduce((a, b) => a + b, 0);
                            
                            type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';
                            const getRarityFromRating = (rating: number): Rarity => {
                                if (rating >= 40) return 'epic';
                                if (rating >= 32) return 'rare';
                                if (rating >= 25) return 'uncommon';
                                return 'common';
                            };

                            const sampleSize = Math.min(pool.length, 10);
                            let sample = pool.splice(0, sampleSize);

                            // --- New Rarity Discovery Logic ---
                            const BASE_WEIGHTS = { common: 60, uncommon: 25, rare: 12, epic: 3 };
                            const INFLUENCE_MULTIPLIERS = { common: 0, uncommon: 0.08, rare: 0.12, epic: 0.20 };
                            
                            const weightedSample = sample.map(recruit => {
                                const rating = calculateRating(recruit);
                                const rarity = getRarityFromRating(rating);
                                const weight = BASE_WEIGHTS[rarity] * (1 + scoutInfluence * INFLUENCE_MULTIPLIERS[rarity]);
                                return { recruit, weight };
                            });

                            let totalWeight = weightedSample.reduce((sum, item) => sum + item.weight, 0);
                            
                            const numToReveal = Math.min(sample.length, Math.floor(2 + Math.random() * 2));
                            const revealedRecruits: PotentialRecruit[] = [];

                            for (let i = 0; i < numToReveal; i++) {
                                if (weightedSample.length === 0) break;
                                let roll = Math.random() * totalWeight;
                                let selectedIndex = -1;

                                for (let j = 0; j < weightedSample.length; j++) {
                                    roll -= weightedSample[j].weight;
                                    if (roll <= 0) {
                                        selectedIndex = j;
                                        break;
                                    }
                                }
                                
                                if (selectedIndex !== -1) {
                                    const [selectedItem] = weightedSample.splice(selectedIndex, 1);
                                    revealedRecruits.push(selectedItem.recruit);
                                    totalWeight -= selectedItem.weight;
                                }
                            }

                            const restOfSample = weightedSample.map(item => item.recruit);
                            pool.unshift(...restOfSample);
                            // --- End New Logic ---

                            updatedState.districtRecruitPools[districtId] = pool;
                            updatedState.potentialRecruits[districtId] = [...(updatedState.potentialRecruits[districtId] || []), ...revealedRecruits];
                            
                            const district = allDistricts.find(d => d.id === districtId);
                            eventsToLog.push({ message: `Scouting complete in ${district?.name}. ${revealedRecruits.length} potential recruits are available.`, type: 'info', relatedView: View.RECRUITMENT });
                        }
                  } else if (op.type === 'TRANSPORT') {
                        const districtId = op.destinationDistrictId;
                        const currentAmount = updatedState.districtMoonshine[districtId] || 0;
                        updatedState.districtMoonshine[districtId] = currentAmount + op.amount;
                        const district = allDistricts.find(d => d.id === districtId);
                        eventsToLog.push({ message: `Shipment of ${op.amount} units of Moonshine arrived at ${district?.name}.`, type: 'info' });
                  } else if (op.type === 'INTEL') {
                      const member = updatedState.gangMembers.find(m => m.id === op.assignedMemberId);
                      if (member) {
                          intelProcessingQueue.current.push({ member, completionTime: newTime });
                      }
                  }
              });

              updatedState.cash += totalReward;
              if (totalReward > 0) {
                  updatedState.totalEarnings += totalReward;
              }
              // FIX: Removed the Math.min(100, ...) cap on heat to allow it to rise to more dangerous levels,
              // aligning with the game design document's tiered heat system.
              updatedState.heat += (totalHeat * automationResults.heatModifier);
              updatedState.gangMembers = updatedState.gangMembers.map(member => 
                membersToUpdate.has(member.id) ? { ...member, status: 'Idle' } : member
              );
              
              // FIX: All ActiveOperation types now have an 'id', simplifying the filtering logic.
              setActiveOperations(prevActive => prevActive.filter(op => !completedOpIds.has(op.id)));
              
               if (totalXpGained > 0) {
                    let updatedMastermind = { ...updatedState.mastermind };
                    updatedMastermind.xp += totalXpGained;
                    const nextLevelXp = updatedMastermind.level * 1000;
                    if (updatedMastermind.xp >= nextLevelXp) {
                        updatedMastermind.level += 1;
                        updatedMastermind.xp -= nextLevelXp;
                        updatedMastermind.skillPoints += 1;
                        eventsToLog.push({ message: `LEVEL UP! You have reached Level ${updatedMastermind.level}. You have gained a Skill Point!`, type: 'success', relatedView: View.MASTERMIND });
                    }
                    updatedState.mastermind = updatedMastermind;
                }
            }
            
            // 3.5 Process Defense Effects on Rival Operations
            updatedState.rivalOperations.forEach(rivalOp => {
                if (rivalOp.type === 'ATTACK_PLAYER' && !rivalOp.isResolved) {
                    const assignedDefenders = updatedState.gangMembers.filter(
                        m => m.assignment?.type === 'district' && m.assignment.districtId === rivalOp.targetDistrictId
                    );
                    if (assignedDefenders.length > 0) {
                        const totalCombatSkill = assignedDefenders.reduce((sum, member) => sum + member.skills.combat, 0);
                        // The rival's operation is slowed based on the defenders' combined combat skill.
                        // Each point of combat skill adds a 5-minute delay per game-hour tick.
                        const slowdownMs = totalCombatSkill * 5 * 60 * 1000;
                        rivalOp.completionTime = new Date(rivalOp.completionTime.getTime() + slowdownMs);
                    }
                }
            });


            // 4. Check for completed RIVAL operations
            const completedRivalOps = updatedState.rivalOperations.filter(op => newTime >= op.completionTime && !op.isResolved);
            if (completedRivalOps.length > 0) {
                const districtsWonThisTick = new Set<number>();
                completedRivalOps.forEach(op => {
                    const opInState = updatedState.rivalOperations.find(ro => ro.id === op.id);
                    if (!opInState || opInState.isResolved) return; 

                    if (districtsWonThisTick.has(op.targetDistrictId)) {
                        opInState.isResolved = true;
                        return;
                    }

                    opInState.isResolved = true;
                    
                    updatedState.wards = updatedState.wards.map(ward => ({
                        ...ward,
                        districts: ward.districts.map(d => {
                            if (d.id === op.targetDistrictId) {
                                districtsWonThisTick.add(op.targetDistrictId);
                                const rival = updatedState.rivalFactions.find(f => f.id === op.factionId);
                                eventsToLog.push({ message: `${rival?.name || 'Rivals'} have seized control of ${d.name}.`, type: 'warning' });
                                return { ...d, controlledBy: op.factionId, takeoverCooldownUntil: new Date(newTime.getTime() + cooldownDuration) };
                            }
                            return d;
                        })
                    }));
                });
                if (districtsWonThisTick.size > 0) {
                    updatedState.rivalOperations.forEach(ro => {
                        if (districtsWonThisTick.has(ro.targetDistrictId)) {
                            ro.isResolved = true;
                        }
                    });
                    
                    const playerOpsToCancel = activeOperations.filter(
                        (p_op): p_op is Extract<ActiveOperation, { type: 'REGULAR' }> =>
                            p_op.type === 'REGULAR' && !!p_op.targetDistrictId && districtsWonThisTick.has(p_op.targetDistrictId)
                    );

                    if (playerOpsToCancel.length > 0) {
                        const cancelledOpIds = new Set(playerOpsToCancel.map(op => op.id));
                        const membersToFree = new Set(playerOpsToCancel.flatMap(op => op.assignedMemberIds));
                        const districtNames = Array.from(districtsWonThisTick).map(id => allDistricts.find(d => d.id === id)?.name || 'a district').join(', ');
                        
                        eventsToLog.push({ message: `Your operations targeting ${districtNames} were cancelled due to enemy takeover!`, type: 'warning' });

                        setActiveOperations(prev => prev.filter(p_op => {
                            if (p_op.type === 'REGULAR') {
                                return !cancelledOpIds.has(p_op.id);
                            }
                            return true;
                        }));
                        
                        if (membersToFree.size > 0) {
                            updatedState.gangMembers = updatedState.gangMembers.map(m => 
                                membersToFree.has(m.id) ? { ...m, status: 'Idle' } : m
                            );
                        }
                    }

                    // Cancel available (non-active) operations too
                    setOperations(prev => prev.filter(p_op => !p_op.targetDistrictId || !districtsWonThisTick.has(p_op.targetDistrictId)));
                }
            }

            // 4.5 Manage Map Activities
            updatedState.mapActivities = updatedState.mapActivities.filter(activity => {
                const activityAgeHours = (newTime.getTime() - activity.spawnTime.getTime()) / (1000 * 60 * 60);
                return activityAgeHours < 24; // Activity disappears after 24 hours
            });
            
            // Spawn new activity? (approx once per day)
            const playerDistricts = allDistricts.filter(d => d.controlledBy === 'player');
            if (playerDistricts.length > 0 && Math.random() < 1 / 24) {
                const targetDistrict = playerDistricts[Math.floor(Math.random() * playerDistricts.length)];
                const newActivity: MapActivity = {
                    id: Date.now(),
                    districtId: targetDistrict.id,
                    type: 'cash', // Player territories only generate cash rewards
                    spawnTime: newTime,
                };
                updatedState.mapActivities.push(newActivity);
            }

            // 5. Check for RICO Raid
            if (updatedState.investigationProgress >= 100) {
                eventsToLog.push({ message: `RICO RAID! The Feds have dismantled a part of your operation! Your assets are frozen and key members arrested!`, type: 'warning' });
                const cashLost = updatedState.cash - Math.floor(updatedState.cash / GAME_MECHANICS.RICO_RAID_CASH_PENALTY_DIVISOR);
                updatedState.cash -= cashLost;
                updatedState = logTransaction(updatedState, { type: 'expense', category: 'RICO Raid Seizure', amount: cashLost });

                updatedState.heat = GAME_MECHANICS.RICO_RAID_HEAT_RESET;
                updatedState.investigationProgress = 0;
                
                const protectedMemberIds = new Set<number>();
                updatedState.wards.flatMap(w => w.districts).forEach(d => {
                    if (d.controlledBy === 'player' && d.hideoutModules.length > 0) {
                        let districtProtectionCap = 0;
                        d.hideoutModules.forEach(moduleId => {
                            const moduleInfo = HIDEOUT_MODULES.find(m => m.id === moduleId);
                            if (moduleInfo?.effect.type === 'PROTECTION') {
                                districtProtectionCap += moduleInfo.effect.value;
                            }
                        });
                        
                        if (districtProtectionCap > 0) {
                            const membersInHideout = updatedState.gangMembers
                                .filter(m => m.assignment?.type === 'hideout' && m.assignment.districtId === d.id);
                            
                            membersInHideout.slice(0, districtProtectionCap).forEach(m => protectedMemberIds.add(m.id));
                        }
                    }
                });

                const idleMembers = updatedState.gangMembers.filter(m => m.status === 'Idle' && m.loyalty !== 'infinity');
                const arrestableMembers = idleMembers.filter(m => !protectedMemberIds.has(m.id));
                
                const membersToArrest = arrestableMembers.sort(() => 0.5 - Math.random()).slice(0, Math.min(arrestableMembers.length, GAME_MECHANICS.RICO_RAID_ARREST_COUNT));
                
                updatedState.gangMembers = updatedState.gangMembers.map(m => {
                    if (membersToArrest.some(arrested => arrested.id === m.id)) {
                        return { ...m, status: 'Wounded', recoveryTime: GAME_MECHANICS.RICO_RAID_ARREST_DURATION_HOURS };
                    }
                    return m;
                });
            }

            // 6. Calculate and set flow/trend
            updatedState.cashFlow = updatedState.cash - oldCash;
            updatedState.heatTrend = updatedState.heat - oldHeat;

            // 7. Check for Tier Up & Narrative Progression
            const newTier = getTier(updatedState.totalEarnings);
            if (newTier > updatedState.tier) {
                eventsToLog.push({ message: `Your influence grows! You've reached the rank of: ${TIER_NAMES[newTier - 1]}.`, type: 'success' });
            }
            updatedState.tier = newTier;
            
            // Narrative Trigger Check
            const nextAct = updatedState.narrative.threeActs[updatedState.currentAct + 1];
            if (nextAct && nextAct.triggers && nextAct.triggers.length > 0) {
                let shouldAdvanceAct = false;
                for (const trigger of nextAct.triggers) {
                    if (!trigger.condition) continue;

                    const parts = trigger.condition.split(' ');
                    if (parts.length !== 3) continue;

                    const [key, op, valueStr] = parts;
                    const value = parseInt(valueStr, 10);
                    if (isNaN(value)) continue;

                    let conditionMet = false;
                    let currentValue: number;

                    switch (key) {
                        case 'player_tier':
                            currentValue = updatedState.tier;
                            break;
                        case 'total_earnings':
                            currentValue = updatedState.totalEarnings;
                            break;
                        case 'controlled_districts_count':
                             currentValue = allDistricts.filter(d => d.controlledBy === 'player').length;
                             break;
                        default:
                            continue;
                    }

                    switch (op) {
                        case '>=': conditionMet = currentValue >= value; break;
                        case '>': conditionMet = currentValue > value; break;
                        case '<=': conditionMet = currentValue <= value; break;
                        case '<': conditionMet = currentValue < value; break;
                        case '==': conditionMet = currentValue === value; break;
                        default: continue;
                    }
                    
                    if (conditionMet) {
                        shouldAdvanceAct = true;
                        break;
                    }
                }

                if (shouldAdvanceAct) {
                    updatedState.currentAct += 1;
                    updatedState.storyline = nextAct.summary;
                    eventsToLog.push({ message: `The story progresses... ${nextAct.summary}`, type: 'info' });
                }
            }
            
            // Batch process all log events for this tick to avoid state conflicts
            if (eventsToLog.length > 0) {
                const newNotifications: Notification[] = [];
                let stateWithNewLogs = { ...updatedState };

                eventsToLog.forEach(event => {
                    const newNotification: Notification = { id: Date.now() + Math.random(), ...event };
                    newNotifications.push(newNotification);

                    const newGameEvent: GameEvent = {
                        id: newNotification.id,
                        timestamp: newTime,
                        message: event.message,
                        type: event.type || 'info'
                    };
                    const newLog = [newGameEvent, ...stateWithNewLogs.eventLog];
                    if (newLog.length > 100) newLog.pop();
                    stateWithNewLogs.eventLog = newLog;
                });
                
                setNotifications(prev => [...newNotifications, ...prev]);
                updatedState = stateWithNewLogs;
            }

            return updatedState;
        });
        
        return newTime;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [activeOperations, gameState, logTransaction, operations, resolvingMastermindOp]);

  // This effect handles the asynchronous generation of operations when an intel op completes.
  // It runs after the main game state has been updated to avoid race conditions.
  useEffect(() => {
    if (intelProcessingQueue.current.length === 0 || !gameState) return;

    const processQueue = async () => {
        const itemsToProcess = [...intelProcessingQueue.current];
        intelProcessingQueue.current = []; // Clear queue immediately

        setIsLoadingOps(true);
        setError(null);

        const allNewOps: Operation[] = [];
        const allUsage: UsageMetadata[] = [];
        const eventsToLog: { message: string, timestamp: Date }[] = [];

        try {
            for (const item of itemsToProcess) {
                const { member, completionTime } = item;
                // Pass the most recent gameState to the generation service
                const result = await generateOperations(gameState, member);
                
                const finalOps = result.operations.map(opTemplate => {
                    const tier = gameState.tier;
                    const baseDifficulty = 1 + (tier - 1) * 2;
                    const difficulty = baseDifficulty + Math.floor(Math.random() * 2);
                    const baseReward = 5000 * Math.pow(tier, 2.5);
                    const reward = Math.round(baseReward + (Math.random() - 0.5) * baseReward * 0.5);
                    const heat = 5 + tier * 3 + Math.floor(difficulty / 2);
                    return { ...opTemplate, difficulty, reward, heat };
                });

                allNewOps.push(...finalOps);
                if (result.usage) allUsage.push(result.usage);
                eventsToLog.push({ message: `New leads are on the board. ${member.name} has returned.`, timestamp: completionTime });
            }

            // Batch apply all state updates
            setOperations(prevOps => [...allNewOps, ...prevOps.filter(p => p.isCounterOperation)]);
            
            setGameState(prev => {
                if (!prev) return null;
                let updatedState = { ...prev };

                const newNotifications: Notification[] = [];
                let newLog = [...updatedState.eventLog];

                eventsToLog.forEach(event => {
                    const notification = { id: Date.now() + Math.random(), message: event.message, type: 'success' as const, relatedView: View.OPERATIONS };
                    newNotifications.push(notification);
                    const newEvent: GameEvent = { id: notification.id, timestamp: event.timestamp, message: event.message, type: 'success' };
                    newLog.unshift(newEvent);
                });
                
                updatedState.eventLog = newLog.slice(0, 100);
                
                if (allUsage.length > 0) {
                    updatedState.lastTokenUsage = allUsage.reduce((acc, current) => ({
                        promptTokenCount: (acc.promptTokenCount || 0) + (current.promptTokenCount || 0),
                        candidatesTokenCount: (acc.candidatesTokenCount || 0) + (current.candidatesTokenCount || 0),
                        totalTokenCount: (acc.totalTokenCount || 0) + (current.totalTokenCount || 0),
                    }), { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 });
                }

                setNotifications(p => [...newNotifications, ...p]);
                return updatedState;
            });

        } catch (err) {
            setError('Failed to generate new operations. The underworld is quiet... for now.');
            console.error("Error generating operations:", err);
        } finally {
            setIsLoadingOps(false);
        }
    };

    processQueue();
  }, [gameState]);


  const applyReward = (currentState: GameState, reward: Reward): GameState => {
      let updatedState = { ...currentState };
      switch(reward.type) {
          case 'CASH':
              updatedState.cash += reward.amount;
              updatedState.totalEarnings += reward.amount;
              updatedState = logTransaction(updatedState, { type: 'income', category: 'Counter-Op Reward', amount: reward.amount });
              break;
          case 'SKILL_PROMOTION':
              updatedState.gangMembers = updatedState.gangMembers.map(m => {
                  if (reward.memberIds.includes(m.id) && m.skills[reward.skill] < 10) {
                      const newSkillValue = Math.round(Number(m.skills[reward.skill]) + reward.amount);
                      return {...m, skills: { ...m.skills, [reward.skill]: Math.min(10, newSkillValue) }};
                  }
                  return m;
              });
              break;
          case 'INFLUENCE_BOOST':
              updatedState.wards = updatedState.wards.map(ward => ({
                  ...ward,
                  districts: ward.districts.map(d => {
                    if (d.id === reward.districtId) {
                        return {...d, playerInfluence: Math.min(100, d.playerInfluence + reward.amount)};
                    }
                    return d;
                  })
              }));
              break;
          case 'DISTRICT_INCOME_BOOST':
              updatedState.wards = updatedState.wards.map(ward => ({
                  ...ward,
                  districts: ward.districts.map(d => {
                      if (d.id === reward.districtId) {
                          return {...d, incomeModifier: { multiplier: reward.multiplier, duration: reward.duration }};
                      }
                      return d;
                  })
              }));
              break;
          case 'RECRUIT_DEFECTOR':
              const newMember: GangMember = { ...reward.member, id: Date.now() };
              updatedState.gangMembers.push(newMember);
              break;
          case 'TRAIT_GAIN':
              updatedState.gangMembers = updatedState.gangMembers.map(m => {
                  if (reward.memberIds.includes(m.id)) {
                      const newTraits = [...(m.traits || []), reward.trait];
                      const uniqueTraits = newTraits.filter((trait, index, self) => 
                          index === self.findIndex((t) => (t.name === trait.name))
                      );
                      return { ...m, traits: uniqueTraits };
                  }
                  return m;
              });
              break;
      }
      return updatedState;
  }

    const handleResolveMastermindOp = useCallback((outcome: 'standard' | 'ability' | 'check', data: any) => {
        if (!resolvingMastermindOp) return;
        const { operation, memberIds } = resolvingMastermindOp;

        setGameState(prev => {
            if (!prev) return null;
            let updatedState = { ...prev };
            let updatedMastermind = { ...updatedState.mastermind };
            
            // Free up crew
            updatedState.gangMembers = updatedState.gangMembers.map(m => memberIds.includes(m.id) ? { ...m, status: 'Idle' } : m);
            
            let xpGained = 0;
            let message = '';
            
            switch(outcome) {
                case 'ability':
                    xpGained = operation.difficulty * 100 + 500; // Bonus XP
                    updatedMastermind.focus -= data.focusCost;
                    message = `Using ${data.skillName}, the operation "${operation.title}" succeeded with legendary finesse!`;
                    break;
                
                case 'check':
                    const { choice } = data;
                    const roll = Math.random() * 10;
                    const success = roll < updatedMastermind.attributes[choice.attribute];
                    
                    if (success) {
                        xpGained = operation.difficulty * 150; // Bonus XP for personal success
                        
                        // --- Attribute Growth on Critical Success ---
                        const attribute = choice.attribute;
                        const currentAttributeValue = updatedMastermind.attributes[attribute];
                        // Base 20% chance, decreasing by 1% for each existing point. Min 1% chance.
                        const attributeGainChance = Math.max(0.01, 0.20 - (currentAttributeValue * 0.01));
                        if (currentAttributeValue < 10 && Math.random() < attributeGainChance) {
                            updatedMastermind.attributes[attribute] += 1;
                            const capitalizedAttribute = attribute.charAt(0).toUpperCase() + attribute.slice(1);
                            logEvent(`Your masterful handling of the situation has sharpened your abilities. +1 ${capitalizedAttribute}!`, 'success', View.MASTERMIND);
                        }
                        // --- END ---

                        // FIX: Explicitly cast message to string to prevent potential type errors from 'any'.
                        message = String(choice.successMessage);
                    } else {
                        xpGained = operation.difficulty * 50; // Reduced XP for failure
                        // FIX: Explicitly cast message to string to prevent potential type errors from 'any'.
                        message = String(choice.failureMessage);
                    }
                    break;

                case 'standard':
                default:
                    xpGained = operation.difficulty * 100;
                    message = `The operation "${operation.title}" was completed successfully through standard tactics.`;
                    break;
            }

            // Apply XP and check for level up
            updatedMastermind.xp += xpGained;
            const nextLevelXp = updatedMastermind.level * 1000;
            if (updatedMastermind.xp >= nextLevelXp) {
                updatedMastermind.level += 1;
                updatedMastermind.xp -= nextLevelXp;
                updatedMastermind.skillPoints += 1;
                logEvent(`LEVEL UP! You have reached Level ${updatedMastermind.level}. You have gained a Skill Point!`, 'success', View.MASTERMIND);
            }
            updatedState.mastermind = updatedMastermind;
            
            logEvent(message, 'success'); // Assume all outcomes are narrative "successes" for now

            return updatedState;
        });
        
        setActiveOperations(prev => prev.filter(op => op.id !== operation.id));
        setResolvingMastermindOp(null);
    }, [resolvingMastermindOp, logEvent]);

  const handleStartIntelGathering = () => {
    if (!gameState) return;
    const cost = GAME_MECHANICS.GATHER_INTEL_COST * gameState.tier * getHeatCostModifier(gameState.heat);
    if (gameState.cash < cost) {
        logEvent(`Not enough cash to gather intel. Cost: $${cost.toLocaleString()}`, 'warning');
        return;
    }
    setIsAssigningIntel(true);
  };
  
  const handleConfirmIntelAssignment = (memberId: number) => {
    if (!gameState) return;
    
    setGameState(prev => {
        if (!prev) return null;
        const cost = GAME_MECHANICS.GATHER_INTEL_COST * prev.tier * getHeatCostModifier(prev.heat);
        let updatedState = { ...prev, cash: prev.cash - cost };
        updatedState = logTransaction(updatedState, { type: 'expense', category: 'Gather Intel', amount: cost });
        
        const completionTime = new Date(worldTime.getTime() + GAME_MECHANICS.GATHER_INTEL_DURATION_HOURS * 60 * 60 * 1000);
        const intelOp: ActiveOperation = {
            type: 'INTEL',
            id: `intel-${Date.now()}`,
            assignedMemberId: memberId,
            completionTime,
        };
        setActiveOperations(prevOps => [...prevOps, intelOp]);
        
        updatedState.gangMembers = updatedState.gangMembers.map(m => m.id === memberId ? { ...m, status: 'Gathering Intel' } : m);
        
        const memberName = updatedState.gangMembers.find(m => m.id === memberId)?.name || 'An operative';
        
        const notification: Notification = { id: Date.now(), message: `${memberName} has gone dark to find new leads...`, type: 'info' };
        const newEvent: GameEvent = {
            id: notification.id,
            timestamp: worldTime,
            message: notification.message,
            type: notification.type
        };

        const newLog = [newEvent, ...updatedState.eventLog];
        if (newLog.length > 100) newLog.pop();
        setNotifications(p => [notification, ...p]);
        
        return { ...updatedState, eventLog: newLog };
    });
    
    setIsAssigningIntel(false);
  };


  const handlePurchaseUpgrade = (upgrade: HqUpgrade) => {
    setGameState(prev => {
        if (!prev) return null;
        let cost = upgrade.cost;
        const skillTree = SKILL_TREES[prev.mastermind.class];
        const unlockedSkills = new Set(prev.mastermind.unlockedSkills);
        let costModifier = 1.0;

        for (const skill of skillTree) {
            if (unlockedSkills.has(skill.id) && skill.effect.type === 'COST_MODIFIER' && (skill.effect.category === 'HQ_UPGRADE' || skill.effect.category === 'CONSTRUCTION')) {
                costModifier += skill.effect.value; // e.g., value is -0.10
            }
        }
        cost *= costModifier;

        if (prev.cash >= cost && !upgrade.owned) {
            let updatedState = { ...prev, cash: prev.cash - cost, hqUpgrades: prev.hqUpgrades.map(u => u.id === upgrade.id ? { ...u, owned: true } : u) };
            updatedState = logTransaction(updatedState, { type: 'expense', category: 'HQ Upgrade', amount: cost });
            return updatedState;
        }
        return prev;
    });
  };

  const handleStartAssignment = (operation: Operation) => setAssigningOperation(operation);
  const handleCancelAssignment = () => setAssigningOperation(null);

  const handleConfirmAssignment = (operationId: string, memberIds: number[], finalReward: number, rewardModifier: number) => {
    const operation = operations.find(op => op.id === operationId);
    if (!operation || !gameState) return;

    if (operation.isTransportOperation) {
        const transportAmount = operation.transportAmount || 0;
        if (gameState.hqMoonshine < transportAmount) {
            logEvent('Not enough Moonshine at HQ to start transport.', 'warning');
            setAssigningOperation(null);
            return;
        }

        const assignedCrew = gameState.gangMembers.filter(m => memberIds.includes(m.id));
        const totalLogistics = assignedCrew.reduce((sum, m) => sum + m.skills.logistics, 0);
        const baseDurationMs = (transportAmount * 2) * 60 * 60 * 1000; // 2 hours per unit
        
        const skillTree = SKILL_TREES[gameState.mastermind.class];
        const unlockedSkills = new Set(gameState.mastermind.unlockedSkills);
        let speedModifier = 1.0;
        for (const skill of skillTree) {
            if (unlockedSkills.has(skill.id) && skill.effect.type === 'SPEED_MODIFIER' && skill.effect.category === 'TRANSPORT_OP') {
                speedModifier += skill.effect.value; // e.g. value is -0.20
            }
        }
        
        const durationModifier = Math.max(0.2, 1 - (totalLogistics * 0.05)) * speedModifier; // 5% faster per logistics point
        const finalDurationMs = baseDurationMs * durationModifier;
        const completionTime = new Date(worldTime.getTime() + finalDurationMs);

        const newTransportOp: ActiveOperation = {
            id: operation.id,
            type: 'TRANSPORT',
            destinationDistrictId: operation.targetDistrictId!,
            amount: transportAmount,
            assignedMemberIds: memberIds,
            startTime: worldTime,
            completionTime,
        };
        setActiveOperations(prev => [...prev, newTransportOp]);
        setGameState(prev => {
            if (!prev) return null;
            return {
                ...prev,
                hqMoonshine: prev.hqMoonshine - transportAmount,
                gangMembers: prev.gangMembers.map(m => memberIds.includes(m.id) ? { ...m, status: 'On Operation' } : m)
            };
        });
        
    } else {
        if (operation.difficulty === undefined || operation.heat === undefined) return;
        
        const skillTree = SKILL_TREES[gameState.mastermind.class];
        const unlockedSkills = new Set(gameState.mastermind.unlockedSkills);
        let speedModifier = 1.0;
        const isMilitaryOp = operation.requiredSkills.includes('Combat') || operation.isTakeoverOperation;

        for (const skill of skillTree) {
            if (unlockedSkills.has(skill.id) && skill.effect.type === 'SPEED_MODIFIER') {
                if (skill.effect.category === 'ALL_OPS') {
                    speedModifier += skill.effect.value;
                }
                if (isMilitaryOp && skill.effect.category === 'MILITARY_OPS') {
                     speedModifier += skill.effect.value;
                }
            }
        }

        const baseDurationMs = operation.difficulty * 3 * 60 * 60 * 1000;
        const finalDurationMs = (baseDurationMs / rewardModifier) * speedModifier;
        const completionTime = new Date(worldTime.getTime() + finalDurationMs);

        const newActiveOp: ActiveOperation = {
            ...operation,
            reward: finalReward,
            type: 'REGULAR',
            assignedMemberIds: memberIds,
            startTime: worldTime,
            completionTime,
            rewardModifier,
            difficulty: operation.difficulty,
            heat: operation.heat
        };
        setActiveOperations(prev => [...prev, newActiveOp]);

        setGameState(prev => {
            if (!prev) return null;
            return { ...prev, gangMembers: prev.gangMembers.map(m => memberIds.includes(m.id) ? { ...m, status: 'On Operation' } : m) };
        });
    }

    setOperations(prevOps => prevOps.filter(op => op.id !== operationId));
    setAssigningOperation(null);
  };

  const handlePursueLieutenant = (lieutenant: Lieutenant) => {
    if (!gameState) return;
    const cost = GAME_MECHANICS.LIEUTENANT_PURSUE_COST * gameState.tier * getHeatCostModifier(gameState.heat);
    if (gameState.cash < cost) {
        logEvent(`Not enough cash to pursue this lead. Cost: $${cost.toLocaleString()}`, 'warning');
        return;
    }
    
    setGameState(prev => {
      if(!prev) return null;
      let updatedState = { ...prev, cash: prev.cash - cost };
      updatedState = logTransaction(updatedState, { type: 'expense', category: 'Pursue Lieutenant', amount: cost });
      
      const notification: Notification = { id: Date.now(), message: `A high-stakes operation to recruit ${lieutenant.name} is now on the board.`, type: 'info', relatedView: View.OPERATIONS };
      const newEvent: GameEvent = {
          id: notification.id,
          timestamp: worldTime,
          message: notification.message,
          type: notification.type
      };

      const newLog = [newEvent, ...updatedState.eventLog];
      if (newLog.length > 100) newLog.pop();
      setNotifications(p => [notification, ...p]);

      return { ...updatedState, eventLog: newLog };
    });

    const totalSkills = Object.values(lieutenant.skills).reduce((sum, val) => sum + Number(val), 0);
    const newOp: Operation = {
        id: `lt-op-${lieutenant.id}`,
        title: `Pursue the Legendary ${lieutenant.role}: ${lieutenant.name}`,
        description: lieutenant.discoveryHook,
        requiredSkills: ['Combat', 'Cunning', 'Influence'], // Legendary ops require all top skills
        difficulty: Math.max(9, Math.min(10, Math.round(totalSkills / 5))),
        reward: 0,
        heat: 40,
        isLieutenantMission: true,
        lieutenantId: lieutenant.id,
    };

    setOperations(prev => [newOp, ...prev]);
  };

  const handleSetAssignment = (memberId: number, assignment: GangMember['assignment'] | null) => {
    setGameState(prev => {
        if (!prev) return null;
        return { ...prev, gangMembers: prev.gangMembers.map(m => {
            if (m.id === memberId) {
                const newStatus = assignment ? (assignment.type === 'training' ? 'Training' : 'Idle') : 'Idle';
                return { ...m, assignment: assignment || undefined, status: newStatus };
            }
            return m;
        })};
    });
  };

  const handleStartScouting = (districtId: number, memberId: number) => {
    if (!gameState) return;
    const cost = GAME_MECHANICS.SCOUTING_COST * gameState.tier * getHeatCostModifier(gameState.heat);
    if (gameState.cash < cost) {
      logEvent(`Not enough cash to start scouting ($${cost.toLocaleString()} required).`, 'warning');
      return;
    }
    setGameState(prev => {
        if (!prev) return null;
        let updatedState = { ...prev, cash: prev.cash - cost };
        updatedState = logTransaction(updatedState, { type: 'expense', category: 'Scouting', amount: cost });
        
        const completionTime = new Date(worldTime.getTime() + GAME_MECHANICS.SCOUTING_DURATION_HOURS * 60 * 60 * 1000);
        const scoutingOp: ActiveOperation = {
          type: 'SCOUTING',
          id: `scouting-${districtId}-${Date.now()}`,
          districtId,
          completionTime,
          assignedMemberIds: [memberId]
        };
        setActiveOperations(prevOps => [...prevOps, scoutingOp]);
        
        updatedState.gangMembers = updatedState.gangMembers.map(m => m.id === memberId ? { ...m, status: 'On Operation'} : m);
        return updatedState;
    });
  };

  const handleHireRecruit = (districtId: number, recruit: PotentialRecruit) => {
    if (!gameState || gameState.cash < recruit.hiringFee) {
      logEvent("Not enough cash to hire this recruit.", 'warning');
      return;
    }
    
    const { hiringFee, rarity, backstoryHook, ...baseRecruit } = recruit;
    const newMember: GangMember = {
      ...baseRecruit,
      id: Date.now(),
      loyalty: 70, 
      status: 'Idle',
    };

    setGameState(prev => {
      if (!prev) return null;
      const updatedRecruits = { ...prev.potentialRecruits };
      updatedRecruits[districtId] = updatedRecruits[districtId].filter(r => r.name !== recruit.name);

      let updatedState = {
        ...prev,
        cash: prev.cash - hiringFee,
        gangMembers: [...prev.gangMembers, newMember],
        potentialRecruits: updatedRecruits
      };
      updatedState = logTransaction(updatedState, { type: 'expense', category: 'Recruitment', amount: hiringFee });
      return updatedState;
    });
  };

  const handleInitiateTakeover = (district: District) => {
    if (!gameState) return;
    let cost = district.controlledBy === 'neutral' ? GAME_MECHANICS.TAKEOVER_COST_NEUTRAL : GAME_MECHANICS.TAKEOVER_COST_RIVAL;
    
    const skillTree = SKILL_TREES[gameState.mastermind.class];
    const unlockedSkills = new Set(gameState.mastermind.unlockedSkills);
    let costModifier = 1.0;
    for (const skill of skillTree) {
        if (unlockedSkills.has(skill.id) && skill.effect.type === 'COST_MODIFIER' && skill.effect.category === 'TAKEOVER_OP') {
            costModifier += skill.effect.value;
        }
    }
    cost *= costModifier;
    cost *= getHeatCostModifier(gameState.heat);
    cost *= gameState.tier;
    cost = Math.round(cost);

    if (gameState.cash < cost) {
        logEvent(`Not enough cash to launch a takeover operation. Cost: $${cost.toLocaleString()}`, 'warning');
        return;
    }

    setGameState(prev => {
        if (!prev) return null;
        let updatedState = { ...prev, cash: prev.cash - cost };
        updatedState = logTransaction(updatedState, { type: 'expense', category: 'Takeover Operation', amount: cost });

        const notification: Notification = { id: Date.now(), message: `A takeover operation for ${district.name} is now available.`, type: 'info', relatedView: View.OPERATIONS };
        const newEvent: GameEvent = {
            id: notification.id,
            timestamp: worldTime,
            message: notification.message,
            type: notification.type
        };
        const newLog = [newEvent, ...updatedState.eventLog];
        if (newLog.length > 100) newLog.pop();
        setNotifications(p => [notification, ...p]);

        return { ...updatedState, eventLog: newLog };
    });

    const newOp: Operation = {
        id: `takeover-${district.id}-${Date.now()}`,
        title: `Takeover: ${district.name}`,
        description: `Launch a full-scale operation to seize control of ${district.name} from the current occupants.`,
        requiredSkills: ['Combat', 'Cunning'],
        difficulty: (district.controlledBy === 'neutral' ? 5 : 8) + Math.floor(district.fortification / 10),
        reward: 0,
        heat: 25,
        isTakeoverOperation: true,
        targetDistrictId: district.id,
    };

    setOperations(prev => [newOp, ...prev]);
  };

  const handleLaunchAttack = (district: District) => {
    const attackOp = operations.find(op => op.isTakeoverOperation && op.targetDistrictId === district.id);
    if (attackOp) {
        handleStartAssignment(attackOp);
        setSelectedDistrict(null);
    } else {
        logEvent(`Could not find a takeover operation for ${district.name}.`, 'warning');
    }
  };

  const handleLaunchDefense = (district: District) => {
    const defenseOp = operations.find(op => op.isCounterOperation && op.targetDistrictId === district.id);
    if (defenseOp) {
        handleStartAssignment(defenseOp);
    } else {
        logEvent(`Could not find a defense operation for ${district.name}.`, 'warning');
    }
    setSelectedDistrict(null);
  };
  
  const handleFortifyDistrict = (district: District) => {
    if (!gameState) return;
    
    let cost = district.strategicValue * 100;
    const skillTree = SKILL_TREES[gameState.mastermind.class];
    const unlockedSkills = new Set(gameState.mastermind.unlockedSkills);
    let costModifier = 1.0;
    for (const skill of skillTree) {
        if (unlockedSkills.has(skill.id) && skill.effect.type === 'COST_MODIFIER' && skill.effect.category === 'FORTIFICATION') {
            costModifier += skill.effect.value;
        }
    }
    cost *= costModifier;
    cost = Math.round(cost);

    if (gameState.cash < cost) {
        logEvent(`Not enough cash to fortify. Cost: $${cost.toLocaleString()}`, 'warning');
        return;
    }
    
    setGameState(prev => {
        if (!prev) return null;
        const fortifyAmount = 10;
        let updatedState = { ...prev, cash: prev.cash - cost };
        updatedState.wards = updatedState.wards.map(w => ({
            ...w,
            districts: w.districts.map(d => {
                if (d.id === district.id) {
                    return { ...d, fortification: Math.min(100, d.fortification + fortifyAmount) };
                }
                return d;
            })
        }));
        // Update selected district to show new value immediately
        setSelectedDistrict(d => d ? { ...d, fortification: Math.min(100, d.fortification + fortifyAmount) } : null);
        updatedState = logTransaction(updatedState, { type: 'expense', category: 'Fortification', amount: cost });

        const notification: Notification = { id: Date.now(), message: `${district.name} has been fortified, increasing its defense.`, type: 'success' };
        const newEvent: GameEvent = {
            id: notification.id,
            timestamp: worldTime,
            message: notification.message,
            type: 'success'
        };
        
        const newLog = [newEvent, ...updatedState.eventLog];
        if (newLog.length > 100) newLog.pop();
        setNotifications(p => [notification, ...p]);

        return { ...updatedState, eventLog: newLog };
    });
  };
  
    const handleBuildHideoutModule = (district: District, moduleId: string) => {
        if (!gameState) return;
        const moduleInfo = HIDEOUT_MODULES.find(m => m.id === moduleId);
        if (!moduleInfo) return;
        
        let cost = moduleInfo.cost;
        const skillTree = SKILL_TREES[gameState.mastermind.class];
        const unlockedSkills = new Set(gameState.mastermind.unlockedSkills);
        let costModifier = 1.0;
        for (const skill of skillTree) {
            if (unlockedSkills.has(skill.id) && skill.effect.type === 'COST_MODIFIER' && (skill.effect.category === 'HIDEOUT_MODULE' || skill.effect.category === 'CONSTRUCTION')) {
                costModifier += skill.effect.value;
            }
        }
        cost *= costModifier;

        if (gameState.cash < cost) {
            logEvent(`Not enough cash to build the ${moduleInfo.name}.`, 'warning');
            return;
        }

        if (moduleInfo.requiredSkill && !gameState.mastermind.unlockedSkills.includes(moduleInfo.requiredSkill)) {
            logEvent(`You lack the required Mastermind skill to build this module.`, 'warning');
            return;
        }

        setGameState(prev => {
            if (!prev) return null;
            let updatedState = { ...prev, cash: prev.cash - cost };
            updatedState.wards = updatedState.wards.map(w => ({
                ...w,
                districts: w.districts.map(d => {
                    if (d.id === district.id) {
                        return { ...d, hideoutModules: [...d.hideoutModules, moduleId] };
                    }
                    return d;
                })
            }));
            setSelectedDistrict(d => d ? { ...d, hideoutModules: [...d.hideoutModules, moduleId] } : null);
            updatedState = logTransaction(updatedState, { type: 'expense', category: 'Hideout Construction', amount: cost });
            
            const notification: Notification = { id: Date.now(), message: `Successfully built ${moduleInfo.name} in ${district.name}!`, type: 'success' };
            const newEvent: GameEvent = {
                id: notification.id,
                timestamp: worldTime,
                message: notification.message,
                type: 'success'
            };

            const newLog = [newEvent, ...updatedState.eventLog];
            if (newLog.length > 100) newLog.pop();
            setNotifications(p => [notification, ...p]);

            return { ...updatedState, eventLog: newLog };
        });
    };

    const handleUpgradeWarehouse = (district: District) => {
        if (!gameState) return;

        const currentLevel = district.warehouse?.level || 0;
        const nextLevelInfo = WAREHOUSE_LEVELS[currentLevel + 1];

        if (!nextLevelInfo || nextLevelInfo.upgradeCost === 0) {
            logEvent(`Warehouse in ${district.name} is already at maximum level.`, 'info');
            return;
        }

        if (gameState.cash < nextLevelInfo.upgradeCost) {
            logEvent(`Not enough cash to upgrade the warehouse in ${district.name}.`, 'warning');
            return;
        }

        setGameState(prev => {
            if (!prev) return null;

            let updatedState = { ...prev, cash: prev.cash - nextLevelInfo.upgradeCost };
            updatedState.wards = updatedState.wards.map(w => ({
                ...w,
                districts: w.districts.map(d => {
                    if (d.id === district.id) {
                        return { ...d, warehouse: { level: currentLevel + 1 } };
                    }
                    return d;
                })
            }));

            setSelectedDistrict(prevDistrict => {
                if (!prevDistrict || prevDistrict.id !== district.id) return prevDistrict;
                return { ...prevDistrict, warehouse: { level: currentLevel + 1 } };
            });

            updatedState = logTransaction(updatedState, { type: 'expense', category: `Warehouse Upgrade (${district.name})`, amount: nextLevelInfo.upgradeCost });

            const message = `Successfully ${currentLevel === 0 ? 'built' : 'upgraded'} the warehouse in ${district.name}!`;
            const notification: Notification = { id: Date.now(), message, type: 'success' };
            const newEvent: GameEvent = { id: notification.id, timestamp: worldTime, message, type: 'success' };

            const newLog = [newEvent, ...updatedState.eventLog];
            if (newLog.length > 100) newLog.pop();
            setNotifications(p => [notification, ...p]);

            return { ...updatedState, eventLog: newLog };
        });
    };

    const handleInitiateTransport = (district: District, amount: number) => {
        if (!gameState || gameState.hqMoonshine < amount) {
            logEvent('Not enough Moonshine at HQ for this transport run.', 'warning');
            return;
        }

        const newOp: Operation = {
            id: `transport-${district.id}-${Date.now()}`,
            title: `Transport Moonshine to ${district.name}`,
            description: `Move ${amount} units of freshly distilled Moonshine from the HQ to the warehouse in ${district.name} for distribution.`,
            requiredSkills: ['Logistics'],
            isTransportOperation: true,
            targetDistrictId: district.id,
            transportAmount: amount,
            difficulty: 5, // Base difficulty for calculation
            reward: 0,
            heat: 1,
        };
        handleStartAssignment(newOp);
        setSelectedDistrict(null);
    };

  const handleBribePolice = () => {
    if (!gameState) return;
    const cost = GAME_MECHANICS.BRIBE_COST * gameState.tier;
    const cooldownMs = GAME_MECHANICS.BRIBE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    
    if (gameState.lastBribeTimestamp && (worldTime.getTime() - new Date(gameState.lastBribeTimestamp).getTime() < cooldownMs)) {
        logEvent('Your contacts need time to cool off. You can bribe the police again soon.', 'warning');
        return;
    }

    if (gameState.cash < cost) {
        logEvent(`Not enough cash to bribe the police. Cost: $${cost.toLocaleString()}`, 'warning');
        return;
    }

    setGameState(prev => {
        if (!prev) return null;
        
        const skillTree = SKILL_TREES[prev.mastermind.class];
        const unlockedSkills = new Set(prev.mastermind.unlockedSkills);
        let effectivenessModifier = 1.0;
        for (const skill of skillTree) {
            if (unlockedSkills.has(skill.id) && skill.effect.type === 'EFFECT_MODIFIER' && skill.effect.category === 'BRIBE') {
                effectivenessModifier += skill.effect.value;
            }
        }
        
        let updatedState: GameState = {
            ...prev,
            cash: prev.cash - cost,
            heat: Math.max(0, prev.heat - (GAME_MECHANICS.BRIBE_HEAT_REDUCTION * effectivenessModifier)),
            investigationProgress: Math.max(0, prev.investigationProgress - (GAME_MECHANICS.BRIBE_INVESTIGATION_REDUCTION * effectivenessModifier)),
            lastBribeTimestamp: worldTime,
        };
        updatedState = logTransaction(updatedState, { type: 'expense', category: 'Police Bribe', amount: cost });
        
        const message = `Your "donation" of $${cost.toLocaleString()} to the Police Benevolent Fund has been well received. Heat and Investigation Progress reduced.`;
        const notification: Notification = { id: Date.now(), message, type: 'success' };
        const newEvent: GameEvent = {
            id: notification.id,
            timestamp: worldTime,
            message,
            type: 'success'
        };
        
        const newLog = [newEvent, ...updatedState.eventLog];
        if (newLog.length > 100) newLog.pop();
        setNotifications(p => [notification, ...p]);
        
        return { ...updatedState, eventLog: newLog };
    });
  };

  const handleMapActivityClick = (activityId: number) => {
    setGameState(prev => {
        if (!prev) return null;
        const activity = prev.mapActivities.find(a => a.id === activityId);
        if (!activity) return prev;

        let updatedState = { ...prev };
        const district = updatedState.wards.flatMap(w => w.districts).find(d => d.id === activity.districtId);
        let notification: Notification | null = null;
        let eventMessage = '';
        let eventType: Notification['type'] = 'info';

        if (activity.type === 'cash' && district) {
            const amount = 500 + Math.floor(Math.random() * 1500 * (district.strategicValue / 50));
            updatedState.cash += amount;
            updatedState = logTransaction(updatedState, { type: 'income', category: 'Map Activity', amount });
            eventMessage = `You found a hidden stash of $${amount.toLocaleString()}!`;
            eventType = 'success';
        } else if (activity.type === 'influence') {
            if (district && district.controlledBy === 'neutral') {
                const influenceGained = 10 + Math.floor(Math.random() * 11);
                updatedState.wards = updatedState.wards.map(w => ({
                    ...w,
                    districts: w.districts.map(d => {
                        if (d.id === activity.districtId) {
                            return { ...d, playerInfluence: Math.min(100, d.playerInfluence + influenceGained) };
                        }
                        return d;
                    })
                }));
                 eventMessage = `Your presence in ${district.name} has been noted, gaining you ${influenceGained} influence.`;
                 eventType = 'info';
            }
        }
        
        updatedState.mapActivities = updatedState.mapActivities.filter(a => a.id !== activityId);
        
        if (eventMessage) {
          notification = { id: Date.now(), message: eventMessage, type: eventType };
          setNotifications(p => [notification, ...p]);
          const newEvent: GameEvent = {
              id: notification.id,
              timestamp: worldTime,
              message: eventMessage,
              type: eventType
          };
          const newLog = [newEvent, ...updatedState.eventLog];
          if (newLog.length > 100) newLog.pop();
          updatedState.eventLog = newLog;
        }

        return updatedState;
    });
  };

    const handleUnlockSkill = (skillId: string) => {
        setGameState(prev => {
            if (!prev) return null;
            const { mastermind } = prev;
            const skillTree = SKILL_TREES[mastermind.class];
            const skillToUnlock = skillTree.find(s => s.id === skillId);

            if (!skillToUnlock || mastermind.skillPoints < skillToUnlock.cost) {
                logEvent("Cannot unlock skill.", 'warning');
                return prev;
            }
            if (mastermind.unlockedSkills.includes(skillId)) {
                return prev; // Already unlocked
            }
            const prerequisitesMet = skillToUnlock.prerequisites.every(p => mastermind.unlockedSkills.includes(p));
            if (!prerequisitesMet) {
                logEvent("Prerequisites not met.", 'warning');
                return prev;
            }

            let newMastermind = {
                ...mastermind,
                skillPoints: mastermind.skillPoints - skillToUnlock.cost,
                unlockedSkills: [...mastermind.unlockedSkills, skillId],
            };
            
            // Apply immediate effects like stat boosts
            if (skillToUnlock.effect.type === 'STAT_BOOST' && skillToUnlock.effect.subtype) {
                const attribute = skillToUnlock.effect.subtype;
                newMastermind.attributes[attribute] = Math.min(10, newMastermind.attributes[attribute] + skillToUnlock.effect.value);
            }

            let updatedState = { ...prev, mastermind: newMastermind };
            
            const message = `Skill Unlocked: ${skillToUnlock.name}!`;
            const notification: Notification = { id: Date.now(), message, type: 'success' };
            const newEvent: GameEvent = {
                id: notification.id,
                timestamp: worldTime,
                message,
                type: 'success'
            };
            const newLog = [newEvent, ...updatedState.eventLog];
            if (newLog.length > 100) newLog.pop();
            setNotifications(p => [notification, ...p]);

            return { ...updatedState, eventLog: newLog };
        });
    };

    const handleActivateHqAction = useCallback((actionId: string, upgradeId: number) => {
      setGameState(prev => {
        if (!prev) return null;
    
        const upgrade = prev.hqUpgrades.find(u => u.id === upgradeId);
        if (!upgrade || !upgrade.lieutenantSlot) return prev;
        const action = upgrade.lieutenantSlot.unlocks.find(a => a.id === actionId);
        if (!action) return prev;
    
        const cooldownEnd = new Date(worldTime.getTime() + action.cooldownDays * 24 * 60 * 60 * 1000);
        
        let updatedState = { ...prev };
        updatedState.hqActionCooldowns = { ...prev.hqActionCooldowns, [actionId]: cooldownEnd };
    
        switch (actionId) {
          case 'drill_troops': {
            const drillExpiration = new Date(worldTime.getTime() + 24 * 60 * 60 * 1000);
            updatedState.activeHqBuffs = [...(prev.activeHqBuffs || []).filter(b => b.buffId !== 'drill_troops'), { buffId: 'drill_troops', expirationTime: drillExpiration }];
            logEvent('Drill Troops activated! Your crew will gain double XP from combat operations for 24 hours.', 'success');
            break;
          }
          case 'fortify_defenses': {
            const fortifyExpiration = new Date(worldTime.getTime() + 3 * 24 * 60 * 60 * 1000);
            updatedState.wards = prev.wards.map(w => ({
                ...w,
                districts: w.districts.map(d => 
                    d.controlledBy === 'player'
                    ? { ...d, temporaryFortification: { amount: 20, expirationTime: fortifyExpiration } }
                    : d
                )
            }));
            logEvent('Fortify Defenses activated! All your districts gain +20 fortification for 3 days.', 'success');
            break;
          }
          case 'city_wide_blackout': {
            const blackoutExpiration = new Date(worldTime.getTime() + 12 * 60 * 60 * 1000);
            updatedState.blackoutUntil = blackoutExpiration;
            logEvent('City-Wide Blackout activated! Rival operations are halted for 12 hours.', 'success');
            break;
          }
        }
    
        return updatedState;
      });
    }, [worldTime, logEvent]);

  const handleNotificationClick = (notification: Notification) => {
    if (notification.relatedView) {
      setCurrentView(notification.relatedView);
    }
  };
  
  const renderView = () => {
    if (!gameState) return null;
    const allDistricts = gameState.wards.flatMap(w => w.districts);

    switch (currentView) {
      case View.MAP:
        return <MapView 
                  wards={gameState.wards} 
                  factions={gameState.factions} 
                  rivalOperations={gameState.rivalOperations}
                  activePlayerOperations={activeOperations.filter(op => op.type === 'REGULAR') as Extract<ActiveOperation, {type: 'REGULAR'}>[]}
                  activeTransportOperations={activeOperations.filter(op => op.type === 'TRANSPORT') as Extract<ActiveOperation, {type: 'TRANSPORT'}>[]}
                  worldTime={worldTime}
                  onDistrictClick={setSelectedDistrict}
                  heat={gameState.heat}
                  investigationProgress={gameState.investigationProgress}
                  mapConnections={gameState.mapConnections}
                  mapBackgroundUrl={gameState.mapBackgroundUrl}
                  mapActivities={gameState.mapActivities}
                  onMapActivityClick={handleMapActivityClick}
                />;
      case View.GANG:
        return <GangView gangMembers={gameState.gangMembers} districts={allDistricts.filter(d => d.controlledBy === 'player' || d.controlledBy === 'neutral')} hqUpgrades={gameState.hqUpgrades} onSetAssignment={handleSetAssignment} />;
      case View.OPERATIONS:
        return <OperationsView operations={operations} activeOperations={activeOperations} gangMembers={gameState.gangMembers} rivalOperations={gameState.rivalOperations} worldTime={worldTime} onStartIntelGathering={handleStartIntelGathering} isLoading={isLoadingOps} error={error} onStartAssign={handleStartAssignment} tier={gameState.tier} heat={gameState.heat} />;
      case View.HQ:
        return <HqView 
                  upgrades={gameState.hqUpgrades} 
                  onPurchase={handlePurchaseUpgrade} 
                  playerCash={gameState.cash} 
                  gangMembers={gameState.gangMembers} 
                  onSetAssignment={handleSetAssignment} 
                  onBribe={handleBribePolice} 
                  lastBribeTimestamp={gameState.lastBribeTimestamp}
                  worldTime={worldTime}
                  hqMoonshine={gameState.hqMoonshine}
                  mastermind={gameState.mastermind}
                  onActivateHqAction={handleActivateHqAction}
                  hqActionCooldowns={gameState.hqActionCooldowns}
                  tier={gameState.tier}
                />;
      case View.LIEUTENANTS:
        return <LieutenantsView lieutenants={gameState.lieutenants} onPursue={handlePursueLieutenant} playerCash={gameState.cash} heat={gameState.heat} tier={gameState.tier} />;
      case View.RECRUITMENT:
        return <RecruitmentView 
                  districts={allDistricts.filter(d => d.controlledBy === 'player')} 
                  potentialRecruits={gameState.potentialRecruits}
                  onStartScouting={handleStartScouting}
                  onHire={handleHireRecruit}
                  gangMembers={gameState.gangMembers}
                  activeScoutingOps={activeOperations.filter(op => op.type === 'SCOUTING') as Extract<ActiveOperation, {type: 'SCOUTING'}>[]}
                  worldTime={worldTime}
                  districtRecruitPools={gameState.districtRecruitPools}
                  heat={gameState.heat}
                  tier={gameState.tier}
                />;
      case View.FINANCE:
        return <FinanceView gameState={gameState} worldTime={worldTime} />;
      case View.MASTERMIND:
        return <MastermindView mastermind={gameState.mastermind} onUnlockSkill={handleUnlockSkill} />;
      default:
        return <HqView 
                  upgrades={gameState.hqUpgrades} 
                  onPurchase={handlePurchaseUpgrade} 
                  playerCash={gameState.cash} 
                  gangMembers={gameState.gangMembers} 
                  onSetAssignment={handleSetAssignment} 
                  onBribe={handleBribePolice} 
                  lastBribeTimestamp={gameState.lastBribeTimestamp}
                  worldTime={worldTime}
                  hqMoonshine={gameState.hqMoonshine}
                  mastermind={gameState.mastermind}
                  onActivateHqAction={handleActivateHqAction}
                  hqActionCooldowns={gameState.hqActionCooldowns}
                  tier={gameState.tier}
               />;
    }
  };

  const navItems = [
    { view: View.HQ, label: 'Headquarters', icon: <HomeIcon /> },
    { view: View.MASTERMIND, label: 'Mastermind', icon: <CrownIcon /> },
    { view: View.GANG, label: 'Gang', icon: <UsersIcon /> },
    { view: View.OPERATIONS, label: 'Operations', icon: <BriefcaseIcon /> },
    { view: View.FINANCE, label: 'Finance', icon: <PieChartIcon /> },
    { view: View.LIEUTENANTS, label: 'Lieutenants', icon: <StarIcon /> },
    { view: View.RECRUITMENT, label: 'Recruitment', icon: <SearchIcon /> },
    { view: View.MAP, label: 'City Map', icon: <MapIcon /> },
  ];

  if (!gameState) {
    // This should ideally not be reached if Root component manages state correctly
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-[#1a1a1a] text-gray-200 min-h-screen">
      <div className="fixed inset-0 bg-cover bg-center opacity-20" style={{backgroundImage: `url('${gameState.mapBackgroundUrl}')`}}></div>
      <NotificationLog 
        notifications={notifications} 
        onClear={id => setNotifications(prev => prev.filter(n => n.id !== id))}
        onClearAll={() => setNotifications([])}
        onClick={handleNotificationClick} 
      />
      <div className="relative z-10">
        <Header 
            cash={gameState.cash} 
            heat={Math.round(gameState.heat)} 
            worldTime={worldTime} 
            cashFlow={gameState.cashFlow} 
            heatTrend={gameState.heatTrend}
            tier={gameState.tier}
            totalEarnings={gameState.totalEarnings}
            investigationProgress={gameState.investigationProgress}
            onToggleEventLog={() => setIsEventLogVisible(v => !v)}
            onSaveGame={handleSaveGame}
        />
        <main className="p-4 md:p-8 max-w-7xl mx-auto">
          <div className="bg-black/40 border border-yellow-800/30 rounded-lg p-4 mb-2 text-center shadow-lg">
            <p className="text-yellow-200/90 italic">{gameState.storyline}</p>
          </div>
          {gameState.economicClimate && <EconomicClimateDisplay economicClimate={gameState.economicClimate} />}
          <WorldEventsDisplay worldEvents={gameState.worldEvents} />
          <nav className="mb-6 bg-black/30 backdrop-blur-sm rounded-lg p-2 flex items-center justify-center space-x-1 md:space-x-2 border border-yellow-800/50 shadow-lg">
            {navItems.map(item => (
              <button key={item.view} onClick={() => setCurrentView(item.view)} className={`flex items-center space-x-2 px-2 py-2 text-xs md:px-4 md:text-base font-medium rounded-md transition-all duration-300 ${ currentView === item.view ? 'bg-yellow-600 text-black shadow-md' : 'text-yellow-300 hover:bg-yellow-800/50' }`} >
                {item.icon}
                <span className="hidden md:inline">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="bg-black/20 backdrop-blur-sm border border-yellow-900/60 rounded-xl shadow-2xl p-4 md:p-6 min-h-[70vh]">
            {renderView()}
          </div>
        </main>
      </div>
      {assigningOperation && (
        <AssignCrewModal operation={assigningOperation} gangMembers={gameState.gangMembers} onConfirm={handleConfirmAssignment} onCancel={handleCancelAssignment} />
      )}
       {isAssigningIntel && (
        <AssignIntelModal 
            gangMembers={gameState.gangMembers}
            onConfirm={handleConfirmIntelAssignment}
            onCancel={() => setIsAssigningIntel(false)}
        />
      )}
      {selectedDistrict && gameState && (
        <DistrictDetailModal 
            district={selectedDistrict}
            factions={gameState.factions}
            rivalOperations={gameState.rivalOperations}
            operations={operations}
            worldTime={worldTime}
            onClose={() => setSelectedDistrict(null)}
            onInitiateTakeover={handleInitiateTakeover}
            onLaunchAttack={handleLaunchAttack}
            onLaunchDefense={handleLaunchDefense}
            onFortify={handleFortifyDistrict}
            playerCash={gameState.cash}
            gangMembers={gameState.gangMembers}
            onBuildHideoutModule={handleBuildHideoutModule}
            onSetAssignment={handleSetAssignment}
            onUpgradeWarehouse={handleUpgradeWarehouse}
            onInitiateTransport={handleInitiateTransport}
            districtMoonshine={gameState.districtMoonshine[selectedDistrict.id] || 0}
            hqMoonshine={gameState.hqMoonshine}
            wards={gameState.wards}
            mapConnections={gameState.mapConnections}
            mastermind={gameState.mastermind}
        />
      )}
      {isEventLogVisible && gameState && (
        <EventLogModal events={gameState.eventLog} onClose={() => setIsEventLogVisible(false)} />
      )}
      {resolvingMastermindOp && gameState && (
        <MastermindOperationModal
            activeOp={resolvingMastermindOp}
            mastermind={gameState.mastermind}
            onResolve={handleResolveMastermindOp}
            onCancel={() => handleResolveMastermindOp('standard', {})}
        />
      )}
      <TokenCountDisplay usage={gameState.lastTokenUsage} />
    </div>
  );
};
