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
		const loadedData =
			(await this.loadData()) as Partial<NoteImproverSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
