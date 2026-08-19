import { LLMProvider } from "../llm/types/LLMProvider.js";
import { parseJsonFromLLM } from "../utils/llmJson.js";

// Format de retour attendu du LLM — exporté pour être réutilisé par ChangePlanner.
export interface ChangesJSON {
    changes: Array<{
        id: string;
        type: "formatting" | "content" | "schema" | "link" | "new content";
        description: string;
    }>;
}

export class ChangeReviewer {
    constructor(private llm: LLMProvider) {}

    async review(original: string, modified: string): Promise<ChangesJSON> {
        const prompt = `
        Compare la "Note Originale" et la "Note Modifiée".
        Identifie les changements significatifs et retourne-les au format JSON.
        
        Format JSON attendu :
        {
            "changes": [
            {
                "id": "change-1",
                "type": "formatting", // ou content, schema, link, new_note
                "description": "Description courte du changement"
            }
            ]
        }

        Note Originale :
        """
        ${original}
        """

        Note Modifiée :
        """
        ${modified}
        """
        `;

        const response = await this.llm.generate(prompt);
        return parseJsonFromLLM<ChangesJSON>(response, "Échec du parsing JSON lors de la revue des changements");
    }
}