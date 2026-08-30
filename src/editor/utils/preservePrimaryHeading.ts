/**
 * Restaure le premier titre H1 de la note originale après les transformations
 * du LLM et le linking déterministe. Le titre d'une note est son identité : le
 * modèle peut corriger son contenu, mais ne doit ni le renommer ni lui ajouter
 * un suffixe éditorial comme « aperçu ».
 */
export function preservePrimaryHeading(
	originalContent: string,
	modifiedContent: string
): string {
	const originalLines = originalContent.split(/\r?\n/);
	const originalHeadingIndex = findPrimaryHeadingIndex(originalLines);
	if (originalHeadingIndex === null) {
		return modifiedContent;
	}

	const originalHeading = originalLines[originalHeadingIndex];
	if (!originalHeading) {
		return modifiedContent;
	}

	const modifiedLines = modifiedContent.split(/\r?\n/);
	const modifiedHeadingIndex = findPrimaryHeadingIndex(modifiedLines);
	if (modifiedHeadingIndex !== null) {
		modifiedLines[modifiedHeadingIndex] = originalHeading;
		return modifiedLines.join('\n');
	}

	const frontmatterEnd = findFrontmatterEnd(modifiedLines);
	const insertionIndex = frontmatterEnd === null ? 0 : frontmatterEnd + 1;
	modifiedLines.splice(insertionIndex, 0, originalHeading, '');
	return modifiedLines.join('\n');
}

function findPrimaryHeadingIndex(lines: string[]): number | null {
	const frontmatterEnd = findFrontmatterEnd(lines);
	let activeFence: '```' | '~~~' | null = null;

	for (let index = 0; index < lines.length; index++) {
		if (frontmatterEnd !== null && index <= frontmatterEnd) {
			continue;
		}

		const line = lines[index] ?? '';
		const fenceMatch = line.match(/^\s*(```|~~~)/);
		if (fenceMatch?.[1]) {
			const marker = fenceMatch[1] as '```' | '~~~';
			if (activeFence === null) {
				activeFence = marker;
			} else if (activeFence === marker) {
				activeFence = null;
			}
			continue;
		}

		if (activeFence === null && /^#(?!#)\s+\S/.test(line)) {
			return index;
		}
	}

	return null;
}

function findFrontmatterEnd(lines: string[]): number | null {
	if (lines[0]?.trim() !== '---') {
		return null;
	}

	for (let index = 1; index < lines.length; index++) {
		if (lines[index]?.trim() === '---') {
			return index;
		}
	}

	return null;
}
