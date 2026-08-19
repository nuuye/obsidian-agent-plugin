import { requestUrl } from 'obsidian';
import { LLMProvider, GenerateOptions } from './types/LLMProvider';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqChatCompletionResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
	}>;
}

export class GroqProvider implements LLMProvider {
	constructor(private modelName: string, private apiKey: string) {}

	async generate(prompt: string, options?: GenerateOptions): Promise<string> {
		let finalPrompt = prompt;

		if (options?.skipThinking) {
			finalPrompt += `\n\nINSTRUCTION CRITIQUE : Ne génère AUCUNE chaîne de pensée. Donne UNIQUEMENT la réponse finale demandée.`;
		}

		if (!this.apiKey) {
			throw new Error('Groq API key is not configured. Set it in the plugin settings.');
		}

		try {
			// requestUrl ne supporte pas le streaming SSE (contrairement à
			// fetch + ReadableStream) — on fait donc un appel classique. Si un
			// callback onToken est fourni (compat avec NoteEditor/NoteAnalyzer
			// qui streament sur Ollama), on le déclenche une seule fois avec
			// le texte complet plutôt que de faire semblant de streamer.
			const response = await requestUrl({
				url: GROQ_API_URL,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.apiKey}`,
				},
				body: JSON.stringify({
					model: this.modelName,
					messages: [{ role: 'user', content: finalPrompt }],
					stream: false,
				}),
			});

			const data = response.json as GroqChatCompletionResponse;
			const fullText: string = data.choices?.[0]?.message?.content ?? '';

			options?.onToken?.(fullText);

			return fullText;
		} catch (error) {
			console.error('[ERROR] Error while reaching Groq API:', error);
			throw new Error('Unable to communicate with Groq.');
		}
	}
}