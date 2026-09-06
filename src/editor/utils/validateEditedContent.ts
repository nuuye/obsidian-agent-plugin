const MINIMUM_LENGTH_RATIO = 0.7;
const MINIMUM_CHECKED_ORIGINAL_LENGTH = 1000;

/**
 * The editor is instructed to preserve all relevant information, so a large
 * size reduction is evidence of an incomplete model response rather than a
 * legitimate rewrite. This protects providers that omit a useful
 * finish_reason or stop unexpectedly despite returning HTTP 200.
 */
export function validateEditedContent(
	originalContent: string,
	editedContent: string
): void {
	if (!editedContent.trim()) {
		throw new Error(
			'The generated note is empty. The original note was not modified.'
		);
	}

	if (originalContent.length < MINIMUM_CHECKED_ORIGINAL_LENGTH) {
		return;
	}

	const lengthRatio = editedContent.length / originalContent.length;
	if (lengthRatio < MINIMUM_LENGTH_RATIO) {
		throw new Error(
			`The generated note looks incomplete (${Math.round(lengthRatio * 100)}% of the original length). The original note was not modified.`
		);
	}
}
