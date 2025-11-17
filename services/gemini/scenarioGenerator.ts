
import { Type } from "@google/genai";
import { FullInitialScenario, ScenarioGenerationResult, ScenarioOptions, CityDistrict, Landmark } from '../../types';
import { callGenerateContent } from './api';

export const generateInitialScenario = async (options: ScenarioOptions): Promise<ScenarioGenerationResult> => {
    const { 
        gameMode, narrativeTemplate, difficulty, districts, rivalFactions,
        economicVolatility, rivalAggression, dynamicEvents, permadeath
    } = options;

    let difficultyInstructions = `
- The overall difficulty is ${difficulty}/5.
- Base startingCash on this difficulty. A lower difficulty (1-2) means higher cash ($75k-100k), normal (3) is medium ($40k-70k), and hard (4-5) is low ($15k-35k).
- Base startingHeat on this difficulty. Lower difficulty means lower heat (5-15), harder means higher heat (25-40).
- Rival Aggression is ${rivalAggression}/100. This should heavily influence the rivals' 'persona', 'aiProfile', and starting territory quality. Higher aggression means more hostile rivals with better starting positions.
- Economic Volatility is ${economicVolatility}/100. This should set the 'volatility' field in the economicClimate object.
- Dynamic Event Frequency is ${dynamicEvents}/100. This is a flavor hint for you; a higher value suggests a more chaotic world.
- Permadeath is ${permadeath ? 'ON' : 'OFF'}. If on, you can make the narrative slightly grittier.
`;
    
    let gameModeInstructions = '';
    if (gameMode === 'Skirmish') {
        gameModeInstructions = `
        This is a 'Skirmish' game. Focus on creating a balanced, competitive setup for empire management. 
        The 'narrative' section should be minimal: generate a simple one-sentence summary for the 'incipit' act and leave the rest of the narrative structure empty or generic. The primary goal is gameplay, not story.
        `;
    } else { // Campaign
        gameModeInstructions = `
        This is a 'Campaign' game. Generate a deep and engaging narrative structure as requested in the schema. The story is a critical part of the experience. Use the NARRATIVE_TEMPLATE to heavily influence the theme of the story, factions, and characters.
        `;
    }

    const prompt = `
INPUT PARAMETERS:
NARRATIVE_TEMPLATE: "${narrativeTemplate}"
GAME_MODE: "${gameMode}"

CORE DIRECTIVES:
- You are a master storyteller and game designer creating a unique starting scenario for a criminal empire simulator.
- The output MUST be a single, valid JSON object adhering to the schema below.
- CRITICAL: All string values within the JSON must have any internal double quotes (") properly escaped with a backslash (\\").
- Respect all quantity constraints.
- Apply the following game setup instructions:
${difficultyInstructions}
${gameModeInstructions}
- SKILL DISTRIBUTION GUIDELINES: For all generated characters (starting crew, recruits, lieutenants), distribute skill points realistically. A skill value of 1-4 is common. 5-7 is skilled. 8-10 is exceptionally rare and should almost never be assigned during generation; these levels are meant to be earned through gameplay.

QUANTITY CONSTRAINTS:
- total districts: ${districts}
- total rival factions: ${rivalFactions}
- wards: 3 to 5 thematic wards. Distribute the total districts amongst these wards.
- lieutenants: 6
- recruits per district: 6
- startingCrew: 6

REQUIRED JSON SCHEMA:
{
  "worldState": { "seed": int, "template": string, "generatorVersion": string, "timestamp": ISO8601 string },
  "narrative": {
    "threeActs": [ { "act": "incipit"|"development"|"climax", "summary": string, "triggers": [ { "type": string, "condition": string } ] } ],
    "primaryAntagonist": { "id": string, "name": string, "motivation": string, "strengths": [string], "weaknesses": [string] },
    "branchPoints": [ { "id": string, "choiceDescription": string, "consequences": [string] } ]
  },
  "cityMap": {
    "wards": [ { "id": string, "name": string, "districts": [ { "id": string, "name": string, "theme": string, "type": "residential"|"industrial"|"entertainment"|"financial"|"slums"|"port"|"mixed", "coreResources": [ {"resource":string, "abundance":0.0-1.0} ], "landmarks": [ {"name":string,"effectHint":string, "effect": { "type": "GLOBAL_INCOME_MOD"|"GLOBAL_HEAT_REDUCTION", "value": number }} ], "initialController": string | "neutral", "strategicValue": 0-100 } ] } ],
    "strategicLocations": [ {"id":string,"type":string,"districtId":string,"description":string} ]
  },
  "factions": [ { "id": string, "name": string, "description": string, "persona": string, "preferredOps": [string], "strengths": [string], "weaknesses": [string], "startingRelations": [{"factionId": "player", "relation": "hostile"|"neutral"|"allied"|"wary"}], "initialTerritories": [string], "aiProfile": { "expansionism":0-1, "covertOps":0-1, "influenceFocus":0-1 }, "cash": int, "strategy": "Aggressive"|"Economic", "heat": int (10-20) } ],
  "recruitmentPools": [ { "districtId": string, "recruits": [ { "name":string, "role":string, "skills":{"combat":1-10,"cunning":1-10,"influence":1-10,"logistics":1-10,"production":1-10}, "rarity": "common"|"uncommon"|"rare", "backstoryHook": string } ] } ],
  "lieutenants": [ { "id": string, "name": string, "role": string, "archetype": "Warlord"|"Spymaster"|"Industrialist", "personality": string, "uniqueAbilities": [ {"id":string,"name":string,"effectHint":string,"power":1-10} ], "loyaltyProfile": {"baseLoyalty":0-100,"triggersIncrease":[string],"triggersDecrease":[string]}, "discoveryHook": string, "skills":{"combat":1-10,"cunning":1-10,"influence":1-10,"logistics":1-10,"production":1-10} } ],
  "economicClimate": { "description": string, "basePrices": [ {"good":string, "price": int} ], "supplyDemand": [ {"good":string, "supply":int, "demand":int} ], "volatility": 0-1, "notableOpportunities": [ {"id":string,"description":string,"conditions":[string]} ] },
  "startingCash": int,
  "startingHeat": int,
  "startingCrew": [ { "name":string, "role":string, "skills":{"combat":1-10,"cunning":1-10,"influence":1-10,"logistics":1-10,"production":1-10} } ]
}
    `;

    const potentialRecruitSchema = {
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
        },
        rarity: { type: Type.STRING },
        backstoryHook: { type: Type.STRING },
      },
      required: ["name", "role", "skills", "rarity", "backstoryHook"]
    };
    
    const cityDistrictSchema = {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        name: { type: Type.STRING },
        theme: { type: Type.STRING },
        type: { type: Type.STRING },
        coreResources: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              resource: { type: Type.STRING },
              abundance: { type: Type.NUMBER },
            },
            required: ["resource", "abundance"]
          },
        },
        landmarks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              effectHint: { type: Type.STRING },
              effect: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  value: { type: Type.NUMBER }
                },
                required: ['type', 'value']
              }
            },
            required: ['name', 'effectHint', 'effect']
          },
        },
        initialController: { type: Type.STRING },
        strategicValue: { type: Type.INTEGER },
      },
       required: ["id", "name", "theme", "type", "coreResources", "landmarks", "initialController", "strategicValue"]
    };

    try {
        const response = await callGenerateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    worldState: {
                      type: Type.OBJECT,
                      properties: {
                        seed: { type: Type.INTEGER },
                        template: { type: Type.STRING },
                        generatorVersion: { type: Type.STRING },
                        timestamp: { type: Type.STRING },
                      },
                      required: ["seed", "template", "generatorVersion", "timestamp"],
                    },
                    narrative: {
                      type: Type.OBJECT,
                      properties: {
                        threeActs: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              act: { type: Type.STRING },
                              summary: { type: Type.STRING },
                              triggers: {
                                type: Type.ARRAY,
                                items: {
                                  type: Type.OBJECT,
                                  properties: {
                                    type: { type: Type.STRING },
                                    condition: { type: Type.STRING },
                                  },
                                  required: ["type", "condition"]
                                },
                              },
                            },
                            required: ["act", "summary", "triggers"]
                          },
                        },
                        primaryAntagonist: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            name: { type: Type.STRING },
                            motivation: { type: Type.STRING },
                            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                          },
                          required: ["id", "name", "motivation", "strengths", "weaknesses"]
                        },
                        branchPoints: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              choiceDescription: { type: Type.STRING },
                              consequences: { type: Type.ARRAY, items: { type: Type.STRING } },
                            },
                            required: ["id", "choiceDescription", "consequences"]
                          },
                        },
                      },
                      required: ["threeActs", "primaryAntagonist", "branchPoints"]
                    },
                    cityMap: {
                      type: Type.OBJECT,
                      properties: {
                        wards: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    name: { type: Type.STRING },
                                    districts: { type: Type.ARRAY, items: cityDistrictSchema }
                                },
                                required: ["id", "name", "districts"]
                            }
                        },
                        strategicLocations: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              type: { type: Type.STRING },
                              districtId: { type: Type.STRING },
                              description: { type: Type.STRING },
                            },
                            required: ["id", "type", "districtId", "description"]
                          },
                        },
                      },
                      required: ["wards", "strategicLocations"]
                    },
                    factions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          name: { type: Type.STRING },
                          description: { type: Type.STRING },
                          persona: { type: Type.STRING },
                          preferredOps: { type: Type.ARRAY, items: { type: Type.STRING } },
                          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                          startingRelations: { 
                              type: Type.ARRAY, 
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      factionId: { type: Type.STRING },
                                      relation: { type: Type.STRING },
                                  },
                                  required: ["factionId", "relation"]
                              }
                          },
                          initialTerritories: { type: Type.ARRAY, items: { type: Type.STRING } },
                          aiProfile: {
                            type: Type.OBJECT,
                            properties: {
                              expansionism: { type: Type.NUMBER },
                              covertOps: { type: Type.NUMBER },
                              influenceFocus: { type: Type.NUMBER },
                            },
                             required: ["expansionism", "covertOps", "influenceFocus"]
                          },
                          cash: { type: Type.INTEGER },
                          strategy: { type: Type.STRING },
                          heat: { type: Type.INTEGER },
                        },
                        required: ["id", "name", "description", "persona", "preferredOps", "strengths", "weaknesses", "startingRelations", "initialTerritories", "aiProfile", "cash", "strategy", "heat"]
                      },
                    },
                    recruitmentPools: { 
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                districtId: { type: Type.STRING },
                                recruits: { type: Type.ARRAY, items: potentialRecruitSchema }
                            },
                            required: ["districtId", "recruits"]
                        }
                    },
                    lieutenants: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          name: { type: Type.STRING },
                          role: { type: Type.STRING },
                          archetype: { type: Type.STRING },
                          personality: { type: Type.STRING },
                          uniqueAbilities: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                id: { type: Type.STRING },
                                name: { type: Type.STRING },
                                effectHint: { type: Type.STRING },
                                power: { type: Type.INTEGER },
                              },
                              required: ["id", "name", "effectHint", "power"]
                            },
                          },
                          loyaltyProfile: {
                            type: Type.OBJECT,
                            properties: {
                              baseLoyalty: { type: Type.INTEGER },
                              triggersIncrease: { type: Type.ARRAY, items: { type: Type.STRING } },
                              triggersDecrease: { type: Type.ARRAY, items: { type: Type.STRING } },
                            },
                            required: ["baseLoyalty", "triggersIncrease", "triggersDecrease"]
                          },
                          discoveryHook: { type: Type.STRING },
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
                         required: ["id", "name", "role", "archetype", "personality", "uniqueAbilities", "loyaltyProfile", "discoveryHook", "skills"]
                      },
                    },
                    economicClimate: {
                      type: Type.OBJECT,
                      properties: {
                        description: { type: Type.STRING },
                        basePrices: { 
                            type: Type.ARRAY, 
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    good: { type: Type.STRING },
                                    price: { type: Type.NUMBER }
                                },
                                required: ["good", "price"]
                            }
                        },
                        supplyDemand: { 
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    good: { type: Type.STRING },
                                    supply: { type: Type.NUMBER },
                                    demand: { type: Type.NUMBER }
                                },
                                required: ["good", "supply", "demand"]
                            }
                        },
                        volatility: { type: Type.NUMBER },
                        notableOpportunities: { 
                            type: Type.ARRAY, 
                            items: { 
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    conditions: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ["id", "description", "conditions"]
                            }
                        },
                      },
                      required: ["description", "basePrices", "supplyDemand", "volatility", "notableOpportunities"]
                    },
                    startingCash: { type: Type.INTEGER },
                    startingHeat: { type: Type.INTEGER },
                    startingCrew: {
                      type: Type.ARRAY,
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
                  required: [
                    "worldState", "narrative", "cityMap", "factions", "recruitmentPools", 
                    "lieutenants", "economicClimate", "startingCash", "startingHeat", "startingCrew"
                  ]
                }
            }
        });

        const jsonStr = response.text.trim();
        const scenario: FullInitialScenario = JSON.parse(jsonStr);
        
        return { scenario, usage: response.usageMetadata };

    } catch(error) {
        console.error("Error generating initial scenario from Gemini API:", error);
        throw new Error("Failed to forge your story in the criminal underworld.");
    }
};
