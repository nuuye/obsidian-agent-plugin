import { requestUrl } from 'obsidian';
import { LLMProvider, GenerateOptions } from './types/LLMProvider';

interface OllamaGenerateResponse {
	response?: string;
}

export class OllamaProvider implements LLMProvider {
	private baseUrl: string;
	private model: string;

	constructor(model: string, baseUrl: string = 'http://127.0.0.1:11434') {
		this.model = model;
		this.baseUrl = baseUrl;
	}

	async generate(prompt: string, options?: GenerateOptions): Promise<string> {
		if (!this.model) {
			throw new Error(
				'Ollama model is not configured. Set it in the plugin settings.'
			);
		}

		let finalPrompt = prompt;

		if (options?.skipThinking) {
			finalPrompt += `\n\nINSTRUCTION CRITIQUE : Ne génère AUCUNE chaîne de pensée, aucune explication et n'utilise pas de balise <think>. Donne UNIQUEMENT la réponse finale demandée.`;
		}

		try {
			// requestUrl avoids browser CORS restrictions and behaves consistently
			// across Obsidian's desktop and mobile environments.
			const response = await requestUrl({
				url: `${this.baseUrl}/api/generate`,
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: this.model,
					prompt: finalPrompt,
					stream: false,
				}),
			});

			const data = response.json as OllamaGenerateResponse;
			let responseText: string = data.response ?? '';

			if (options?.skipThinking) {
				responseText = responseText
					.replace(/<think>[\s\S]*?<\/think>/g, '')
					.trim();
			}

			// requestUrl returns a complete response, so preserve the shared
			// provider contract by forwarding the final text as one chunk.
			options?.onToken?.(responseText);
			return responseText;
		} catch (error) {
			console.error('[ERROR] Error while reaching Ollama:', error);
			throw new Error('Unable to communicate with the local LLM.');
		}
	}
}
