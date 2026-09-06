export type ChangeStatus = 'pending' | 'accepted' | 'rejected';

export type ChangeType =
	| 'formatting'
	| 'content'
	| 'schema'
	| 'link'
	| 'new content';

export interface TextEdit {
	/** Start position in the original note, expressed as a UTF-16 offset. */
	start: number;
	/** Exclusive end position in the original note, as a UTF-16 offset. */
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
	 * Low-level edits grouped into one user-facing decision. Moving a rewritten
	 * passage may require both an insertion and a deletion.
	 */
	edits: TextEdit[];
	/** Start position in the original note, expressed as a UTF-16 offset. */
	start: number;
	/** Exclusive end position in the original note, as a UTF-16 offset. */
	end: number;
	/** Exact original excerpt used to locate and validate the change. */
	before: string;
	/** Replacement text after the change is applied. */
	after: string;
}
