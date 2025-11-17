

export interface UsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

export enum View {
  MAP = 'MAP',
  GANG = 'GANG',
  OPERATIONS = 'OPERATIONS',
  HQ = 'HQ',
  LIEUTENANTS = 'LIEUTENANTS',
  RECRUITMENT = 'RECRUITMENT',
  FINANCE = 'FINANCE',
  MASTERMIND = 'MASTERMIND',
}

// Factions & Control
export interface Faction {
  id: string;
  name: string;
  color: string;
}

export interface RivalFaction extends Faction {
  description: string;
  persona: string;
  preferredOps: string[];
  strengths: string[];
  weaknesses: string[];
  startingRelations: { factionId: string; relation: string }[];
  initialTerritories: string[];
  aiProfile: {
    expansionism: number;
    covertOps: number;
    influenceFocus: number;
  };
  cash: number;
  strategy: 'Aggressive' | 'Economic' | string;
  heat: number;
}

// City & Map
export interface Ward {
    id: string;
    name: string;
    districts: District[];
    svgPath?: string;
}

export interface District {
    id: number;
    name: string;
    type: 'Docks' | 'Industrial' | 'Slums' | 'Entertainment' | 'Financial' | 'Residential' | 'port' | 'mixed';
    controlledBy: string; // 'player', 'neutral', or faction id
    heat: number;
    resource: string;
    baseIncome: number;
    playerInfluence: number;
    fortification: number;
    strategicValue: number;
    landmark?: Landmark;
    takeoverCooldownUntil?: Date;
    hideoutModules: string[];
    warehouse?: { level: number };
    incomeModifier?: { multiplier: number, duration: number }; // hours
    temporaryFortification?: { amount: number; expirationTime: Date };
    svgPath?: string;
    centroid?: [number, number];
}

export interface Landmark {
    name: string;
    description: string;
    effect: {
        type: 'GLOBAL_INCOME_MOD' | 'GLOBAL_HEAT_REDUCTION';
        value: number;
    };
    effectHint?: string;
}

export interface MapActivity {
  id: number;
  districtId: number;
  type: 'cash' | 'influence';
  spawnTime: Date;
}

// Gang & Members
export interface GangMember {
  id: number;
  name: string;
  role: string;
  skills: {
    combat: number;
    cunning: number;
    influence: number;
    logistics: number;
    production: number;
  };
  status: 'Idle' | 'On Operation' | 'Wounded' | 'Training' | 'Gathering Intel';
  loyalty: number | 'infinity';
  recoveryTime?: number; // hours
  assignment?: { type: 'district'; districtId: number } | { type: 'hq'; upgradeId: number } | { type: 'hideout', districtId: number } | { type: 'training', skill: keyof GangMember['skills'], progress: number };
  traits?: Trait[];
  isLieutenant?: boolean;
  archetype?: MastermindClass;
}

export interface Trait {
  name: string;
  description: string;
  effect: string;
}

export interface PotentialRecruit extends Omit<GangMember, 'id' | 'loyalty' | 'status' | 'recoveryTime' | 'assignment'> {
  hiringFee: number;
  rarity: 'common' | 'uncommon' | 'rare';
  backstoryHook: string;
}

export interface Lieutenant {
    id: string;
    name: string;
    role: string;
    archetype: MastermindClass;
    personality: string;
    uniqueAbilities: {
        id: string;
        name: string;
        effectHint: string;
        power: number;
    }[];
    loyaltyProfile: {
        baseLoyalty: number;
        triggersIncrease: string[];
        triggersDecrease: string[];
    };
    discoveryHook: string;
    skills: GangMember['skills'];
}

export type MastermindClass = 'Warlord' | 'Spymaster' | 'Industrialist';

export interface Mastermind {
  class: MastermindClass;
  xp: number;
  level: number;
  attributes: {
    strength: number;
    cunning: number;
    charisma: number;
  };
  skillPoints: number;
  unlockedSkills: string[];
  focus: number;
  maxFocus: number;
}

export interface SkillEffect {
  type: 'COST_MODIFIER' | 'SPEED_MODIFIER' | 'HEAT_MODIFIER' | 'INCOME_MODIFIER' | 'PRODUCTION_MODIFIER' | 'EFFECT_MODIFIER' | 'UNLOCK_ACTION' | 'STAT_BOOST' | 'ACTIVE_ABILITY';
  category: 'TAKEOVER_OP' | 'FORTIFICATION' | 'HQ_UPGRADE' | 'HIDEOUT_MODULE' | 'CONSTRUCTION' | 'ALL_OPS' | 'MILITARY_OPS' | 'TRANSPORT_OP' | 'TRAINING' | 'BRIBE' | 'PASSIVE' | 'MOONSHINE' | 'HQ_INFORMANT_NETWORK' | 'ATTRIBUTES' | 'MASTERMIND_OP';
  value: number;
  subtype?: keyof Mastermind['attributes'];
}

export interface Skill {
    id: string;
    name: string;
    description: string;
    cost: number;
    prerequisites: string[];
    position: { row: number; col: number };
    effect: SkillEffect;
    effectDescription: string;
}

// Operations
export interface Operation {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[];
  difficulty: number;
  reward: number;
  heat: number;
  isCounterOperation?: boolean;
  rivalOperationId?: string;
  targetDistrictId?: number;
  isTakeoverOperation?: boolean;
  isLieutenantMission?: boolean;
  lieutenantId?: string;
  isTransportOperation?: boolean;
  transportAmount?: number;
  isMastermindOperation?: boolean;
  isNarrativeOperation?: boolean;
  prerequisiteDescription?: string;
  crucialMoment?: {
    scenario: string;
    choices: {
      attribute: keyof Mastermind['attributes'];
      check: number;
      description: string;
      successMessage: string;
      failureMessage: string;
    }[];
  };
}

export type ActiveOperation = 
    | ({ type: 'REGULAR' } & Operation & {
        assignedMemberIds: number[];
        startTime: Date;
        completionTime: Date;
        rewardModifier: number;
      })
    | {
        type: 'SCOUTING';
        // FIX: Added 'id' to the SCOUTING operation type for consistency, resolving errors where 'id' was accessed on a generic ActiveOperation.
        id: string;
        districtId: number;
        completionTime: Date;
        assignedMemberIds: number[];
      }
    | {
        type: 'TRANSPORT';
        id: string;
        destinationDistrictId: number;
        amount: number;
        assignedMemberIds: number[];
        startTime: Date;
        completionTime: Date;
      }
    | {
        type: 'INTEL';
        id: string;
        assignedMemberId: number;
        completionTime: Date;
      };

export interface RivalOperation {
    id: string;
    factionId: string;
    targetDistrictId: number;
    type: 'ATTACK_PLAYER' | 'EXPAND_NEUTRAL';
    startTime: Date;
    completionTime: Date;
    isResolved: boolean;
}

export interface RecruitmentMission {
  id: number;
  title: string;
  description: string;
  requiredSkills: string[];
  difficulty: number;
  reward: GangMember;
}

// HQ & Upgrades
export interface HqAction {
  id: string;
  name: string;
  description: string;
  cooldownDays: number;
}

export type HqEffect = 
  | { type: 'BASE_PRODUCTION', resource: 'MOONSHINE', value: number }
  | { type: 'SALE_PRICE_MODIFIER', resource: 'MOONSHINE', value: number };

export interface HqUpgrade {
  id: number;
  name: string;
  description: string;
  cost: number;
  owned: boolean;
  effect: string;
  structuredEffects?: HqEffect[];
  assignmentSlot?: {
      requiredRole: string;
      bonusEffect: string;
      bonusCalculation?: {
          type: 'INCOME' | 'PRODUCTION';
          skill: keyof GangMember['skills'];
          base: number;
          multiplier: number;
      };
  };
  lieutenantSlot?: {
    requiredArchetype: MastermindClass;
    slotName: string;
    unlocks: HqAction[];
  };
  requiredAttribute?: {
      attribute: keyof Mastermind['attributes'];
      value: number;
  };
  upgradeLineId?: string;
  level?: number;
  prerequisiteUpgradeId?: number;
  exclusiveWithId?: number;
}

export interface HideoutModule {
    id: string;
    name: string;
    description: string;
    cost: number;
    requiredSkill?: string;
    effect: {
        type: 'PROTECTION' | 'HEAT_REDUCTION' | 'UNLOCK_OP';
        value: number;
    };
}


// Events & Notifications
export interface WorldEvent {
  id: 'police_crackdown' | 'economic_boom' | 'recession';
  name: string;
  description: string;
  isActive: boolean;
  duration: number; // in hours
  globalIncomeModifier?: number;
  heatModifier?: number;
  incomeModifier?: { districtType: District['type'], multiplier: number };
}

export interface Notification {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning';
  relatedView?: View;
  relatedId?: string;
}

export interface GameEvent {
  id: number;
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'warning';
}

// Finance
export interface Transaction {
  timestamp: Date;
  type: 'income' | 'expense';
  category: string;
  amount: number;
}

// Rewards
export type Reward =
  | { type: 'CASH', amount: number, message: string }
  | { type: 'SKILL_PROMOTION', memberIds: number[], skill: keyof GangMember['skills'], amount: number, message: string }
  | { type: 'INFLUENCE_BOOST', districtId: number, amount: number, message: string }
  | { type: 'DISTRICT_INCOME_BOOST', districtId: number, multiplier: number, duration: number, message: string }
  | { type: 'RECRUIT_DEFECTOR', member: Omit<GangMember, 'id'>, message: string }
  | { type: 'TRAIT_GAIN', memberIds: number[], trait: Trait, message: string };


export interface GameState {
  cash: number;
  heat: number;
  cashFlow: number;
  heatTrend: number;
  wards: Ward[];
  gangMembers: GangMember[];
  hqUpgrades: HqUpgrade[];
  factions: Faction[];
  worldEvents: WorldEvent[];
  highHeatDuration: number;
  storyline: string;
  rivalFactions: RivalFaction[];
  rivalOperations: RivalOperation[];
  potentialRecruits: Record<number, PotentialRecruit[]>;
  districtRecruitPools: Record<number, PotentialRecruit[]>;
  totalEarnings: number;
  tier: number;
  investigationProgress: number;
  transactionLog: Transaction[];
  eventLog: GameEvent[];
  activeWardBonuses: { wardName: string; bonusDescription: string }[];
  mapActivities: MapActivity[];
  narrative: Narrative;
  narrativeTemplate: NarrativeTemplate;
  economicClimate: EconomicClimate;
  lieutenants: Lieutenant[];
  currentAct: number;
  hqMoonshine: number;
  districtMoonshine: Record<number, number>;
  lastTokenUsage?: UsageMetadata | null;
  mapConnections?: [number, number][];
  mapBackgroundUrl?: string;
  lastBribeTimestamp?: Date;
  mastermind: Mastermind;
  hqActionCooldowns: Record<string, Date>;
  activeHqBuffs: { buffId: string, expirationTime: Date }[];
  blackoutUntil?: Date;
}

// Gemini Scenario Generation
export interface ScenarioGenerationResult {
    scenario: FullInitialScenario;
    usage?: UsageMetadata;
}

export interface FullInitialScenario {
    worldState: {
        seed: number;
        template: string;
        generatorVersion: string;
        timestamp: string;
    };
    narrative: Narrative;
    cityMap: {
        wards: {
            id: string;
            name: string;
            districts: CityDistrict[];
        }[];
        strategicLocations: any[]; // Define if needed
    };
    factions: RivalFaction[];
    recruitmentPools: {
        districtId: string;
        recruits: PotentialRecruit[];
    }[];
    lieutenants: Lieutenant[];
    economicClimate: EconomicClimate;
    startingCash: number;
    startingHeat: number;
    startingCrew: Omit<GangMember, 'id' | 'loyalty' | 'status'>[];
}

export interface Narrative {
    threeActs: {
        act: string;
        summary: string;
        triggers: {
            type: string;
            condition: string;
        }[];
    }[];
    primaryAntagonist: {
        id: string;
        name: string;
        motivation: string;
        strengths: string[];
        weaknesses: string[];
    };
    branchPoints: any[]; // Define if needed
}

export interface CityDistrict {
    id: string;
    name: string;
    theme: string;
    type: District['type'];
    initialController: string;
    strategicValue: number;
    coreResources: { resource: string, abundance: number }[];
    landmarks: Landmark[];
}

export interface EconomicClimate {
    description: string;
    basePrices: { good: string, price: number }[];
    supplyDemand: { good: string, supply: number, demand: number }[];
    volatility: number;
    notableOpportunities: any[]; // Define if needed
}

export type GameMode = 'Campaign' | 'Skirmish';
export type NarrativeTemplate = 'Classic Noir-Steampunk' | 'Cyberpunk Yakuza' | 'Gritty Cartel War';

export interface ScenarioOptions {
    gameMode: GameMode;
    narrativeTemplate: NarrativeTemplate;
    difficulty: number;
    districts: number;
    rivalFactions: number;
    economicVolatility: number;
    rivalAggression: number;
    dynamicEvents: number;
    permadeath: boolean;
}

export interface OperationGenerationResult {
  operations: Operation[];
  usage?: UsageMetadata | null;
}
