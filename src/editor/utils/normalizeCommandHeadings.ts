/**
 * Dans une fiche de référence de commandes, remplace les anciens libellés HTML
 * soulignés par des titres H5 discrets. Les blocs de code et la frontmatter ne
 * sont jamais modifiés.
 */
export function normalizeCommandHeadings(content: string): string {
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

			const underlinedLabel = line.match(/^\s*<u>(.+)<\/u>\s*$/i)?.[1];
			if (!underlinedLabel) {
				return line;
			}

			const heading = underlinedLabel.trim().replace(/[\s:：]+$/u, '');
			return heading ? `##### ${heading}` : line;
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
