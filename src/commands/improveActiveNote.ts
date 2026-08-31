import { Notice } from 'obsidian';
import type NoteImproverPlugin from '../main';
import { VaultService } from '../vault/VaultService';
import { Pipeline } from '../core/Pipeline';
import { GroqProvider } from '../llm/GroqProvider';
import type { LLMProvider } from '../llm/types/LLMProvider';
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

	let analyzerProvider: LLMProvider;
	let editorProvider: LLMProvider;

	if (plugin.settings.provider === 'groq') {
		const analyzerModel =
			plugin.settings.groqLongNoteAnalyzerModel.trim() ||
			'qwen/qwen3.6-27b';

		editorProvider = new GroqProvider(
			plugin.settings.groqModel,
			plugin.settings.groqApiKey,
			{
				maxCompletionTokens: 3800,
				...(plugin.settings.groqModel.startsWith('openai/gpt-oss-')
					? { reasoningEffort: 'low' as const }
					: {}),
			}
		);
		analyzerProvider = new GroqProvider(
			analyzerModel,
			plugin.settings.groqApiKey,
			{
				maxCompletionTokens: 1200,
				jsonObjectMode: true,
				...(analyzerModel.startsWith('qwen/qwen3.')
					? { reasoningEffort: 'none' as const }
					: {}),
			}
		);
	} else {
		const ollamaProvider = new OllamaProvider(
			plugin.settings.ollamaModel
		);
		analyzerProvider = ollamaProvider;
		editorProvider = ollamaProvider;
	}

	const pipeline = new Pipeline(analyzerProvider, editorProvider);
	const statusNotice = new Notice('Analyzing note…', 0);

	try {
		const proposal = await pipeline.run(originalContent, existingNotes);
		statusNotice.hide();

		if (!proposal) {
			new Notice('No proposal generated.');
			return;
		}

		// Le diff est calculé localement et ReviewModal permet d'appliquer tout
		// ou seulement un sous-ensemble des changements proposés.
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
