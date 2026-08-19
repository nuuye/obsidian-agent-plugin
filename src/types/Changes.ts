export type ChangeStatus = "pending" | "accepted" | "rejected";

export interface ProposedChange {
    id: string;
    type: "formatting" | "content" | "schema" | "link" | "new content";
    description: string;
    reason?: string;
    status: ChangeStatus;
}
