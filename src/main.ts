import { Plugin } from 'obsidian';
import {
	NoteImproverSettings,
	DEFAULT_SETTINGS,
	NoteImproverSettingTab,
} from './settings';
import { improveActiveNote } from './commands/improveActiveNote';

export default class NoteImproverPlugin extends Plugin {
	// "!" = definite assignment assertion : settings est toujours initialisé
	// dans onload() avant d'être utilisé ailleurs (même pattern que l'exemple
	// du guide officiel).
	settings!: NoteImproverSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('wand-2', 'Improve note with AI', () => {
			void improveActiveNote(this);
		});

		this.addCommand({
			id: 'improve-active-note',
			name: 'Improve current note with AI',
			callback: () => {
				void improveActiveNote(this);
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
