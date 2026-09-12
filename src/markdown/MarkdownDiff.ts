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
 * Computes changes between two notes entirely in memory.
 *
 * The diff works on line-sized Markdown units and groups consecutive edits.
 * Myers' algorithm avoids allocating a full LCS matrix. Its trace is still
 * bounded: a near-total rewrite falls back to a coarser change rather than
 * exhausting memory, especially on mobile devices.
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

		// Consecutive insert/delete operations describe one visible replacement.
		// Equal content acts as the boundary that flushes the pending group.
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

			// Keep Mermaid blocks separate from adjacent prose so users cannot
			// accept only half of a diagram-related change.
			const operationIsMermaid = this.isMermaidBlock(operation.value);
			const pendingIsMermaid = pending
				? this.isMermaidBlock(
						pending.before.join('') + pending.after.join('')
					)
				: operationIsMermaid;
			if (pending && operationIsMermaid !== pendingIsMermaid) {
				flushPending();
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
		// A moved rewrite often appears as a deletion plus an insertion. Grouping
		// those drafts presents it as one coherent choice in the review modal.
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
		// Union-find keeps transitively related drafts in the same group without
		// repeatedly merging arrays as new relationships are discovered.
		const parents = drafts.map((_, index) => index);
		const findRoot = (index: number): number => {
			let root = index;
			while (parents[root] !== root) {
				root = parents[root] ?? root;
			}

			// Path compression keeps subsequent root lookups nearly constant-time.
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

				// Compare both directions because a moved passage may be represented
				// as insertion→deletion or deletion→insertion by the line diff.
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
		// Sørensen-Dice similarity over unique words is intentionally insensitive
		// to Markdown formatting and small word-order changes.
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

	private isMermaidBlock(content: string): boolean {
		return /^\s*(?:`{3,}|~{3,})\s*mermaid\b/im.test(content);
	}

	/**
	 * Keeps each fenced block as an indivisible unit. Otherwise identical fence
	 * lines from different blocks can be matched together, allowing a partial
	 * selection to retain a closing fence while removing its opening fence.
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
		// Myers' algorithm explores edit paths by increasing distance. For each
		// diagonal, frontier stores the furthest original index reached so far.
		const maximumDistance = original.length + modified.length;
		const frontier = new Map<number, number>([[1, 0]]);
		const trace: Array<Map<number, number>> = [];

		for (let distance = 0; distance <= maximumDistance; distance++) {
			// Trace storage grows quadratically with edit distance. Fall back before
			// retaining enough frontier snapshots to create memory pressure.
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
		// Preserve the common prefix and suffix, then expose the entire differing
		// middle as one replacement. This keeps the fallback safe and predictable.
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
		// Walk the saved frontiers backwards to reconstruct the shortest edit
		// script. Operations are collected in reverse document order.
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
		// Array.prototype.at() is newer than the project's ES2021 target and is
		// therefore inferred as an unsafe value by the submission scanner.
		const lastHeading = headings[headings.length - 1];
		const heading = lastHeading?.[1]?.trim();
		return heading || null;
	}
}
