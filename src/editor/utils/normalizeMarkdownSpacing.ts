/**
 * Normalizes structural blank lines without changing fenced code content:
 * - no blank line between YAML frontmatter and the document;
 * - exactly one blank line after each ATX Markdown heading.
 */
export function normalizeMarkdownSpacing(content: string): string {
	const lines = content.split(/\r?\n/);
	const output: string[] = [];
	const frontmatterEnd = findFrontmatterEnd(lines);
	let activeFence: '```' | '~~~' | null = null;

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index] ?? '';

		if (frontmatterEnd !== null && index <= frontmatterEnd) {
			output.push(line);
			if (index === frontmatterEnd) {
				while (lines[index + 1]?.trim() === '') {
					index++;
				}
			}
			continue;
		}

		const fenceMatch = line.match(/^\s*(```|~~~)/);
		if (fenceMatch?.[1]) {
			// Track the opening marker so headings inside code examples are left
			// untouched, including fences that use tildes instead of backticks.
			const marker = fenceMatch[1] as '```' | '~~~';
			if (activeFence === null) {
				activeFence = marker;
			} else if (activeFence === marker) {
				activeFence = null;
			}
			output.push(line);
			continue;
		}

		if (activeFence === null && /^#{1,6}\s+\S/.test(line)) {
			output.push(line);
			while (lines[index + 1]?.trim() === '') {
				index++;
			}
			if (index + 1 < lines.length) {
				output.push('');
			}
			continue;
		}

		output.push(line);
	}

	return output.join('\n');
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
