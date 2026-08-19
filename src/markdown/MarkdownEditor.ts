import { Proposal } from '../types/Proposal';
import { ProposedChange } from '../types/Changes';

export class MarkdownEditor {
	/**
	 * Build the final content depending on accepted changes
	 */
	applyChanges(
		proposal: Proposal,
		acceptedChanges: ProposedChange[]
	): string {
		// If the user declined everything, we return the original note
		if (acceptedChanges.length === 0) {
			return proposal.originalContent;
		}

		// If the user accepted everythink, we return the complete new note
		if (acceptedChanges.length === proposal.changes.length) {
			return proposal.modifiedContent;
		}

		// TODO: Implement partial modified note logic
		// Might need to use LLM call again
		console.warn(
			'[WARN] Applying partial changes is not implemented yet. Complete changes are going to be returned.'
		);
		return proposal.modifiedContent;
	}
}
