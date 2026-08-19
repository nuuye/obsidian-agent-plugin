import { App, Modal, Setting } from 'obsidian';
import { Proposal } from '../types/Proposal';
import { ProposedChange } from '../types/Changes';
import { MarkdownEditor } from '../markdown/MarkdownEditor';

export class ReviewModal extends Modal {
	private proposal: Proposal;
	private onConfirm: (finalContent: string) => Promise<void>;
	private selectedIds: Set<string>;
	private markdownEditor = new MarkdownEditor();

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
			new Setting(contentEl)
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
			text: 'Apply selection',
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
	}

	private async confirmWith(acceptedChanges: ProposedChange[]) {
		const finalContent = this.markdownEditor.applyChanges(
			this.proposal,
			acceptedChanges
		);
		await this.onConfirm(finalContent);
		this.close();
	}

	onClose() {
		this.contentEl.empty();
	}
}
