import { Proposal } from '../types/Proposal.js';
import { ProposedChange, TextEdit } from '../types/Changes.js';

export interface ApplyChangesResult {
	content: string;
	/** Changes whose expected source text did not match the original note. */
	skippedChanges: ProposedChange[];
}

export class MarkdownEditor {
	/**
	 * Builds the final note from the accepted changes.
	 *
	 * Offsets refer to the original note, so edits are applied from the end
	 * backwards. This prevents a replacement from shifting the coordinates of
	 * edits that occur earlier in the document.
	 */
	applyChanges(
		proposal: Proposal,
		acceptedChanges: ProposedChange[]
	): ApplyChangesResult {
		if (acceptedChanges.length === 0) {
			return { content: proposal.originalContent, skippedChanges: [] };
		}

		// The generated note is authoritative when every change is accepted;
		// rebuilding it from individual edits would add needless failure modes.
		if (acceptedChanges.length === proposal.changes.length) {
			return { content: proposal.modifiedContent, skippedChanges: [] };
		}

		let workingContent = proposal.originalContent;
		const skippedChanges: ProposedChange[] = [];
		const applicableEdits: TextEdit[] = [];

		for (const change of acceptedChanges) {
			const edits = change.edits ?? [
				{
					start: change.start,
					end: change.end,
					before: change.before,
					after: change.after,
				},
			];
			const isApplicable = edits.every((edit) =>
				this.isApplicableEdit(proposal.originalContent, edit)
			);

			if (!isApplicable) {
				skippedChanges.push(change);
				continue;
			}

			applicableEdits.push(...edits);
		}

		applicableEdits.sort((a, b) => b.start - a.start);
		for (const edit of applicableEdits) {
			workingContent =
				workingContent.slice(0, edit.start) +
				edit.after +
				workingContent.slice(edit.end);
		}

		if (skippedChanges.length > 0) {
			console.warn(
				`[WARN] ${skippedChanges.length} changement(s) n'ont pas pu être appliqués précisément :`,
				skippedChanges.map((c) => c.description)
			);
		}

		return { content: workingContent, skippedChanges };
	}

	private isApplicableEdit(originalContent: string, edit: TextEdit): boolean {
		const hasValidRange =
			Number.isInteger(edit.start) &&
			Number.isInteger(edit.end) &&
			edit.start >= 0 &&
			edit.end >= edit.start &&
			edit.end <= originalContent.length;

		// Checking both the range and its exact contents prevents stale or
		// malformed offsets from replacing unrelated text.
		return (
			hasValidRange &&
			originalContent.slice(edit.start, edit.end) === edit.before
		);
	}
}
