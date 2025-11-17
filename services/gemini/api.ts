import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// FIX: Replaced GenerateContentRequest with GenerateContentParameters as per SDK guidelines.
export const callGenerateContent = async (request: GenerateContentParameters): Promise<GenerateContentResponse> => {
    try {
        const response = await ai.models.generateContent(request);
        return response;
    } catch (error) {
        console.error("Error calling Gemini generateContent API:", error);
        throw error;
    }
};

export const callGenerateImages = async (request: {
    model: string;
    prompt: string;
    config: {
      numberOfImages: number;
      outputMimeType: string;
      aspectRatio?: string;
    };
}): Promise<any> => {
    try {
        const response = await ai.models.generateImages(request);
        return response;
    } catch (error) {
        console.error("Error calling Gemini generateImages API:", error);
        throw error;
    }
};