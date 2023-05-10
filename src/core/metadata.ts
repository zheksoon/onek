import { Computed } from "./classes";

export let defaultMetadata = false;
export let mergeMetadata = (prev: any, next: any) => (prev ?? true) && next;

export let metadataEquals = (prev: any, next: any) => prev === next;

export let currentMetadata: any = undefined;

export function withMetadata(metadata: any, thunk: () => void) {
    const oldMetadata = currentMetadata;
    currentMetadata = metadata;
    try {
        thunk();
    } finally {
        currentMetadata = oldMetadata;
    }
}

const computedMetadataCleanupQueue = new Set<Computed>();
export function scheduleMetadataCleanup(computed: Computed) {
    computedMetadataCleanupQueue.add(computed);
}
export function runComputedMetadataCleanup() {
    computedMetadataCleanupQueue.forEach((computed) => {
        computed._cleanMetadata();
    });
    computedMetadataCleanupQueue.clear();
}
