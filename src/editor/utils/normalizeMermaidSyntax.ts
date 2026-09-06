/**
 * Applies small, deterministic Mermaid repairs without touching ordinary code
 * fences. Mermaid class assignments require comma-separated node IDs without
 * spaces (for example: `class A,B root`), and edge labels containing syntax
 * characters must be quoted.
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

			const normalizedClasses = /^\s*class\s+/.test(line)
				? line.replace(/\s*,\s*/g, ',')
				: line;

			return normalizedClasses.replace(
				/\|([^|\r\n]+)\|/g,
				(match, label: string) => {
					const trimmedLabel = label.trim();

					if (
						!/[()[\]{}:;]/.test(trimmedLabel) ||
						(/^".*"$/.test(trimmedLabel) && trimmedLabel.length >= 2)
					) {
						return match;
					}

					const escapedLabel = trimmedLabel.replace(/"/g, '#quot;');
					return `|"${escapedLabel}"|`;
				}
			);
		})
		.join('\n');
}
