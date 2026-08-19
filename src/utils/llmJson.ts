/**
 * Nettoie une réponse LLM brute pour en extraire un JSON exploitable.
 * Gère : les fences ```json, les balises <think>...</think> résiduelles
 * (au cas où un modèle "réfléchisse" malgré la consigne de ne pas le faire),
 * et se rabat sur le premier bloc { ... } équilibré si du texte parasite
 * entoure encore le JSON.
 */
export function extractJson(response: string): string {
	let text = response.trim();

	// Retire les balises de raisonnement explicites si le modèle les inclut
	// malgré la consigne (utile si on change de modèle/provider à l'avenir).
	text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

	// Retire les fences ```json ... ``` ou ``` ... ```
	text = text.replace(/```json\n?|\n?```/gi, '').trim();

	// Filet de sécurité : extrait le premier bloc JSON équilibré plutôt que
	// de faire confiance à toute la chaîne (utile si le modèle ajoute une
	// phrase d'intro/conclusion malgré la consigne "réponds UNIQUEMENT en JSON").
	const firstBrace = text.indexOf('{');
	const lastBrace = text.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		text = text.slice(firstBrace, lastBrace + 1);
	}

	return text;
}

/**
 * Parse une réponse LLM en JSON typé, avec un message d'erreur exploitable
 * incluant un extrait de la réponse brute en cas d'échec (au lieu d'une
 * erreur générique qui oblige à rejouer la requête avec des logs ajoutés
 * à la main pour comprendre ce qui a cassé).
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
