import { Type } from "@google/genai";
import { Operation, GameState, OperationGenerationResult, MastermindClass, GangMember, NarrativeTemplate } from '../../types';
import { TIER_NAMES } from '../../constants';
import { callGenerateContent } from './api';

const getMemberArchetype = (member: GangMember): string => {
    const skills = member.skills;
    const primarySkill = Object.keys(skills).reduce((a, b) => skills[a as keyof typeof skills] > skills[b as keyof typeof skills] ? a : b);

    switch(primarySkill) {
        case 'combat': return "a Bruiser with high Combat skill. They find opportunities through intimidation and force.";
        case 'cunning': return "a Shadow with high Cunning skill. They uncover secrets, sabotage, and high-stakes heists.";
        case 'influence': return "a Smooth Talker with high Influence skill. They navigate the world of politics, corruption, and social engineering.";
        case 'logistics':
        case 'production':
            return "a Fixer with high Logistics/Production skill. They find opportunities related to supply lines, resources, and disrupting rival infrastructure.";
        default: return "a generalist operative.";
    }
};

const THEME_LIBRARY: Record<NarrativeTemplate, { description: string; classExamples: Record<MastermindClass, string> }> = {
    'Classic Noir-Steampunk': {
        description: "a city of perpetual twilight, where steam-powered automatons patrol rain-slicked cobblestone streets and brass-goggled kingpins scheme in smoke-filled speakeasies.",
        classExamples: {
            Warlord: "Think turf wars fought with repurposed industrial machinery, intimidating clockwork enforcers, and raids on rival zeppelin contraband shipments.",
            Spymaster: "Think of blackmail material stored on intricate punch-cards in a clockwork data-vault, planting false information in pneumatic tube networks, and social engineering at high-society galas.",
            Industrialist: "Think of sabotaging a rival's steam-powered factory, cornering the market on refined whale oil, or orchestrating a hostile takeover of the city's cog-manufacturing guild."
        }
    },
    'Cyberpunk Yakuza': {
        description: "a neon-drenched metropolis, where chrome-augmented samurai enforce syndicate honor in the shadows of towering corporate arcologies and data flows like a digital currency.",
        classExamples: {
            Warlord: "Think brutal street duels with monomolecular katanas, raids on rival mag-lev cargo trains, and hostile takeovers of illegal cybernetics clinics.",
            Spymaster: "Think of data-heists targeting corporate mainframes, planting memory-altering malware on key executives, and navigating the intricate honor codes of the Yakuza clans to turn them against each other.",
            Industrialist: "Think of manipulating the stock market through insider data-trading, cornering the market on rare earth minerals for cybernetics, or launching a DDoS attack to cripple a rival corporation's logistics network."
        }
    },
    'Gritty Cartel War': {
        description: "a sun-bleached city on the edge of the law, where armored convoys kick up dust on desert roads and narco-barons rule with an iron fist from fortified haciendas.",
        classExamples: {
            Warlord: "Think ambushes on rival supply convoys, defending your territory from sicario death squads, and violent seizures of remote production labs in the jungle.",
            Spymaster: "Think of turning a high-ranking lieutenant into a DEA informant, using surveillance drones to track shipments, and manipulating local politicians to grant your cartel legal protection.",
            Industrialist: "Think of laundering money through a vast network of legitimate businesses, controlling the transportation routes for all illicit goods in the region, or bribing border officials to ensure your shipments get through while rivals' are seized."
        }
    }
};


export const generateOperations = async (
    gameState: GameState,
    assignedMember: GangMember
): Promise<OperationGenerationResult> => {
    const { tier, storyline, mastermind, wards, narrativeTemplate } = gameState;
    const tierName = TIER_NAMES[tier - 1] || 'Beginner';
    const controlledDistricts = wards.flatMap(w => w.districts).filter(d => d.controlledBy === 'player').map(d => d.name).join(', ') || 'none';

    const theme = THEME_LIBRARY[narrativeTemplate] || THEME_LIBRARY['Classic Noir-Steampunk'];

    const prompt = `
    You are a master storyteller for 'Underworld Ascendant,' a game set in the world of ${narrativeTemplate}. The city is a place of ${theme.description}.

    The player's status:
    - Empire Tier: ${tier} (${tierName})
    - Storyline: "${storyline}"
    - Mastermind Class: ${mastermind.class}. (${theme.classExamples[mastermind.class]})
    - Controlled Districts: ${controlledDistricts}
    - Intel Operative: The intel is being gathered by ${getMemberArchetype(assignedMember)}

    Generate 7 unique, thematic mission templates. The output must be a JSON array of 7 objects.
    Your mission generation should follow this structure:
    1.  **Narrative Operation (0 or 1):** If the player's state (tier, storyline, districts) suggests a major plot point could occur, create ONE special 'isNarrativeOperation'. This is for advancing the main story. It should feel significant. Add a 'prerequisiteDescription' string explaining what is required (e.g., "Requires Mastermind Level 5 and control of the Financial District.").
    2.  **Mastermind Operation (1 or 2):** Create ONE or TWO 'isMastermindOperation's. These must be exclusive and highly thematic to the player's Mastermind Class.
    3.  **Common Operations (Fill the rest to 7 total):** The remaining operations should be 'common' missions. Their themes should be heavily influenced by the 'Intel Operative's archetype, the player's tier, and current storyline.

    For each mission template, provide ONLY:
    - title: A unique, evocative title.
    - description: A detailed description.
    - requiredSkills: An array of one or two skills from: Combat, Cunning, Influence, Logistics, Production.
    - isMastermindOperation: boolean (true if this is a class-specific op).
    - isNarrativeOperation: boolean (true if this is a story-critical op).
    - prerequisiteDescription: A string describing requirements, ONLY if 'isNarrativeOperation' is true.
    - crucialMoment: If 'isMastermindOperation' is true, you MUST generate this object. It must contain:
        - scenario: A 1-2 sentence string describing a climactic moment.
        - choices: An array of 2-3 choice objects. Each choice MUST have:
            - attribute: A string, one of 'strength', 'cunning', or 'charisma'.
            - check: An integer from 4 to 9 representing difficulty.
            - description: A short, active string describing the choice (e.g., "Disarm him forcefully.").
            - successMessage: A string for the log if the check succeeds.
            - failureMessage: A string for the log if the check fails.

    Do NOT include difficulty, reward, or heat. Ensure the final output is a valid JSON array with exactly 7 mission objects.
    `;

    try {
        const crucialMomentChoiceSchema = {
            type: Type.OBJECT,
            properties: {
                attribute: { type: Type.STRING },
                check: { type: Type.INTEGER },
                description: { type: Type.STRING },
                successMessage: { type: Type.STRING },
                failureMessage: { type: Type.STRING },
            },
            required: ["attribute", "check", "description", "successMessage", "failureMessage"],
        };
        const crucialMomentSchema = {
            type: Type.OBJECT,
            properties: {
                scenario: { type: Type.STRING },
                choices: {
                    type: Type.ARRAY,
                    items: crucialMomentChoiceSchema,
                },
            },
            required: ["scenario", "choices"],
            nullable: true,
        };

        const response = await callGenerateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            requiredSkills: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                            },
                            isMastermindOperation: { type: Type.BOOLEAN },
                            isNarrativeOperation: { type: Type.BOOLEAN },
                            prerequisiteDescription: { type: Type.STRING, nullable: true },
                            crucialMoment: crucialMomentSchema,
                        },
                         required: ["title", "description", "requiredSkills", "isMastermindOperation", "isNarrativeOperation"],
                    },
                },
            },
        });

        const jsonStr = response.text.trim();
        type ApiOperationTemplate = Omit<Operation, 'id' | 'difficulty' | 'reward' | 'heat'>;
        const templatesFromApi: ApiOperationTemplate[] = JSON.parse(jsonStr);
        
        const operations: Operation[] = templatesFromApi.map((op, index) => ({
            ...op,
            id: `op-${Date.now()}-${index}`,
            difficulty: 0,
            reward: 0,
            heat: 0,
        }));

        return { operations, usage: response.usageMetadata };

    } catch (error) {
        console.error("Error generating operations from Gemini API:", error);
        throw new Error("Failed to fetch operations from Gemini.");
    }
};
