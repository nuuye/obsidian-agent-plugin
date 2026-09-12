import { Plugin } from 'obsidian';
import {
	NoteImproverSettings,
	DEFAULT_SETTINGS,
	NoteImproverSettingTab,
} from './settings';
import { NoteImprovementRunner } from './commands/NoteImprovementRunner';

export default class NoteImproverPlugin extends Plugin {
	// The definite assignment assertion is safe because onload() initializes
	// settings before registering any feature that can read them.
	settings!: NoteImproverSettings;

	async onload() {
		await this.loadSettings();

		const improvementRunner = new NoteImprovementRunner(this);
		const ribbonIcon = this.addRibbonIcon(
			'wand-2',
			'Improve note with AI',
			() => {
				void improvementRunner.run();
			}
		);
		improvementRunner.attachRibbonIcon(ribbonIcon);

		this.addCommand({
			id: 'improve-active-note',
			name: 'Improve note with AI',
			callback: () => {
				void improvementRunner.run();
			},
		});

		this.addSettingTab(new NoteImproverSettingTab(this.app, this));
	}

	async loadSettings() {
		// Obsidian types loadData() as Promise<any>. Narrow it here so an
		// implicit `any` does not propagate through the settings object.
		type StoredSettings = Partial<NoteImproverSettings> & {
			groqApiKey?: string;
		};
		const loadedData = (await this.loadData()) as StoredSettings | null;
		const { groqApiKey: legacyGroqApiKey, ...storedSettings } =
			loadedData ?? {};

		this.settings = Object.assign({}, DEFAULT_SETTINGS, storedSettings);

		// Private builds stored the Groq key directly in data.json. Move it into
		// SecretStorage once, then persist settings again without the plaintext key.
		if (legacyGroqApiKey?.trim()) {
			const secretId =
				this.settings.groqApiKeySecretId || 'note-improver-groq-api-key';
			if (!this.app.secretStorage.getSecret(secretId)) {
				this.app.secretStorage.setSecret(secretId, legacyGroqApiKey);
			}
			this.settings.groqApiKeySecretId = secretId;
		}

		if (
			loadedData &&
			Object.prototype.hasOwnProperty.call(loadedData, 'groqApiKey')
		) {
			await this.saveSettings();
		}
	}

	getGroqApiKey(): string {
		const secretId = this.settings.groqApiKeySecretId.trim();
		return secretId ? this.app.secretStorage.getSecret(secretId) ?? '' : '';
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
