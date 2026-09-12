import { App, PluginSettingTab, SecretComponent, Setting } from 'obsidian';
import type NoteImproverPlugin from './main';

export interface NoteImproverSettings {
	provider: 'groq' | 'ollama';
	groqApiKeySecretId: string;
	groqModel: string;
	// Stored key kept for compatibility with settings saved by earlier builds.
	groqLongNoteAnalyzerModel: string;
	ollamaModel: string;
}

export const DEFAULT_SETTINGS: NoteImproverSettings = {
	provider: 'groq',
	groqApiKeySecretId: '',
	groqModel: 'openai/gpt-oss-120b',
	groqLongNoteAnalyzerModel: 'qwen/qwen3.8-27b',
	ollamaModel: '',
};

// Declarative settings require Obsidian 1.13.0. Keep the imperative API while
// the plugin supports 1.11.4, where SecretStorage first became available.
export class NoteImproverSettingTab extends PluginSettingTab {
	plugin: NoteImproverPlugin;

	constructor(app: App, plugin: NoteImproverPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Provider')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({ groq: 'Groq (cloud)', ollama: 'Ollama (local)' })
					.setValue(this.plugin.settings.provider)
					.onChange(async (value) => {
						this.plugin.settings.provider = value as 'groq' | 'ollama';
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.provider === 'groq') {
			new Setting(containerEl)
				.setName('Groq API key')
				.setDesc(
					'Stored securely in Obsidian SecretStorage. The active note is sent to Groq when you run the command.'
				)
				.addComponent((element) =>
					new SecretComponent(this.app, element)
						.setValue(this.plugin.settings.groqApiKeySecretId)
						.onChange(async (value) => {
							this.plugin.settings.groqApiKeySecretId = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName('Groq editor model')
				.setDesc('Used to generate the improved Markdown note.')
				.addText((text) =>
					text
						.setPlaceholder('openai/gpt-oss-120b')
						.setValue(this.plugin.settings.groqModel)
						.onChange(async (value) => {
							this.plugin.settings.groqModel = value;
							await this.plugin.saveSettings();
						})
				);

			new Setting(containerEl)
				.setName('Groq analyzer model')
				.setDesc('Used to build the JSON analysis for every note.')
				.addText((text) =>
					text
						.setPlaceholder('qwen/qwen3.8-27b')
						.setValue(
							this.plugin.settings.groqLongNoteAnalyzerModel
						)
						.onChange(async (value) => {
							this.plugin.settings.groqLongNoteAnalyzerModel = value;
							await this.plugin.saveSettings();
						})
				);

			return;
		}

		new Setting(containerEl)
			.setName('Ollama model')
			.setDesc('Requests stay on this device and use http://127.0.0.1:11434.')
			.addText((text) =>
				text
					.setValue(this.plugin.settings.ollamaModel)
					.onChange(async (value) => {
						this.plugin.settings.ollamaModel = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
