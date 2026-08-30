export type ChangeStatus = 'pending' | 'accepted' | 'rejected';

export type ChangeType =
	| 'formatting'
	| 'content'
	| 'schema'
	| 'link'
	| 'new content';

export interface TextEdit {
	/** Position de début dans la note originale (offset UTF-16). */
	start: number;
	/** Position de fin exclusive dans la note originale (offset UTF-16). */
	end: number;
	before: string;
	after: string;
}

export interface ProposedChange {
	id: string;
	type: ChangeType;
	description: string;
	reason?: string;
	status: ChangeStatus;
	/**
	 * Opérations techniques formant une seule décision utilisateur. Une
	 * reformulation déplacée peut nécessiter une insertion et une suppression.
	 */
	edits: TextEdit[];
	/** Position de début dans la note originale (offset UTF-16). */
	start: number;
	/** Position de fin exclusive dans la note originale (offset UTF-16). */
	end: number;
	/** Extrait exact de la note originale, utilisé pour localiser le changement. */
	before: string;
	/** Ce que cet extrait devient une fois le changement appliqué. */
	after: string;
}
