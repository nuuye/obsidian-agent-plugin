import {
	ChangeType,
	ProposedChange,
} from '../types/Changes.js';

type DiffOperation =
	| { kind: 'equal'; value: string }
	| { kind: 'delete'; value: string }
	| { kind: 'insert'; value: string };

interface PendingChange {
	start: number;
	end: number;
	modifiedStart: number;
	before: string[];
	after: string[];
}

/**
 * Calcule localement les changements entre deux notes.
 *
 * Le diff travaille par lignes : une ligne modifiée devient un changement
 * atomique, tandis que plusieurs lignes modifiées consécutives sont regroupées.
 * L'algorithme de Myers n'alloue pas de matrice LCS complète. Une garde limite
 * néanmoins son historique : dans le cas extrême d'une réécriture presque
 * totale, on préfère produire un changement plus grossier que saturer la
 * mémoire d'un appareil mobile.
 */
export class MarkdownDiff {
	private static readonly MAX_TRACE_ENTRIES = 1_000_000;

	createChanges(original: string, modified: string): ProposedChange[] {
		if (original === modified) {
			return [];
		}

		const operations = this.diffLines(
			this.splitLines(original),
			this.splitLines(modified)
		);
		const changes: ProposedChange[] = [];
		let originalOffset = 0;
		let modifiedOffset = 0;
		let pending: PendingChange | null = null;

		const flushPending = () => {
			if (!pending) {
				return;
			}

			const before = pending.before.join('');
			const after = pending.after.join('');
			if (before !== after) {
				const section =
					this.findSection(original, pending.start) ??
					this.findSection(modified, pending.modifiedStart);
				const type = this.classifyChange(before, after);

				changes.push({
					id: `change-${changes.length + 1}`,
					type,
					description: this.describeChange(type, before, after, section),
					status: 'pending',
					start: pending.start,
					end: pending.end,
					before,
					after,
				});
			}

			pending = null;
		};

		for (const operation of operations) {
			if (operation.kind === 'equal') {
				flushPending();
				originalOffset += operation.value.length;
				modifiedOffset += operation.value.length;
				continue;
			}

			pending ??= {
				start: originalOffset,
				end: originalOffset,
				modifiedStart: modifiedOffset,
				before: [],
				after: [],
			};

			if (operation.kind === 'delete') {
				pending.before.push(operation.value);
				originalOffset += operation.value.length;
				pending.end = originalOffset;
			} else {
				pending.after.push(operation.value);
				modifiedOffset += operation.value.length;
			}
		}

		flushPending();
		return changes;
	}

	private splitLines(content: string): string[] {
		if (!content) {
			return [];
		}
		return content.match(/[^\n]*\n|[^\n]+$/g) ?? [];
	}

	private diffLines(original: string[], modified: string[]): DiffOperation[] {
		const maximumDistance = original.length + modified.length;
		const frontier = new Map<number, number>([[1, 0]]);
		const trace: Array<Map<number, number>> = [];

		for (let distance = 0; distance <= maximumDistance; distance++) {
			if (
				(distance + 1) * (distance + 1) >
				MarkdownDiff.MAX_TRACE_ENTRIES
			) {
				return this.createCoarseDiff(original, modified);
			}

			trace.push(new Map(frontier));

			for (
				let diagonal = -distance;
				diagonal <= distance;
				diagonal += 2
			) {
				const fromDeletion = frontier.get(diagonal - 1);
				const fromInsertion = frontier.get(diagonal + 1);
				const shouldInsert =
					diagonal === -distance ||
					(diagonal !== distance &&
						(fromDeletion ?? Number.NEGATIVE_INFINITY) <
							(fromInsertion ?? Number.NEGATIVE_INFINITY));
				let x = shouldInsert
					? fromInsertion ?? 0
					: (fromDeletion ?? 0) + 1;
				let y = x - diagonal;

				while (
					x < original.length &&
					y < modified.length &&
					original[x] === modified[y]
				) {
					x++;
					y++;
				}

				frontier.set(diagonal, x);
				if (x >= original.length && y >= modified.length) {
					return this.backtrack(original, modified, trace);
				}
			}
		}

		throw new Error('Unable to calculate the Markdown diff.');
	}

	private createCoarseDiff(
		original: string[],
		modified: string[]
	): DiffOperation[] {
		let prefixLength = 0;
		while (
			prefixLength < original.length &&
			prefixLength < modified.length &&
			original[prefixLength] === modified[prefixLength]
		) {
			prefixLength++;
		}

		let originalSuffix = original.length;
		let modifiedSuffix = modified.length;
		while (
			originalSuffix > prefixLength &&
			modifiedSuffix > prefixLength &&
			original[originalSuffix - 1] === modified[modifiedSuffix - 1]
		) {
			originalSuffix--;
			modifiedSuffix--;
		}

		return [
			...original
				.slice(0, prefixLength)
				.map((value): DiffOperation => ({ kind: 'equal', value })),
			...original
				.slice(prefixLength, originalSuffix)
				.map((value): DiffOperation => ({ kind: 'delete', value })),
			...modified
				.slice(prefixLength, modifiedSuffix)
				.map((value): DiffOperation => ({ kind: 'insert', value })),
			...original
				.slice(originalSuffix)
				.map((value): DiffOperation => ({ kind: 'equal', value })),
		];
	}

	private backtrack(
		original: string[],
		modified: string[],
		trace: Array<Map<number, number>>
	): DiffOperation[] {
		const operations: DiffOperation[] = [];
		let x = original.length;
		let y = modified.length;

		for (let distance = trace.length - 1; distance >= 0; distance--) {
			const frontier = trace[distance];
			if (!frontier) {
				continue;
			}

			const diagonal = x - y;
			const fromDeletion = frontier.get(diagonal - 1);
			const fromInsertion = frontier.get(diagonal + 1);
			const shouldInsert =
				diagonal === -distance ||
				(diagonal !== distance &&
					(fromDeletion ?? Number.NEGATIVE_INFINITY) <
						(fromInsertion ?? Number.NEGATIVE_INFINITY));
			const previousDiagonal = shouldInsert
				? diagonal + 1
				: diagonal - 1;
			const previousX = frontier.get(previousDiagonal) ?? 0;
			const previousY = previousX - previousDiagonal;

			while (x > previousX && y > previousY) {
				const value = original[x - 1];
				if (value !== undefined) {
					operations.push({ kind: 'equal', value });
				}
				x--;
				y--;
			}

			if (distance === 0) {
				break;
			}

			if (x === previousX) {
				const value = modified[y - 1];
				if (value !== undefined) {
					operations.push({ kind: 'insert', value });
				}
				y--;
			} else {
				const value = original[x - 1];
				if (value !== undefined) {
					operations.push({ kind: 'delete', value });
				}
				x--;
			}
		}

		return operations.reverse();
	}

	private classifyChange(before: string, after: string): ChangeType {
		if (/```mermaid\b/i.test(before) || /```mermaid\b/i.test(after)) {
			return 'schema';
		}

		if (this.getAddedLinks(before, after).length > 0) {
			return 'link';
		}

		if (!before) {
			return 'new content';
		}

		if (
			before.replace(/\s/g, '') === after.replace(/\s/g, '') ||
			this.withoutMarkdownFormatting(before) ===
				this.withoutMarkdownFormatting(after)
		) {
			return 'formatting';
		}

		return 'content';
	}

	private describeChange(
		type: ChangeType,
		before: string,
		after: string,
		section: string | null
	): string {
		const location = section ? ` in “${section}”` : '';

		if (type === 'schema') {
			return `${before ? 'Updates' : 'Adds'} a Mermaid diagram${location}.`;
		}

		if (type === 'link') {
			const links = this.getAddedLinks(before, after);
			const names = links.slice(0, 3).join(', ');
			return `Adds ${links.length === 1 ? 'a link' : 'links'} to ${names}${location}.`;
		}

		if (type === 'formatting') {
			const whitespaceOnly =
				before.replace(/\s/g, '') === after.replace(/\s/g, '');
			return `${whitespaceOnly ? 'Cleans up spacing' : 'Corrects Markdown formatting'}${location}.`;
		}

		if (!before) {
			return `Adds new content${location}.`;
		}

		if (!after) {
			return `Removes content${location}.`;
		}

		return `Updates content${location}.`;
	}

	private getAddedLinks(before: string, after: string): string[] {
		const extractLinks = (content: string): string[] =>
			[...content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)].map(
				(match) => match[1] ?? ''
			);
		const previousLinks = new Set(extractLinks(before));
		return [...new Set(extractLinks(after))].filter(
			(link) => link && !previousLinks.has(link)
		);
	}

	private withoutMarkdownFormatting(content: string): string {
		return content
			.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
			.replace(/\[\[([^\]]+)\]\]/g, '$1')
			.replace(/[*_~`#>-]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	private findSection(content: string, offset: number): string | null {
		const prefix = content.slice(0, offset);
		const headings = [...prefix.matchAll(/^#{1,6}\s+(.+)$/gm)];
		const heading = headings.at(-1)?.[1]?.trim();
		return heading || null;
	}
}
