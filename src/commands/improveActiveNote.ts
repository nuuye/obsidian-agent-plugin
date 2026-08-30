import { Notice } from 'obsidian';
import type NoteImproverPlugin from '../main';
import { VaultService } from '../vault/VaultService';
import { Pipeline } from '../core/Pipeline';
import { GroqProvider } from '../llm/GroqProvider';
import { selectGroqModels } from '../llm/GroqModelRouter';
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
	let usesDedicatedAnalyzer = false;

	if (plugin.settings.provider === 'groq') {
		const route = selectGroqModels(
			originalContent,
			plugin.settings.groqModel,
			plugin.settings.groqLongNoteAnalyzerModel,
			plugin.settings.groqLongNoteThreshold
		);
		usesDedicatedAnalyzer = route.usesDedicatedAnalyzer;

		editorProvider = new GroqProvider(
			route.editorModel,
			plugin.settings.groqApiKey,
			{
				maxCompletionTokens: 3800,
				...(route.editorModel.startsWith('openai/gpt-oss-')
					? { reasoningEffort: 'low' as const }
					: {}),
			}
		);
		analyzerProvider = usesDedicatedAnalyzer
			? new GroqProvider(
					route.analyzerModel,
					plugin.settings.groqApiKey,
					{
						reasoningEffort: 'none',
						jsonObjectMode: true,
					}
				)
			: editorProvider;
	} else {
		const ollamaProvider = new OllamaProvider(
			plugin.settings.ollamaModel
		);
		analyzerProvider = ollamaProvider;
		editorProvider = ollamaProvider;
	}

	const pipeline = new Pipeline(analyzerProvider, editorProvider);
	const statusNotice = new Notice(
		usesDedicatedAnalyzer
			? 'Analyzing long note with dedicated model…'
			: 'Analyzing note…',
		0
	);

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
