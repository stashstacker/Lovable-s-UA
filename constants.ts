

import { District, Faction, HqUpgrade, WorldEvent, MastermindClass, Skill, HideoutModule } from './types';

export const BACKGROUND_IMAGE_URL = 'https://images.unsplash.com/photo-1519818187425-8e35f71e2b28?q=80&w=1974&auto=format=fit=crop';

export const FACTIONS: Faction[] = [
  { id: 'player', name: 'Your Syndicate', color: 'bg-green-700' },
  { id: 'neutral', name: 'Uncontested', color: 'bg-gray-700' },
];

export const TIER_THRESHOLDS = [0, 250000, 1000000, 10000000, 50000000];
export const TIER_NAMES = ["Street Rat", "Local Kingpin", "City Baron", "Metropolitan Mogul", "Global Powerbroker"];

// FIX: Helper function to calculate operation cost increases based on heat. Moved here to be shared.
export const getHeatCostModifier = (heat: number): number => {
    if (heat > 150) return 2.0; // Double cost at CRITICAL heat
    if (heat > 100) return 1.5; // +50% cost at RED heat
    return 1.0;
};

export const GAME_MECHANICS = {
    GATHER_INTEL_COST: 10000,
    GATHER_INTEL_DURATION_HOURS: 12,
    LIEUTENANT_PURSUE_COST: 150000,
    SCOUTING_COST: 5000,
    SCOUTING_DURATION_HOURS: 12,
    TAKEOVER_COST_NEUTRAL: 30000,
    TAKEOVER_COST_RIVAL: 80000,
    BRIBE_COST: 50000,
    BRIBE_HEAT_REDUCTION: 20,
    BRIBE_INVESTIGATION_REDUCTION: 25,
    BRIBE_COOLDOWN_DAYS: 7,
    RICO_RAID_CASH_PENALTY_DIVISOR: 2,
    RICO_RAID_HEAT_RESET: 20,
    RICO_RAID_ARREST_COUNT: 2,
    RICO_RAID_ARREST_DURATION_HOURS: 336, // 14 days
    DISTRICT_TAKEOVER_COOLDOWN_DAYS: 7,
};

export const HIDEOUT_MODULES: HideoutModule[] = [
    { id: 'bunkers', name: 'Reinforced Bunkers', description: 'Protects up to 2 assigned crew members from being arrested during RICO raids.', cost: 30000, effect: { type: 'PROTECTION', value: 2 } },
    { id: 'hidden_exit', name: 'Hidden Exit', description: 'Reduces passive heat generation in this district by 0.1 per hour.', cost: 45000, effect: { type: 'HEAT_REDUCTION', value: 0.1 } },
    { id: 'interrogation_room', name: 'Interrogation Room', description: 'Unlocks advanced Espionage operations.', cost: 60000, requiredSkill: 'spymaster_interrogation', effect: { type: 'UNLOCK_OP', value: 1 } },
    { id: 'workshop', name: 'Illicit Workshop', description: 'Boosts Moonshine production at HQ by 1 unit/hour.', cost: 50000, requiredSkill: 'industrialist_engineering', effect: { type: 'UNLOCK_OP', value: 1 } },
    { id: 'training_yard', name: 'Underground Training Yard', description: 'Reduces the time it takes for crew to train skills by 25%.', cost: 70000, requiredSkill: 'warlord_drill_sergeant', effect: { type: 'UNLOCK_OP', value: 1 } },
];

export const WAREHOUSE_LEVELS = [
    { level: 0, name: 'No Warehouse', description: 'This district has no storage for illicit goods. A warehouse allows you to store and distribute products.', upgradeCost: 20000, effect: { capacity: 0, saleBonus: 1.0 } },
    { level: 1, name: 'Small Warehouse', description: 'A basic storage facility that holds a modest amount of goods and facilitates local sales.', upgradeCost: 50000, effect: { capacity: 100, saleBonus: 1.1 } },
    { level: 2, name: 'Distribution Center', description: 'A large, efficient facility that can store significant inventory and improves sales margins.', upgradeCost: 120000, effect: { capacity: 300, saleBonus: 1.25 } },
    { level: 3, name: 'Logistics Hub', description: 'The heart of your distribution network, with vast storage and maximum profitability.', upgradeCost: 0, effect: { capacity: 1000, saleBonus: 1.5 } }
];

export const SKILL_TREES: Record<MastermindClass, Skill[]> = {
    Warlord: [
        // Tier 1
        { id: 'warlord_intimidation', name: 'Fearsome Reputation', description: 'Your name carries weight. Takeover operations are cheaper to initiate.', cost: 1, prerequisites: [], position: { row: 1, col: 3 }, effect: { type: 'COST_MODIFIER', category: 'TAKEOVER_OP', value: -0.10 }, effectDescription: '-10% cash cost for Takeover Ops.' },
        // Tier 2
        { id: 'warlord_drill_sergeant', name: 'Drill Sergeant', description: 'Your crew trains harder and faster under your command.', cost: 1, prerequisites: ['warlord_intimidation'], position: { row: 2, col: 2 }, effect: { type: 'SPEED_MODIFIER', category: 'TRAINING', value: 0.25 }, effectDescription: '+25% faster crew skill training.' },
        { id: 'warlord_rapid_deployment', name: 'Rapid Deployment', description: 'Military operations are executed with brutal efficiency.', cost: 1, prerequisites: ['warlord_intimidation'], position: { row: 2, col: 4 }, effect: { type: 'SPEED_MODIFIER', category: 'MILITARY_OPS', value: -0.15 }, effectDescription: 'All Combat & Takeover Ops are 15% faster.' },
        // Tier 3
        { id: 'warlord_fortifications', name: 'Master Tactician', description: 'Your expertise in defensive structures makes fortifications cheaper.', cost: 2, prerequisites: ['warlord_drill_sergeant'], position: { row: 3, col: 1 }, effect: { type: 'COST_MODIFIER', category: 'FORTIFICATION', value: -0.20 }, effectDescription: '-20% cost for Fortify District actions.' },
        { id: 'warlord_warlord_might', name: 'Warlord\'s Might', description: 'Your physical presence and strategic mind are a force to be reckoned with.', cost: 2, prerequisites: ['warlord_drill_sergeant', 'warlord_rapid_deployment'], position: { row: 3, col: 3 }, effect: { type: 'STAT_BOOST', category: 'ATTRIBUTES', value: 2, subtype: 'strength' }, effectDescription: '+2 to Strength Attribute.' },
        { id: 'warlord_spoils_of_war', name: 'Spoils of War', description: 'Your crew is adept at looting during conflicts, increasing rewards from successful defenses.', cost: 2, prerequisites: ['warlord_rapid_deployment'], position: { row: 3, col: 5 }, effect: { type: 'INCOME_MODIFIER', category: 'PASSIVE', value: 0.10 }, effectDescription: '+10% bonus cash rewards from defensive victories.' },
        // Tier 4
        { id: 'warlord_iron_fist', name: 'Iron Fist', description: 'Your control is absolute. Passive influence gain in neutral districts is doubled.', cost: 3, prerequisites: ['warlord_warlord_might'], position: { row: 4, col: 3 }, effect: { type: 'EFFECT_MODIFIER', category: 'PASSIVE', value: 1.0 }, effectDescription: 'Doubles influence gain from assigned crew in neutral districts.' },
        // Tier 5 (Ascendant)
        { id: 'warlord_breach_and_clear', name: 'Breach and Clear', description: 'ASCENDANT ABILITY: Use overwhelming force to bypass a challenge in a Mastermind Operation.', cost: 2, prerequisites: ['warlord_iron_fist'], position: { row: 5, col: 3 }, effect: { type: 'ACTIVE_ABILITY', category: 'MASTERMIND_OP', value: 50 }, effectDescription: 'Unlocks the "Breach and Clear" ability. Costs 50 Focus.' },
    ],
    Spymaster: [
        // Tier 1
        { id: 'spymaster_covert', name: 'Covert Operations', description: 'You move like a ghost, reducing the heat generated from all operations.', cost: 1, prerequisites: [], position: { row: 1, col: 3 }, effect: { type: 'HEAT_MODIFIER', category: 'ALL_OPS', value: -0.10 }, effectDescription: '-10% heat from all Ops.' },
        // Tier 2
        { id: 'spymaster_grease_palms', name: 'Grease Palms', description: 'You know exactly whose pockets to line. Bribes are more effective.', cost: 1, prerequisites: ['spymaster_covert'], position: { row: 2, col: 2 }, effect: { type: 'EFFECT_MODIFIER', category: 'BRIBE', value: 0.25 }, effectDescription: '+25% effectiveness for Police Bribes.' },
        { id: 'spymaster_black_mirror', name: 'Black Mirror', description: 'Your agents are adept at hiding their tracks, reducing passive heat.', cost: 1, prerequisites: ['spymaster_covert'], position: { row: 2, col: 4 }, effect: { type: 'HEAT_MODIFIER', category: 'PASSIVE', value: -0.1 }, effectDescription: 'Increases passive heat decay by 0.1/hr.' },
        // Tier 3
        { id: 'spymaster_interrogation', name: 'Enhanced Interrogation', description: 'Unlocks advanced intelligence gathering modules for hideouts.', cost: 2, prerequisites: ['spymaster_grease_palms'], position: { row: 3, col: 1 }, effect: { type: 'UNLOCK_ACTION', category: 'HIDEOUT_MODULE', value: 1 }, effectDescription: 'Enables construction of the Interrogation Room.' },
        { id: 'spymaster_master_of_disguise', name: 'Master of Disguise', description: 'Your understanding of deception and infiltration is unparalleled.', cost: 2, prerequisites: ['spymaster_grease_palms', 'spymaster_black_mirror'], position: { row: 3, col: 3 }, effect: { type: 'STAT_BOOST', category: 'ATTRIBUTES', value: 2, subtype: 'cunning' }, effectDescription: '+2 to Cunning Attribute.' },
        { id: 'spymaster_expanded_network', name: 'Expanded Network', description: 'The passive heat decay from the "Informant Network" HQ upgrade is doubled.', cost: 2, prerequisites: ['spymaster_black_mirror'], position: { row: 3, col: 5 }, effect: { type: 'EFFECT_MODIFIER', category: 'HQ_INFORMANT_NETWORK', value: 1.0 }, effectDescription: 'Doubles passive heat reduction from the Informant Network HQ upgrade.' },
        // Tier 4
        { id: 'spymaster_low_profile', name: 'Low Profile', description: 'High-risk operations are less likely to attract attention if they fail.', cost: 3, prerequisites: ['spymaster_master_of_disguise'], position: { row: 4, col: 3 }, effect: { type: 'HEAT_MODIFIER', category: 'ALL_OPS', value: -0.5 }, effectDescription: 'Failed operations generate 50% less heat.' },
        // Tier 5 (Ascendant)
        { id: 'spymaster_ghost_protocol', name: 'Ghost Protocol', description: 'ASCENDANT ABILITY: Activate a prototype cloaking field during a Mastermind Operation, becoming invisible to bypass a single challenge.', cost: 2, prerequisites: ['spymaster_low_profile'], position: { row: 5, col: 3 }, effect: { type: 'ACTIVE_ABILITY', category: 'MASTERMIND_OP', value: 75 }, effectDescription: 'Unlocks the "Ghost Protocol" ability. Costs 75 Focus.' },
    ],
    Industrialist: [
        // Tier 1
        { id: 'industrialist_negotiator', name: 'Master Negotiator', description: 'You can always get a better deal. All construction costs are reduced.', cost: 1, prerequisites: [], position: { row: 1, col: 3 }, effect: { type: 'COST_MODIFIER', category: 'CONSTRUCTION', value: -0.10 }, effectDescription: '-10% cost for all HQ Upgrades & Hideout Modules.' },
        // Tier 2
        { id: 'industrialist_engineering', name: 'Illicit Engineering', description: 'Unlocks advanced production modules for hideouts.', cost: 1, prerequisites: ['industrialist_negotiator'], position: { row: 2, col: 2 }, effect: { type: 'UNLOCK_ACTION', category: 'HIDEOUT_MODULE', value: 1 }, effectDescription: 'Enables construction of the Illicit Workshop.' },
        { id: 'industrialist_smugglers_routes', name: 'Smuggler\'s Routes', description: 'Your knowledge of back-alleys and byways makes transport faster and quieter.', cost: 1, prerequisites: ['industrialist_negotiator'], position: { row: 2, col: 4 }, effect: { type: 'SPEED_MODIFIER', category: 'TRANSPORT_OP', value: -0.20 }, effectDescription: 'Transport operations are 20% faster and generate 50% less heat.' },
        // Tier 3
        { id: 'industrialist_efficiency', name: 'Production Efficiency', description: 'Streamline your production lines for greater output.', cost: 2, prerequisites: ['industrialist_engineering'], position: { row: 3, col: 1 }, effect: { type: 'PRODUCTION_MODIFIER', category: 'MOONSHINE', value: 0.25 }, effectDescription: '+25% Moonshine production at HQ.' },
        { id: 'industrialist_silver_tongue', name: 'Silver Tongue', description: 'Your charm and business acumen are legendary, making you a formidable presence.', cost: 2, prerequisites: ['industrialist_engineering', 'industrialist_smugglers_routes'], position: { row: 3, col: 3 }, effect: { type: 'STAT_BOOST', category: 'ATTRIBUTES', value: 2, subtype: 'charisma' }, effectDescription: '+2 to Charisma Attribute.' },
        { id: 'industrialist_black_market_maven', name: 'Black Market Maven', description: 'Your connections ensure you get the best price for your goods.', cost: 2, prerequisites: ['industrialist_smugglers_routes'], position: { row: 3, col: 5 }, effect: { type: 'INCOME_MODIFIER', category: 'PASSIVE', value: 0.10 }, effectDescription: '+10% income from Warehouse sales.' },
        // Tier 4
        { id: 'industrialist_monopolist', name: 'Monopolist', description: 'Your economic influence is so vast that even your legitimate fronts generate more profit.', cost: 3, prerequisites: ['industrialist_silver_tongue'], position: { row: 4, col: 3 }, effect: { type: 'INCOME_MODIFIER', category: 'PASSIVE', value: 0.05 }, effectDescription: '+5% to ALL passive income sources.' },
        // Tier 5 (Ascendant)
        { id: 'industrialist_hostile_takeover', name: 'Hostile Takeover', description: 'ASCENDANT ABILITY: Leverage your immense wealth to bypass a direct confrontation during a Mastermind Operation by buying off a key opponent.', cost: 2, prerequisites: ['industrialist_monopolist'], position: { row: 5, col: 3 }, effect: { type: 'ACTIVE_ABILITY', category: 'MASTERMIND_OP', value: 40 }, effectDescription: 'Unlocks the "Hostile Takeover" ability. Costs 40 Focus and a large sum of cash.' },
    ],
};

export const INITIAL_HQ_UPGRADES: HqUpgrade[] = [
    // --- Distillery Line ---
    { 
        id: 1,
        upgradeLineId: 'distillery',
        level: 1,
        name: 'Hidden Distillery (Tier 1)', 
        description: 'A basic setup to begin production of moonshine, the foundation of your illicit goods empire.', 
        cost: 15000, 
        owned: false, 
        effect: 'Base Production: 2 units of Moonshine / hour.',
        structuredEffects: [{ type: 'BASE_PRODUCTION', resource: 'MOONSHINE', value: 2 }]
    },
    {
        id: 7,
        upgradeLineId: 'distillery',
        level: 2,
        prerequisiteUpgradeId: 1,
        name: 'Industrial Still (Tier 2)',
        description: 'Upgrade to a professional-grade still, increasing output and allowing for a specialist to oversee production.',
        cost: 75000,
        owned: false,
        effect: 'Base Production: 5 units of Moonshine / hour. Unlocks specialist slot.',
        structuredEffects: [{ type: 'BASE_PRODUCTION', resource: 'MOONSHINE', value: 3 }], // Value is additive to previous tier
        assignmentSlot: {
            requiredRole: 'Master Forger', // Re-using role, represents a 'chemist' or 'distiller'
            bonusEffect: 'Bonus production based on Production skill.',
            bonusCalculation: { type: 'PRODUCTION', skill: 'production', base: 0, multiplier: 0.1 } // +0.1 units/hr per skill point
        }
    },
    {
        id: 8,
        upgradeLineId: 'distillery',
        level: 3,
        prerequisiteUpgradeId: 7,
        name: 'Syndicate Brewery (Tier 3)',
        description: 'A massive, top-of-the-line brewery that marks you as a major player. Unlocks a Lieutenant slot and final specialization.',
        cost: 200000,
        owned: false,
        effect: 'Base Production: 10 units of Moonshine / hour. Unlocks Lieutenant slot.',
        structuredEffects: [{ type: 'BASE_PRODUCTION', resource: 'MOONSHINE', value: 5 }],
        lieutenantSlot: {
            requiredArchetype: 'Industrialist',
            slotName: 'Operations Foreman',
            unlocks: [] // Can add actions here in the future
        }
    },
    {
        id: 9,
        upgradeLineId: 'distillery',
        level: 4,
        prerequisiteUpgradeId: 8,
        exclusiveWithId: 10,
        name: 'Specialization: Mass Production',
        description: 'Focus on quantity over quality. Re-tool the entire line for maximum output, flooding the market with your product.',
        cost: 120000,
        owned: false,
        effect: '+5 units of Moonshine / hour.',
        structuredEffects: [{ type: 'BASE_PRODUCTION', resource: 'MOONSHINE', value: 5 }],
    },
    {
        id: 10,
        upgradeLineId: 'distillery',
        level: 4,
        prerequisiteUpgradeId: 8,
        exclusiveWithId: 9,
        name: 'Specialization: Artisanal Quality',
        description: 'Focus on quality over quantity. Develop a premium brand of moonshine that sells for a much higher price.',
        cost: 120000,
        owned: false,
        effect: '+40% sale price for all Moonshine.',
        structuredEffects: [{ type: 'SALE_PRICE_MODIFIER', resource: 'MOONSHINE', value: 0.4 }],
    },

    // --- Other Upgrade Lines ---
    { 
        id: 2, 
        upgradeLineId: 'security',
        level: 1,
        name: 'Fortified Walls', 
        description: 'Reinforce the HQ against rival attacks and police raids. Becomes a War Room when a Warlord is assigned.', 
        cost: 25000, 
        owned: false, 
        effect: '-10% chance of raid success',
        lieutenantSlot: {
            requiredArchetype: 'Warlord',
            slotName: 'Chief of Security',
            unlocks: [
                { id: 'drill_troops', name: 'Drill Troops', description: 'For 24 hours, all crew members gain double XP from combat operations.', cooldownDays: 7 },
                { id: 'fortify_defenses', name: 'Fortify Defenses', description: 'All player-controlled districts gain a temporary +20 fortification for 3 days.', cooldownDays: 10 }
            ]
        }
    },
    { 
        id: 3,
        upgradeLineId: 'logistics',
        level: 1,
        name: 'Smuggler\'s Tunnel',
        description: 'Create a secret route for moving goods and personnel undetected.',
        cost: 50000,
        owned: false,
        effect: 'Reduces heat from logistics operations'
    },
    { 
        id: 4, 
        upgradeLineId: 'intelligence',
        level: 1,
        name: 'Informant Network', 
        description: 'Establish a network of spies to gather intel on rivals and police. Becomes the Spymaster\'s Sanctum when a Spymaster is assigned.', 
        cost: 75000, 
        owned: false, 
        effect: 'Unlocks Espionage operations. Passively reduces heat by 0.1/hr.',
        requiredAttribute: {
            attribute: 'cunning',
            value: 10
        },
        assignmentSlot: {
            requiredRole: 'Cipher-Cracker',
            bonusEffect: 'Generates passive income from selling intel, scaled by Cunning skill.',
            bonusCalculation: { type: 'INCOME', skill: 'cunning', base: 500, multiplier: 250 } // $500 + $250/day per cunning point
        },
        lieutenantSlot: {
            requiredArchetype: 'Spymaster',
            slotName: 'Spymaster-in-Residence',
            unlocks: [
                { id: 'city_wide_blackout', name: 'City-Wide Blackout', description: 'For 12 hours, all rival operations are halted, and their timers are frozen.', cooldownDays: 14 }
            ]
        }
    },
    { 
        id: 5,
        upgradeLineId: 'legal',
        level: 1,
        name: 'Corrupt Lawyer on Retainer',
        description: 'Keep a high-priced lawyer on payroll to handle legal troubles.',
        cost: 100000,
        owned: false,
        effect: 'Reduces sentences for arrested members'
    },
    { 
        id: 6,
        upgradeLineId: 'laundering',
        level: 1,
        name: 'Legitimate Business Front',
        description: 'Funnel illicit earnings through a legitimate business to reduce police suspicion.',
        cost: 250000,
        owned: false,
        effect: 'Passively reduces city-wide heat every hour.'
    },
];

export const INITIAL_WORLD_EVENTS: WorldEvent[] = [
    {
        id: 'police_crackdown',
        name: "Police Crackdown",
        description: "The cops are on high alert! All illicit income is halved and operations generate 50% more heat.",
        isActive: false,
        duration: 0,
        globalIncomeModifier: 0.5,
        heatModifier: 1.5,
    },
    {
        id: 'economic_boom',
        name: "Economic Boom",
        description: "The city is flourishing! Income from Financial and Entertainment districts is doubled.",
        isActive: false,
        duration: 0,
        incomeModifier: { districtType: 'Financial', multiplier: 2 }, // Simplified for now, can apply to multiple
    },
    {
        id: 'recession',
        name: "Recession",
        description: "Times are tough. Income from Industrial and Docks districts is halved.",
        isActive: false,
        duration: 0,
        incomeModifier: { districtType: 'Industrial', multiplier: 0.5 },
    }
];
