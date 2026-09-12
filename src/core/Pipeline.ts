import { LLMProvider } from '../llm/types/LLMProvider.js';
import { Proposal } from '../types/Proposal.js';
import { NoteAnalyzer } from '../analyzer/NoteAnalyzer.js';
import { NoteEditor } from '../editor/NoteEditor.js';
import { ChangePlanner } from '../planner/ChangePlanner.js';

export class Pipeline {
	private analyzer: NoteAnalyzer;
	private editor: NoteEditor;
	private planner: ChangePlanner;

	constructor(
		analyzerProvider: LLMProvider,
		editorProvider: LLMProvider = analyzerProvider
	) {
		this.analyzer = new NoteAnalyzer(analyzerProvider);
		this.editor = new NoteEditor(editorProvider);
		this.planner = new ChangePlanner();
	}

	/**
	 * @param originalContent Markdown from the note to improve. It is read by
	 *   VaultService beforehand, so the pipeline itself never touches disk.
	 * @param existingNotes Titles of other vault notes used by NoteEditor's
	 *   deterministic linker. The caller must exclude the active note.
	 */
	async run(
		originalContent: string,
		existingNotes: string[]
	): Promise<Proposal | null> {
		const analysis = await this.analyzer.analyze(originalContent);

		// No onToken callback is needed here: the plugin has no token-by-token
		// output surface. The caller communicates progress through Notices.
		const modifiedContent = await this.editor.edit(
			originalContent,
			analysis,
			existingNotes
		);

		return this.planner.createProposal(originalContent, modifiedContent);
	}
}
