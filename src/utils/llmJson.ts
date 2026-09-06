/**
 * Cleans a raw LLM response into a parseable JSON string. It handles Markdown
 * fences and residual <think> tags, then falls back to the outermost object
 * delimiters when the model adds prose around the requested JSON.
 */
export function extractJson(response: string): string {
	let text = response.trim();

	// Models may expose reasoning tags despite being instructed not to do so.
	text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

	// Remove both explicit ```json fences and unlabelled fences.
	text = text.replace(/```json\n?|\n?```/gi, '').trim();

	// Use the first opening and last closing brace as a defensive fallback when
	// introductory or trailing prose remains around the object.
	const firstBrace = text.indexOf('{');
	const lastBrace = text.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		text = text.slice(firstBrace, lastBrace + 1);
	}

	return text;
}

/**
 * Parses an LLM response as typed JSON and includes a short raw preview in the
 * error message. The preview makes malformed model output diagnosable without
 * rerunning the request with temporary logging.
 */
export function parseJsonFromLLM<T>(response: string, errorContext: string): T {
	const cleaned = extractJson(response);
	try {
		return JSON.parse(cleaned) as T;
	} catch (e) {
		const preview = response.slice(0, 500);
		throw new Error(
			`${errorContext} — JSON invalide. Aperçu de la réponse brute (500 premiers caractères) :\n${preview}`
		);
	}
}
