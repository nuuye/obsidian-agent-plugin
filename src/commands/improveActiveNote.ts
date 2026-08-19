import { Notice } from 'obsidian';
import type NoteImproverPlugin from '../main';
import { VaultService } from '../vault/VaultService';
import { Pipeline } from '../core/Pipeline';
import { GroqProvider } from '../llm/GroqProvider';
import { OllamaProvider } from '../llm/OllamaProvider';
import { ReviewModal } from '../ui/ReviewModal';

export async function improveActiveNote(
	plugin: NoteImproverPlugin
): Promise<void> {
	const vaultService = new VaultService(plugin.app);
	const file = vaultService.getActiveMarkdownFile();

	if (!file) {
		new Notice('Open a Markdown note first.');
		return;
	}

	const originalContent = await vaultService.readNote(file);
	const existingNotes = vaultService.getOtherNoteTitles(file);

	const llmProvider =
		plugin.settings.provider === 'groq'
			? new GroqProvider(
					plugin.settings.groqModel,
					plugin.settings.groqApiKey
			)
			: new OllamaProvider(plugin.settings.ollamaModel);

	const pipeline = new Pipeline(llmProvider);
	const statusNotice = new Notice('Analyzing note…', 0);

	try {
		const proposal = await pipeline.run(originalContent, existingNotes);
		statusNotice.hide();

		if (!proposal) {
			new Notice('No proposal generated.');
			return;
		}

		// Sélection individuelle des changements gérée par ReviewModal.
		// L'application vraiment partielle (au-delà de tout/rien) reste un
		// TODO dans MarkdownEditor, volontairement laissé pour plus tard.
		new ReviewModal(plugin.app, proposal, async (finalContent: string) => {
			await vaultService.backupNote(file, originalContent);
			await vaultService.writeNote(file, finalContent);
			new Notice('Note updated.');
		}).open();
	} catch (error) {
		statusNotice.hide();
		console.error(error);
		new Notice(
			`Error while improving the note: ${
				error instanceof Error ? error.message : String(error)
			}`
		);
	}
}
