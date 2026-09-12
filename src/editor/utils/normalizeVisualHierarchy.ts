/**
 * Converts a standalone bold label immediately before a list into a real H3
 * subsection. Bold labels inside list items remain unchanged, producing a
 * clearer hierarchy without restructuring ordinary prose.
 */
export function normalizeVisualHierarchy(content: string): string {
	const lines = content.split(/\r?\n/);
	const frontmatterEnd = findFrontmatterEnd(lines);
	let activeFence: '```' | '~~~' | null = null;

	return lines
		.map((line, index) => {
			if (frontmatterEnd !== null && index <= frontmatterEnd) {
				return line;
			}

			const fenceMatch = line.match(/^\s*(```|~~~)/);
			if (fenceMatch?.[1]) {
				const marker = fenceMatch[1] as '```' | '~~~';
				if (activeFence === null) {
					activeFence = marker;
				} else if (activeFence === marker) {
					activeFence = null;
				}
				return line;
			}

			if (activeFence !== null) {
				return line;
			}

			const label = line.match(/^\s*\*\*(.+)\*\*\s*$/)?.[1]?.trim();
			if (!label) {
				return line;
			}

			// Blank lines between the label and the list are allowed, so inspect
			// the next non-empty line rather than only the adjacent one.
			const nextContentLine = lines
				.slice(index + 1)
				.find((candidate) => candidate.trim() !== '');
			const startsList = /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(
				nextContentLine ?? ''
			);
			return startsList ? `### ${label.replace(/[\s:：]+$/u, '')}` : line;
		})
		.join('\n');
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
