export interface GroqModelRoute {
	analyzerModel: string;
	editorModel: string;
	estimatedNoteTokens: number;
	usesDedicatedAnalyzer: boolean;
}

/**
 * Markdown, French prose and code do not all tokenize at the same rate.
 * Three characters per token deliberately errs on the safe side without
 * adding a tokenizer dependency to the plugin bundle.
 */
export function estimateNoteTokens(content: string): number {
	return Math.ceil(content.length / 3);
}

export function selectGroqModels(
	content: string,
	editorModel: string,
	longNoteAnalyzerModel: string,
	longNoteThreshold: number
): GroqModelRoute {
	const estimatedNoteTokens = estimateNoteTokens(content);
	const normalizedThreshold = Math.max(1, Math.floor(longNoteThreshold));
	const analyzerModel = longNoteAnalyzerModel.trim() || editorModel;
	const usesDedicatedAnalyzer =
		estimatedNoteTokens >= normalizedThreshold &&
		analyzerModel !== editorModel;

	return {
		analyzerModel: usesDedicatedAnalyzer ? analyzerModel : editorModel,
		editorModel,
		estimatedNoteTokens,
		usesDedicatedAnalyzer,
	};
}
