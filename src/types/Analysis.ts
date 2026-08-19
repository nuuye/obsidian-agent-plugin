export interface MissingInformation {
    topic: string;
    reason: string;
    origin: "gap" | "authorDoubt"; // gap=no information at all
    quote?: string; // trigger quote
}

export interface Analysis {
    summary: string;
    topics: string[];
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
