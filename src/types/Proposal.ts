import { ProposedChange } from './Changes';

export interface Proposal {
	originalContent: string;
	modifiedContent: string;
	changes: ProposedChange[];
}
