
import { GoogleGenAI, Type } from "@google/genai";
import { Operation, District, GangMember } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export interface InitialScenario {
    storyline: string;
    startingCash: number;
    startingHeat: number;
    districtControl: { districtName: string; controlledBy: 'player' | 'rival' | 'neutral' }[];
    startingCrew: Omit<GangMember, 'id' | 'loyalty' | 'status'>[];
}


export const generateOperations = async (
    cash: number, 
    heat: number, 
    controlledDistricts: string
): Promise<Operation[]> => {
    const prompt = `
    You are a game designer creating missions for a 1930s noir-steampunk criminal empire simulator called 'Underworld Ascendant'. 
    The player currently has $${cash.toLocaleString()}, controls the following districts: ${controlledDistricts || 'none'}, and has a police heat level of ${heat}/100.

    Generate 3 unique, thematically appropriate missions (operations). For each mission, provide a title, a detailed description, the required skills (choose one or two from: Combat, Cunning, Influence, Logistics, Production), a difficulty rating (1-10), a cash reward, and the amount of 'heat' it will generate. 
    Ensure the missions are varied and reflect the player's current status. Higher heat should lead to riskier but potentially more rewarding missions. Lower cash might prompt more desperate heists.
    `;

    try {
        const response = await ai.models.generateContent({
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
                            difficulty: { type: Type.INTEGER },
                            reward: { type: Type.INTEGER },
                            heat: { type: Type.INTEGER },
                        },
                         required: ["title", "description", "requiredSkills", "difficulty", "reward", "heat"],
                    },
                },
            },
        });

        const jsonStr = response.text.trim();
        type ApiOperation = Omit<Operation, 'id'>;
        const operationsFromApi: ApiOperation[] = JSON.parse(jsonStr);
        
        // Add a unique ID to each operation for client-side tracking
        const operations: Operation[] = operationsFromApi.map((op, index) => ({
            ...op,
            id: `op-${Date.now()}-${index}`,
        }));

        return operations;

    } catch (error) {
        console.error("Error generating operations from Gemini API:", error);
        throw new Error("Failed to fetch operations from Gemini.");
    }
};

export const generateInitialScenario = async (): Promise<InitialScenario> => {
    const prompt = `
    You are a master storyteller and game designer for a 1930s noir-steampunk criminal empire simulator called 'Underworld Ascendant'. 
    Create a unique and compelling starting scenario for a new player.

    1.  **Storyline**: Generate a short, evocative narrative backstory (2-3 sentences) explaining who the player is, what event kicked off their criminal career, and their initial goal.
    2.  **Starting Resources**: Determine a starting cash amount (between $20,000 and $75,000) and a starting police heat level (between 10 and 30).
    3.  **Territory Control**: The city has six districts: "Blackwood Docks", "Irongate Industrial", "The Serpent Slums", "Emberlight Entertainment", "Sterling Financial", "Gilded Residential". Decide the initial faction control. The 'player' MUST control exactly two districts. A rival faction, 'The Golden Dragons', MUST control exactly two districts. The remaining two districts MUST be 'neutral'.
    4.  **Starting Crew**: Create a unique crew of 3 starting gang members. For each member, provide a thematic name (e.g., Silas 'The Ghost' Kane), a role (e.g., 'Ex-Boxer', 'Smooth Talker', 'Getaway Driver'), and assign skill points for combat, cunning, influence, logistics, and production. The total skill points for each member should be between 25 and 35.

    You must provide the output in a valid JSON format that adheres to the provided schema.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        storyline: { type: Type.STRING, description: "The player's starting backstory." },
                        startingCash: { type: Type.INTEGER, description: "The initial cash amount for the player." },
                        startingHeat: { type: Type.INTEGER, description: "The initial police heat level." },
                        districtControl: {
                          type: Type.ARRAY,
                          description: "The initial faction control for each city district.",
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              districtName: { type: Type.STRING, description: "Name of the district." },
                              controlledBy: { type: Type.STRING, description: "Faction controlling the district: 'player', 'rival', or 'neutral'." }
                            },
                            required: ["districtName", "controlledBy"]
                          }
                        },
                        startingCrew: {
                          type: Type.ARRAY,
                          description: "The player's initial 3 crew members.",
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              name: { type: Type.STRING },
                              role: { type: Type.STRING },
                              skills: {
                                type: Type.OBJECT,
                                properties: {
                                  combat: { type: Type.INTEGER },
                                  cunning: { type: Type.INTEGER },
                                  influence: { type: Type.INTEGER },
                                  logistics: { type: Type.INTEGER },
                                  production: { type: Type.INTEGER }
                                },
                                required: ["combat", "cunning", "influence", "logistics", "production"]
                              }
                            },
                            required: ["name", "role", "skills"]
                          }
                        }
                    },
                    required: ["storyline", "startingCash", "startingHeat", "districtControl", "startingCrew"]
                }
            }
        });

        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);

    } catch(error) {
        console.error("Error generating initial scenario from Gemini API:", error);
        throw new Error("Failed to forge your story in the criminal underworld.");
    }
};
