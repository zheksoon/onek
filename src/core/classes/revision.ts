import type { IRevision } from "../types";

let revisionId = 0;

export class Revision implements IRevision {
    // nothing here

    public id = revisionId++;
}
