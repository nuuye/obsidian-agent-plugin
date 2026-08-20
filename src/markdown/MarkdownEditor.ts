import { Proposal } from '../types/Proposal.js';
import { ProposedChange } from '../types/Changes.js';

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
		const sortedChanges = [...acceptedChanges].sort(
			(a, b) => b.start - a.start
		);

		for (const change of sortedChanges) {
			const hasValidRange =
				Number.isInteger(change.start) &&
				Number.isInteger(change.end) &&
				change.start >= 0 &&
				change.end >= change.start &&
				change.end <= proposal.originalContent.length;
			const currentText = hasValidRange
				? workingContent.slice(change.start, change.end)
				: null;

			if (!hasValidRange || currentText !== change.before) {
				skippedChanges.push(change);
				continue;
			}

			workingContent =
				workingContent.slice(0, change.start) +
				change.after +
				workingContent.slice(change.end);
		}

		if (skippedChanges.length > 0) {
			console.warn(
				`[WARN] ${skippedChanges.length} changement(s) n'ont pas pu être appliqués précisément :`,
				skippedChanges.map((c) => c.description)
			);
		}

		return { content: workingContent, skippedChanges };
	}
}
