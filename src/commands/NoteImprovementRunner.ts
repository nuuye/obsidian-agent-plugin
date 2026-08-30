import { Notice, setIcon } from 'obsidian';
import type NoteImproverPlugin from '../main.js';
import { improveActiveNote } from './improveActiveNote.js';

/**
 * Centralise l'exécution depuis le ruban et la palette de commandes. Cela
 * garantit un seul pipeline actif et un loader toujours restauré via finally.
 */
export class NoteImprovementRunner {
	private isRunning = false;
	private ribbonIcon: HTMLElement | null = null;

	constructor(private plugin: NoteImproverPlugin) {}

	attachRibbonIcon(ribbonIcon: HTMLElement): void {
		this.ribbonIcon = ribbonIcon;
	}

	async run(): Promise<void> {
		if (this.isRunning) {
			new Notice('A note analysis is already running.');
			return;
		}

		this.isRunning = true;
		this.setLoadingState(true);

		try {
			await improveActiveNote(this.plugin);
		} finally {
			this.isRunning = false;
			this.setLoadingState(false);
		}
	}

	private setLoadingState(isLoading: boolean): void {
		if (!this.ribbonIcon) {
			return;
		}

		setIcon(this.ribbonIcon, isLoading ? 'loader-circle' : 'wand-2');
		this.ribbonIcon.toggleClass(
			'note-improver-ribbon-loading',
			isLoading
		);
		this.ribbonIcon.setAttribute('aria-busy', String(isLoading));
		this.ribbonIcon.setAttribute(
			'aria-label',
			isLoading ? 'Analyzing note…' : 'Improve note with AI'
		);
	}
}
