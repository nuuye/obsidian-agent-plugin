export interface MissingInformation {
    topic: string;
    reason: string;
    /** Distinguishes absent information from uncertainty expressed by the author. */
    origin: "gap" | "authorDoubt";
    /** Exact source passage that triggered an author-doubt finding. */
    quote?: string;
}

export interface Analysis {
    summary: string;
    topics: string[];
	noteKind: "memo" | "concept" | "reference";
    writingStyle: {
        language: string;
        tone: string;
        structure: string;
    };
    schema: {
        useful: boolean;
        score: number;
        type: "graph TD" | "sequenceDiagram" | "timeline";
        reason: string;
    };
    missingInformation: MissingInformation[];
}
