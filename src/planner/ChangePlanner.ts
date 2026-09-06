import { Proposal } from '../types/Proposal.js';
import { MarkdownDiff } from '../markdown/MarkdownDiff.js';

export class ChangePlanner {
	private markdownDiff = new MarkdownDiff();

	/**
	 * Does not call the LLM. The diff and its user-facing descriptions are
	 * derived locally from the original and generated note versions.
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
