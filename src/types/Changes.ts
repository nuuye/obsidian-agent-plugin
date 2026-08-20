export type ChangeStatus = 'pending' | 'accepted' | 'rejected';

export type ChangeType =
	| 'formatting'
	| 'content'
	| 'schema'
	| 'link'
	| 'new content';

export interface ProposedChange {
	id: string;
	type: ChangeType;
	description: string;
	reason?: string;
	status: ChangeStatus;
	/** Position de début dans la note originale (offset UTF-16). */
	start: number;
	/** Position de fin exclusive dans la note originale (offset UTF-16). */
	end: number;
	/** Extrait exact de la note originale, utilisé pour localiser le changement. */
	before: string;
	/** Ce que cet extrait devient une fois le changement appliqué. */
	after: string;
}
