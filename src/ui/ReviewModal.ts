import { App, Modal, Notice, Setting } from 'obsidian';
import { Proposal } from '../types/Proposal';
import { ProposedChange } from '../types/Changes';
import { MarkdownEditor } from '../markdown/MarkdownEditor';

export class ReviewModal extends Modal {
	private proposal: Proposal;
	private onConfirm: (finalContent: string) => Promise<void>;
	private selectedIds: Set<string>;
	private markdownEditor = new MarkdownEditor();
	private isConfirming = false;
	private actionButtons: HTMLButtonElement[] = [];

	constructor(
		app: App,
		proposal: Proposal,
		onConfirm: (finalContent: string) => Promise<void>
	) {
		super(app);
		this.proposal = proposal;
		this.onConfirm = onConfirm;
		// Tout est sélectionné par défaut ; l'utilisateur peut décocher.
		this.selectedIds = new Set(proposal.changes.map((c) => c.id));
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl('h2', { text: 'Proposed changes' });

		this.proposal.changes.forEach((change: ProposedChange) => {
			const setting = new Setting(contentEl)
				.setName(change.type)
				.setDesc(change.description)
				.addToggle((toggle) =>
					toggle.setValue(true).onChange((value) => {
						if (value) {
							this.selectedIds.add(change.id);
						} else {
							this.selectedIds.delete(change.id);
						}
					})
				);

			const preview = setting.descEl.createEl('details', {
				cls: 'note-improver-change-preview',
			});
			preview.createEl('summary', { text: 'Show change' });
			preview.createDiv({
				cls: 'note-improver-change-label',
				text: 'Before',
			});
			preview.createEl('pre', {
				cls: 'note-improver-change-before',
				text: change.before || '(nothing)',
			});
			preview.createDiv({
				cls: 'note-improver-change-label',
				text: 'After',
			});
			preview.createEl('pre', {
				cls: 'note-improver-change-after',
				text: change.after || '(nothing)',
			});
		});

		const buttonRow = contentEl.createDiv({
			cls: 'note-improver-button-row',
		});

		const acceptAllBtn = buttonRow.createEl('button', {
			text: 'Accept all',
		});
		acceptAllBtn.onclick = () => {
			void this.confirmWith(this.proposal.changes);
		};

		const applySelectionBtn = buttonRow.createEl('button', {
			text: 'Accept selection',
		});
		applySelectionBtn.onclick = () => {
			const selected = this.proposal.changes.filter((c) =>
				this.selectedIds.has(c.id)
			);
			void this.confirmWith(selected);
		};

		const rejectAllBtn = buttonRow.createEl('button', {
			text: 'Reject all',
		});
		rejectAllBtn.onclick = () => this.close();

		this.actionButtons = [
			acceptAllBtn,
			applySelectionBtn,
			rejectAllBtn,
		];
	}

	private async confirmWith(acceptedChanges: ProposedChange[]) {
		if (this.isConfirming) {
			return;
		}

		this.isConfirming = true;
		this.actionButtons.forEach((button) => {
			button.disabled = true;
		});

		try {
			const { content, skippedChanges } = this.markdownEditor.applyChanges(
				this.proposal,
				acceptedChanges
			);

			if (skippedChanges.length > 0) {
				new Notice(
					`${skippedChanges.length} change(s) could not be located precisely and were skipped: ` +
						skippedChanges.map((c) => c.description).join(', ')
				);
			}

			await this.onConfirm(content);
			this.close();
		} catch (error) {
			console.error('[ERROR] Unable to apply the selected changes:', error);
			new Notice(
				`Unable to update the note: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
		} finally {
			this.isConfirming = false;
			this.actionButtons.forEach((button) => {
				button.disabled = false;
			});
		}
	}

	onClose() {
		this.contentEl.empty();
	}
}
