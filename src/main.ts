import { Plugin } from 'obsidian';
import {
	NoteImproverSettings,
	DEFAULT_SETTINGS,
	NoteImproverSettingTab,
} from './settings';
import { NoteImprovementRunner } from './commands/NoteImprovementRunner';

export default class NoteImproverPlugin extends Plugin {
	// "!" = definite assignment assertion : settings est toujours initialisé
	// dans onload() avant d'être utilisé ailleurs (même pattern que l'exemple
	// du guide officiel).
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
		// loadData() retourne Promise<any> côté API Obsidian — on caste
		// explicitement plutôt que de laisser un `any` implicite se propager
		// dans this.settings.
		const loadedData =
			(await this.loadData()) as Partial<NoteImproverSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData ?? {});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
