import { BACKGROUND_IMAGE_URL } from "../../constants";
import { callGenerateImages } from './api';
import { NarrativeTemplate } from '../../types';

const getPromptForTemplate = (template: NarrativeTemplate): string => {
    switch (template) {
        case 'Cyberpunk Yakuza':
            return "A gritty, top-down, cyberpunk city map blueprint. Intricate neon-lit streets, towering megastructures, and industrial underlevels. Cyberpunk color palette with blues, purples, and pinks. Highly detailed, atmospheric, holographic display texture.";
        case 'Gritty Cartel War':
            return "A gritty, top-down, modern cartel territory map blueprint. Dusty streets, compounds, and smuggling routes through a dense urban jungle. Sun-bleached sepia tones, highly detailed, atmospheric, worn paper map texture with hand-drawn annotations.";
        case 'Classic Noir-Steampunk':
        default:
            return "A gritty, top-down, noir-steampunk city map blueprint. Intricate streets, industrial details, and brass cogs. Sepia tones, highly detailed, atmospheric, vintage paper texture.";
    }
}

export const generateMapBackground = async (narrativeTemplate: NarrativeTemplate): Promise<string> => {
    const userPrompt = getPromptForTemplate(narrativeTemplate);
    
    try {
        const response = await callGenerateImages({
            model: 'imagen-4.0-generate-001',
            prompt: userPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
            const base64Data = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64Data}`;
        }
        
        throw new Error("No image data found in API response.");

    } catch (err) {
        console.error("Error generating map background:", err);
        // Fallback to a static image on error
        return BACKGROUND_IMAGE_URL;
    }
};