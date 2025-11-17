



import { GameState, Reward, GangMember, Trait } from '../../types';

export const generateReward = (gameState: GameState, defendingMemberIds: number[]): Reward => {
    const rewardsPool = [
        { type: 'CASH', weight: 30 },
        { type: 'SKILL_PROMOTION', weight: 25 },
        { type: 'INFLUENCE_BOOST', weight: 20 },
        { type: 'DISTRICT_INCOME_BOOST', weight: 15 },
        { type: 'TRAIT_GAIN', weight: 10},
        { type: 'RECRUIT_DEFECTOR', weight: 5 },
    ];

    const totalWeight = rewardsPool.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const reward of rewardsPool) {
        if (random < reward.weight) {
            return createReward(reward.type, gameState, defendingMemberIds);
        }
        random -= reward.weight;
    }

    // Fallback to cash reward
    return createReward('CASH', gameState, defendingMemberIds);
};

const createReward = (type: string, gameState: GameState, defendingMemberIds: number[]): Reward => {
    const memberForMessage = gameState.gangMembers.find(m => defendingMemberIds.includes(m.id))?.name || 'Your crew';
    const allDistricts = gameState.wards.flatMap(w => w.districts);
    
    switch(type) {
        case 'SKILL_PROMOTION': {
            const memberToPromote = gameState.gangMembers.find(m => defendingMemberIds.includes(m.id));
            if (memberToPromote) {
                const skills: (keyof GangMember['skills'])[] = ['combat', 'cunning', 'influence', 'logistics', 'production'];
                const randomSkill = skills[Math.floor(Math.random() * skills.length)];
                return {
                    type: 'SKILL_PROMOTION',
                    memberIds: defendingMemberIds,
                    skill: randomSkill,
                    amount: 1,
                    message: `${memberToPromote.name} gained valuable experience defending the turf, improving their ${randomSkill} skill!`
                };
            }
            // Fallback to cash if no member found (shouldn't happen)
            return createReward('CASH', gameState, defendingMemberIds);
        }
        case 'INFLUENCE_BOOST': {
            const neutralDistricts = allDistricts.filter(d => d.controlledBy === 'neutral');
            if (neutralDistricts.length > 0) {
                const targetDistrict = neutralDistricts[Math.floor(Math.random() * neutralDistricts.length)];
                return {
                    type: 'INFLUENCE_BOOST',
                    districtId: targetDistrict.id,
                    amount: 30,
                    message: `Your victory has impressed the locals in ${targetDistrict.name}, significantly boosting your influence there.`
                }
            }
            return createReward('CASH', gameState, defendingMemberIds);
        }
        case 'DISTRICT_INCOME_BOOST': {
             const playerDistricts = allDistricts.filter(d => d.controlledBy === 'player');
             if (playerDistricts.length > 0) {
                const targetDistrict = playerDistricts[Math.floor(Math.random() * playerDistricts.length)];
                 return {
                    type: 'DISTRICT_INCOME_BOOST',
                    districtId: targetDistrict.id,
                    multiplier: 1.5,
                    duration: 168, // 7 days
                    message: `You've crippled rival operations in ${targetDistrict.name}, causing a temporary boom for your own ventures there!`
                 }
             }
             return createReward('CASH', gameState, defendingMemberIds);
        }
        case 'RECRUIT_DEFECTOR': {
            const defector: Omit<GangMember, 'id'> = {
                name: "Rival Defector",
                role: "Disillusioned Specialist",
                loyalty: 'infinity',
                skills: { combat: 6, cunning: 8, influence: 5, logistics: 7, production: 5 },
                status: 'Idle',
            };
            return {
                type: 'RECRUIT_DEFECTOR',
                member: defector,
                message: `A skilled operative from the rival faction, impressed by your strength, has defected to your side!`
            }
        }
        case 'TRAIT_GAIN': {
            const positiveTraits: Trait[] = [
                { name: 'Survivor', description: 'Hardened by combat, this member is tougher to take down.', effect: '+10% defense in combat' },
                { name: 'Rock Solid', description: 'Unflinching in the face of danger.', effect: 'Immune to negative loyalty events' }
            ];
            const trait = positiveTraits[Math.floor(Math.random() * positiveTraits.length)];
            return {
                type: 'TRAIT_GAIN',
                memberIds: defendingMemberIds,
                trait,
                message: `The firefight forged ${memberForMessage} into something more. They gained the '${trait.name}' trait!`
            }
        }
        case 'CASH':
        default:
             const cashAmount = 10000 + Math.floor(Math.random() * 20000);
            return {
                type: 'CASH',
                amount: cashAmount,
                message: `In the chaos of the failed attack, your crew recovered a hidden stash of $${cashAmount.toLocaleString()}!`
            };
    }
}