import { Proposal } from '../types/Proposal.js';
import { ProposedChange, TextEdit } from '../types/Changes.js';

export interface ApplyChangesResult {
	content: string;
	/** Changements qu'on n'a pas pu localiser précisément dans le texte (before introuvable). */
	skippedChanges: ProposedChange[];
}

export class MarkdownEditor {
	/**
	 * Construit le contenu final de la note en fonction des changements acceptés.
	 *
	 * Les offsets ont été calculés dans la note originale. On applique donc les
	 * changements de la fin vers le début afin qu'un remplacement ne décale pas
	 * les positions des changements qui le précèdent.
	 */
	applyChanges(
		proposal: Proposal,
		acceptedChanges: ProposedChange[]
	): ApplyChangesResult {
		if (acceptedChanges.length === 0) {
			return { content: proposal.originalContent, skippedChanges: [] };
		}

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

		return (
			hasValidRange &&
			originalContent.slice(edit.start, edit.end) === edit.before
		);
	}
}
