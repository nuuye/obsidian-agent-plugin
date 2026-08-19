import { App, TFile } from 'obsidian';

/**
 * Regroupe tous les accès au vault en un seul endroit. Remplace VaultReader,
 * VaultWriter et NoteIndexer de la version CLI : l'API Vault d'Obsidian gère
 * déjà la lecture/écriture/listing de fichiers, plus besoin de manipuler fs/path.
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
	 * Titres de toutes les autres notes du vault, en excluant nativement la
	 * note en cours d'édition (plus besoin de la logique fragile de
	 * comparaison de noms qu'on avait dans l'ancien NoteIndexer).
	 */
	getOtherNoteTitles(excludeFile: TFile): string[] {
		return this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path !== excludeFile.path)
			.map((f) => f.basename);
	}

	async writeNote(file: TFile, content: string): Promise<void> {
		await this.app.vault.modify(file, content);
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
				// Cas limite (rare en usage mono-utilisateur) : le dossier a pu
				// être créé entre le check et l'appel. On ignore cette erreur
				// précise plutôt que de faire échouer tout le backup pour ça.
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
	 * Construit un nom de fichier de backup lisible : "Nom-2026-08-18_14-32-05.md".
	 * Le chemin d'origine (pour les notes dans des sous-dossiers) est aplati
	 * avec des "_" plutôt que de recréer l'arborescence sous backups/, pour
	 * éviter d'avoir à créer des sous-dossiers en plus.
	 */
	private buildBackupFileName(file: TFile): string {
		const flattenedPath = file.path
			.replace(/\.md$/i, '')
			.replace(/[\\/]/g, '_');

		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const timestamp = `${now.getFullYear()}-${pad(
			now.getMonth() + 1
		)}-${pad(now.getDate())}}`;

		return `${flattenedPath}-${timestamp}.md`;
	}

	async backupNote(file: TFile, originalContent: string): Promise<void> {
		await this.ensureBackupFolderExists();
		const backupPath = `${
			VaultService.BACKUP_FOLDER
		}/${this.buildBackupFileName(file)}`;
		await this.app.vault.create(backupPath, originalContent);
	}
}
