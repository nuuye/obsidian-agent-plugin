import { requestUrl } from 'obsidian';
import { LLMProvider, GenerateOptions } from './types/LLMProvider';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqChatCompletionResponse {
	choices?: Array<{
		message?: {
			content?: string;
		};
		finish_reason?: string;
	}>;
	usage?: {
		completion_tokens?: number;
	};
}

type GroqReasoningEffort = 'none' | 'default' | 'low' | 'medium' | 'high';

interface GroqProviderOptions {
	reasoningEffort?: GroqReasoningEffort;
	jsonObjectMode?: boolean;
	maxCompletionTokens?: number;
}

class GroqIncompleteResponseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'GroqIncompleteResponseError';
	}
}

export class GroqProvider implements LLMProvider {
	constructor(
		private modelName: string,
		private apiKey: string,
		private providerOptions: GroqProviderOptions = {}
	) {}

	async generate(prompt: string, options?: GenerateOptions): Promise<string> {
		let finalPrompt = prompt;

		if (options?.skipThinking) {
			finalPrompt += `\n\nINSTRUCTION CRITIQUE : Ne génère AUCUNE chaîne de pensée. Donne UNIQUEMENT la réponse finale demandée.`;
		}

		if (!this.apiKey) {
			throw new Error('Groq API key is not configured. Set it in the plugin settings.');
		}

		try {
			const requestBody: Record<string, unknown> = {
				model: this.modelName,
				messages: [{ role: 'user', content: finalPrompt }],
				stream: false,
			};

			if (this.providerOptions.reasoningEffort) {
				requestBody.reasoning_effort =
					this.providerOptions.reasoningEffort;
			}

			if (this.providerOptions.jsonObjectMode) {
				requestBody.response_format = { type: 'json_object' };
			}

			if (this.providerOptions.maxCompletionTokens) {
				requestBody.max_completion_tokens =
					this.providerOptions.maxCompletionTokens;
			}

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
				body: JSON.stringify(requestBody),
			});

			const data = response.json as GroqChatCompletionResponse;
			const choice = data.choices?.[0];

			if (choice?.finish_reason === 'length') {
				const tokenCount = data.usage?.completion_tokens;
				const tokenDetails = tokenCount
					? ` after ${tokenCount} output tokens`
					: '';
				throw new GroqIncompleteResponseError(
					`Groq stopped ${this.modelName}${tokenDetails} before the note was complete. The original note was not modified.`
				);
			}

			const fullText: string = choice?.message?.content ?? '';
			if (!fullText.trim()) {
				throw new GroqIncompleteResponseError(
					`Groq returned an empty response for ${this.modelName}. The original note was not modified.`
				);
			}

			options?.onToken?.(fullText);

			return fullText;
		} catch (error) {
			if (error instanceof GroqIncompleteResponseError) {
				throw error;
			}

			console.error('[ERROR] Error while reaching Groq API:', error);
			throw new Error('Unable to communicate with Groq.');
		}
	}
}
