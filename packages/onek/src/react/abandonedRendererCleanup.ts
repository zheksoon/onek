import { Reaction } from "../core";

const CLEANUP_TIMEOUT = 5000;

let cleanupFutureItems = new Set<Reaction>();
let cleanupCurrentItems = new Set<Reaction>();
let cleanupTimeout: ReturnType<typeof setTimeout> | number | null = null;

export function addAbandonedRenderCleanup(reaction: Reaction) {
    cleanupFutureItems.add(reaction);

    if (!cleanupTimeout) {
        cleanupTimeout = setTimeout(() => {
            cleanupTimeout = null;

            const items = cleanupCurrentItems;
            cleanupCurrentItems = cleanupFutureItems;
            cleanupFutureItems = new Set();

            items.forEach((reaction) => {
                reaction._unsubscribe();
            });
        }, CLEANUP_TIMEOUT);
    }
}

export function removeAbandonedRenderCleanup(reaction: Reaction) {
    cleanupFutureItems.delete(reaction);
    cleanupCurrentItems.delete(reaction);
}
