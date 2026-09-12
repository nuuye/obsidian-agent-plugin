import { Notice, setIcon } from 'obsidian';
import type NoteImproverPlugin from '../main.js';
import { improveActiveNote } from './improveActiveNote.js';

/**
 * Coordinates runs started from the ribbon and the command palette. It keeps
 * at most one pipeline active and always restores the ribbon state in finally.
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

		// Keep the visual icon and accessibility metadata in sync so assistive
		// technologies receive the same state change as sighted users.
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
