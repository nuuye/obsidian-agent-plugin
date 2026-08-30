import { Proposal } from '../types/Proposal.js';
import { MarkdownDiff } from '../markdown/MarkdownDiff.js';

export class ChangePlanner {
	private markdownDiff = new MarkdownDiff();

	/**
	 * Ne fait pas appel au LLM. Le diff et ses descriptions sont calculés
	 * localement à partir des deux versions de la note.
	 */
	createProposal(
		originalContent: string,
		modifiedContent: string
	): Proposal {
		return {
			originalContent,
			modifiedContent,
			changes: this.markdownDiff.createChanges(
				originalContent,
				modifiedContent
			),
		};
	}
}
