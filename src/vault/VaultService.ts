import { App, TFile } from 'obsidian';

/**
 * Keeps all vault access behind one boundary. Obsidian's Vault API replaces
 * the CLI version's separate reader, writer, and indexer services, so no
 * direct filesystem access is necessary.
 */
export class VaultService {
	constructor(private app: App) {}

	getActiveMarkdownFile(): TFile | null {
		const file = this.app.workspace.getActiveFile();
		return file && file.extension === 'md' ? file : null;
	}

	async readNote(file: TFile): Promise<string> {
		return this.app.vault.read(file);
	}

	/**
	 * Returns every other Markdown note title while excluding the active file by
	 * path. Path comparison avoids ambiguous basename comparisons when folders
	 * contain notes with the same name.
	 */
	getOtherNoteTitles(excludeFile: TFile): string[] {
		return this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path !== excludeFile.path)
			.map((f) => f.basename);
	}

	async assertNoteUnchanged(file: TFile, expectedContent: string): Promise<void> {
		const currentContent = await this.app.vault.read(file);
		if (currentContent !== expectedContent) {
			throw new Error(
				'The note changed while the proposal was open. Review the latest note and run the improvement again.'
			);
		}
	}

	async writeNote(
		file: TFile,
		content: string,
		expectedContent: string
	): Promise<void> {
		// Vault.process performs the comparison and replacement atomically. The
		// second check closes the race between the pre-backup check and this write.
		await this.app.vault.process(file, (currentContent) => {
			if (currentContent !== expectedContent) {
				throw new Error(
					'The note changed while the proposal was open. Review the latest note and run the improvement again.'
				);
			}

			return content;
		});
	}

	private static readonly BACKUP_FOLDER = 'backups';

	private async ensureBackupFolderExists(): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(
			VaultService.BACKUP_FOLDER
		);
		if (!existing) {
			try {
				await this.app.vault.createFolder(VaultService.BACKUP_FOLDER);
			} catch (error) {
				// Another operation may create the folder between the lookup and
				// createFolder(). Treat that race as success only if it now exists.
				if (
					!this.app.vault.getAbstractFileByPath(
						VaultService.BACKUP_FOLDER
					)
				) {
					throw error;
				}
			}
		}
	}

	/**
	 * Builds a readable backup name such as "Note-2026-08-18_14-32-05.md".
	 * Nested source paths are flattened with underscores instead of recreating
	 * their directory hierarchy under backups/.
	 */
	private buildBackupFileName(file: TFile): string {
		const flattenedPath = file.path
			.replace(/\.md$/i, '')
			.replace(/[\\/]/g, '_');

		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const padMilliseconds = (n: number) => String(n).padStart(3, '0');
		const timestamp = `${now.getFullYear()}-${pad(
			now.getMonth() + 1
		)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(
			now.getMinutes()
		)}-${pad(now.getSeconds())}-${padMilliseconds(now.getMilliseconds())}`;

		return `${flattenedPath}-${timestamp}.md`;
	}

	private buildUniqueBackupPath(file: TFile): string {
		const fileName = this.buildBackupFileName(file);
		const stem = fileName.replace(/\.md$/i, '');
		let candidate = `${VaultService.BACKUP_FOLDER}/${fileName}`;
		let suffix = 2;

		// Milliseconds normally make collisions unlikely, but the suffix also
		// makes repeated or mocked timestamps safe.
		while (this.app.vault.getAbstractFileByPath(candidate)) {
			candidate = `${VaultService.BACKUP_FOLDER}/${stem}-${suffix}.md`;
			suffix++;
		}

		return candidate;
	}

	async backupNote(file: TFile, originalContent: string): Promise<void> {
		await this.ensureBackupFolderExists();
		const backupPath = this.buildUniqueBackupPath(file);
		await this.app.vault.create(backupPath, originalContent);
	}
}
