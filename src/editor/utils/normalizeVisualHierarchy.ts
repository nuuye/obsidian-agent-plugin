/**
 * Convertit un faux titre en gras placé juste avant une liste en véritable
 * sous-section H3. Les noms importants à l'intérieur des puces restent en gras,
 * ce qui crée une hiérarchie visuelle nette sans surcharger la note.
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
