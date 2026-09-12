import { LLMProvider, GenerateOptions } from './types/LLMProvider';

interface OllamaStreamChunk {
	response?: string;
	done?: boolean;
}

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

		// Streaming is useful only when a consumer can render incremental tokens.
		const isStreaming = !!options?.onToken;

		try {
			const response = await fetch(`${this.baseUrl}/api/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: this.model,
					prompt: finalPrompt,
					stream: isStreaming,
				}),
			});

			if (!response.ok)
				throw new Error(`Erreur HTTP: ${response.status}`);

			// Ollama streams newline-delimited JSON objects, not an SSE envelope.
			if (isStreaming && response.body) {
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let fullText = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value, { stream: true });
					// Ollama emits NDJSON. This parser currently assumes each network
					// chunk ends on a complete record boundary.
					const lines = chunk.split('\n').filter(Boolean);

					for (const line of lines) {
						const parsed = JSON.parse(line) as OllamaStreamChunk;
						if (parsed.response) {
							fullText += parsed.response;
							// Forward each generated fragment to the UI immediately.
							options.onToken!(parsed.response);
						}
					}
				}
				return fullText;
			}

			// Without a callback, request one regular JSON response.
			const data = (await response.json()) as OllamaGenerateResponse;
			let responseText: string = data.response ?? '';

			if (options?.skipThinking) {
				responseText = responseText
					.replace(/<think>[\s\S]*?<\/think>/g, '')
					.trim();
			}
			return responseText;
		} catch (error) {
			console.error('Erreur de connexion à Ollama :', error);
			throw new Error('Impossible de communiquer avec le LLM local.');
		}
	}
}
