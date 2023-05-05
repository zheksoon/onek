import type { IRevision } from "../types";

let revisionId = 0;

export class Revision implements IRevision {
    id = (revisionId = (revisionId + 1) | 0);
}
