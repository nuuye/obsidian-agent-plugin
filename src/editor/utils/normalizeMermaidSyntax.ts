/**
 * Applies small, deterministic Mermaid repairs without touching ordinary code
 * fences. Mermaid class assignments require comma-separated node IDs without
 * spaces (for example: `class A,B root`).
 */
export function normalizeMermaidSyntax(content: string): string {
	const lines = content.split(/\r?\n/);
	let activeFence: '```' | '~~~' | null = null;

	return lines
		.map((line) => {
			if (activeFence === null) {
				const openingFence = line.match(
					/^\s*(```|~~~)\s*mermaid\b/i
				)?.[1] as '```' | '~~~' | undefined;
				if (openingFence) {
					activeFence = openingFence;
				}
				return line;
			}

			if (line.trim() === activeFence) {
				activeFence = null;
				return line;
			}

			if (/^\s*class\s+/.test(line)) {
				return line.replace(/\s*,\s*/g, ',');
			}

			return line;
		})
		.join('\n');
}
