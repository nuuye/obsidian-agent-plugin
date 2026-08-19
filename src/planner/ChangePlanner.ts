import { Proposal } from "../types/Proposal.js";
import { ProposedChange } from "../types/Changes.js";
import { ChangesJSON } from "../reviewer/ChangeReviewer.js";

export class ChangePlanner {
    /**
     * Ne fait pas appel au LLM. Il transforme le Changes JSON en Proposal.
     */
    createProposal(originalContent: string, modifiedContent: string, changesJson: ChangesJSON | undefined): Proposal {
        // Garde défensive : si le LLM a renvoyé un JSON valide mais sans le
        // champ "changes" attendu (ou un type inattendu), on ne plante pas
        // silencieusement sur un .map() — on repart d'une liste vide et on prévient.
        const rawChanges = Array.isArray(changesJson?.changes) ? changesJson.changes : [];
        if (rawChanges.length === 0 && changesJson?.changes !== undefined) {
            console.warn("[WARN] Le JSON de revue des changements ne contient pas de liste 'changes' exploitable.");
        }

        const proposedChanges: ProposedChange[] = rawChanges.map((change) => ({
            id: change.id,
            type: change.type,
            description: change.description,
            status: "pending", // Initialisé en attente de validation
        }));

        return {
            originalContent,
            modifiedContent,
            changes: proposedChanges,
        };
    }
}