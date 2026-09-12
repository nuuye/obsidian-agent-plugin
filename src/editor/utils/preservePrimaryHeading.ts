/**
 * Restores the original note's first H1 after LLM and deterministic
 * transformations. The primary heading is treated as the note's identity and
 * must not be renamed or decorated by the model.
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
	// If the model removed the H1 entirely, restore it after frontmatter so the
	// YAML block remains the first construct in the document.
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
