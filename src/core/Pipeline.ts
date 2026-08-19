import { LLMProvider } from '../llm/types/LLMProvider.js';
import { Proposal } from '../types/Proposal.js';
import { NoteAnalyzer } from '../analyzer/NoteAnalyzer.js';
import { NoteEditor } from '../editor/NoteEditor.js';
import { ChangeReviewer } from '../reviewer/ChangeReviewer.js';
import { ChangePlanner } from '../planner/ChangePlanner.js';

export class Pipeline {
	private analyzer: NoteAnalyzer;
	private editor: NoteEditor;
	private reviewer: ChangeReviewer;
	private planner: ChangePlanner;

	constructor(private llmProvider: LLMProvider) {
		this.analyzer = new NoteAnalyzer(this.llmProvider);
		this.editor = new NoteEditor(this.llmProvider);
		this.reviewer = new ChangeReviewer(this.llmProvider);
		this.planner = new ChangePlanner();
	}

	/**
	 * @param originalContent Contenu Markdown de la note à améliorer (lu au
	 *   préalable via VaultService — le Pipeline ne touche plus au disque).
	 * @param existingNotes Titres des autres notes du vault, pour le linking
	 *   déterministe fait dans NoteEditor (la note courante doit déjà être
	 *   exclue de cette liste par l'appelant).
	 */
	async run(
		originalContent: string,
		existingNotes: string[]
	): Promise<Proposal | null> {
		const analysis = await this.analyzer.analyze(originalContent);

		// Pas de callback onToken ici : dans le plugin, il n'y a pas de
		// terminal où streamer le texte token par token. Le progrès se
		// communique côté appelant via des Notice ("Analyzing…", etc.).
		const modifiedContent = await this.editor.edit(
			originalContent,
			analysis,
			existingNotes
		);

		const changesJson = await this.reviewer.review(
			originalContent,
			modifiedContent
		);

		return this.planner.createProposal(
			originalContent,
			modifiedContent,
			changesJson
		);
	}
}
