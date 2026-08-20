import {
	ChangeType,
	ProposedChange,
	TextEdit,
} from '../types/Changes.js';

type DiffOperation =
	| { kind: 'equal'; value: string }
	| { kind: 'delete'; value: string }
	| { kind: 'insert'; value: string };

interface PendingChange {
	start: number;
	end: number;
	modifiedStart: number;
	modifiedEnd: number;
	before: string[];
	after: string[];
}

interface DraftChange extends TextEdit {
	modifiedStart: number;
	modifiedEnd: number;
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
			this.splitMarkdownUnits(original),
			this.splitMarkdownUnits(modified)
		);
		const draftChanges: DraftChange[] = [];
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
				draftChanges.push({
					start: pending.start,
					end: pending.end,
					modifiedStart: pending.modifiedStart,
					modifiedEnd: pending.modifiedEnd,
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
				modifiedEnd: modifiedOffset,
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
				pending.modifiedEnd = modifiedOffset;
			}
		}

		flushPending();
		return this.buildProposedChanges(original, modified, draftChanges);
	}

	private buildProposedChanges(
		original: string,
		modified: string,
		drafts: DraftChange[]
	): ProposedChange[] {
		const groups = this.groupDependentDrafts(drafts);

		return groups
			.sort(
				(a, b) =>
					Math.min(...a.map((edit) => edit.start)) -
					Math.min(...b.map((edit) => edit.start))
			)
			.map((group, index) => {
				const deletion = group.find((edit) => edit.before && !edit.after);
				const insertion = group.find((edit) => !edit.before && edit.after);
				const before = deletion?.before ?? group.map((edit) => edit.before).join('');
				const after = insertion?.after ?? group.map((edit) => edit.after).join('');
				const start = Math.min(...group.map((edit) => edit.start));
				const end = Math.max(...group.map((edit) => edit.end));
				const modifiedStart = Math.min(
					...group.map((edit) => edit.modifiedStart)
				);
				const section =
					this.findSection(original, start) ??
					this.findSection(modified, modifiedStart);
				const type = this.classifyChange(before, after);

				return {
					id: `change-${index + 1}`,
					type,
					description: this.describeChange(type, before, after, section),
					status: 'pending',
					edits: group.map(({ start, end, before, after }) => ({
						start,
						end,
						before,
						after,
					})),
					start,
					end,
					before,
					after,
				};
			});
	}

	private groupDependentDrafts(drafts: DraftChange[]): DraftChange[][] {
		const parents = drafts.map((_, index) => index);
		const findRoot = (index: number): number => {
			let root = index;
			while (parents[root] !== root) {
				root = parents[root] ?? root;
			}

			let current = index;
			while (parents[current] !== current) {
				const next = parents[current] ?? root;
				parents[current] = root;
				current = next;
			}
			return root;
		};
		const union = (left: number, right: number) => {
			const leftRoot = findRoot(left);
			const rightRoot = findRoot(right);
			if (leftRoot !== rightRoot) {
				parents[rightRoot] = leftRoot;
			}
		};

		for (let leftIndex = 0; leftIndex < drafts.length; leftIndex++) {
			const left = drafts[leftIndex];
			if (!left) {
				continue;
			}

			for (
				let rightIndex = leftIndex + 1;
				rightIndex < drafts.length;
				rightIndex++
			) {
				const right = drafts[rightIndex];
				if (!right) {
					continue;
				}

				const forwardScore = this.textSimilarity(
					left.after,
					right.before
				);
				const backwardScore = this.textSimilarity(
					right.after,
					left.before
				);
				const isInsertionDeletionPair =
					(this.isInsertion(left) && this.isDeletion(right)) ||
					(this.isDeletion(left) && this.isInsertion(right));
				const isCrossedReplacement =
					forwardScore >= 0.6 && backwardScore >= 0.6;

				if (
					isCrossedReplacement ||
					(isInsertionDeletionPair &&
						Math.max(forwardScore, backwardScore) >= 0.6)
				) {
					union(leftIndex, rightIndex);
				}
			}
		}

		const groupedByRoot = new Map<number, DraftChange[]>();
		for (let index = 0; index < drafts.length; index++) {
			const draft = drafts[index];
			if (!draft) {
				continue;
			}
			const root = findRoot(index);
			const group = groupedByRoot.get(root) ?? [];
			group.push(draft);
			groupedByRoot.set(root, group);
		}

		return [...groupedByRoot.values()];
	}

	private isInsertion(change: DraftChange): boolean {
		return !change.before && Boolean(change.after);
	}

	private isDeletion(change: DraftChange): boolean {
		return Boolean(change.before) && !change.after;
	}

	private textSimilarity(left: string, right: string): number {
		const tokenize = (value: string): Set<string> =>
			new Set(
				this.withoutMarkdownFormatting(value)
					.toLocaleLowerCase()
					.match(/[\p{L}\p{N}]+/gu) ?? []
			);
		const leftTokens = tokenize(left);
		const rightTokens = tokenize(right);
		if (leftTokens.size === 0 || rightTokens.size === 0) {
			return 0;
		}

		let commonTokens = 0;
		for (const token of leftTokens) {
			if (rightTokens.has(token)) {
				commonTokens++;
			}
		}

		return (2 * commonTokens) / (leftTokens.size + rightTokens.size);
	}

	private splitLines(content: string): string[] {
		if (!content) {
			return [];
		}
		return content.match(/[^\n]*\n|[^\n]+$/g) ?? [];
	}

	/**
	 * Conserve chaque bloc fenced comme une unité indivisible. Sans cela, les
	 * lignes ``` identiques d'un bloc existant et d'un nouveau diagramme peuvent
	 * être associées entre elles, ce qui permettrait à une sélection partielle de
	 * garder une fermeture tout en supprimant l'ouverture correspondante.
	 */
	private splitMarkdownUnits(content: string): string[] {
		const lines = this.splitLines(content);
		const units: string[] = [];

		for (let index = 0; index < lines.length; index++) {
			const line = lines[index] ?? '';
			const openingMatch = line.match(/^\s*(`{3,}|~{3,})/);
			const openingMarker = openingMatch?.[1];
			if (!openingMarker) {
				units.push(line);
				continue;
			}

			let block = line;
			const markerCharacter = openingMarker[0];
			const hasInlineClosingMarker = line
				.slice((openingMatch?.index ?? 0) + openingMarker.length)
				.includes(openingMarker);
			if (!markerCharacter || hasInlineClosingMarker) {
				units.push(block);
				continue;
			}

			for (index++; index < lines.length; index++) {
				const blockLine = lines[index] ?? '';
				block += blockLine;
				const closingMatch = blockLine.match(/^\s*(`{3,}|~{3,})\s*$/);
				const closingMarker = closingMatch?.[1];
				if (
					closingMarker?.[0] === markerCharacter &&
					closingMarker.length >= openingMarker.length
				) {
					break;
				}
			}

			units.push(block);
		}

		return units;
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
