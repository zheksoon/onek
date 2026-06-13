import type { IRevision } from "../types";

let revisionId: IRevision = 0;

export function getRevision(): IRevision {
    revisionId = (revisionId + 1) | 0;

    return revisionId;
}
