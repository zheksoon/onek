import { useMemo, useRef, useSyncExternalStore } from "react";
import { Reaction, setCurrentReactReaction } from "./core";

const EMPTY_ARRAY = [];
const ABANDONED_RENDER_TIMEOUT = 5000;

let abandonedRendersFutureItems = new Set<Reaction>();
let abandonedRendersCurrentItems = new Set<Reaction>();
let abandonedRendersCleanupTimeout: ReturnType<typeof setTimeout> | null = null;

function addAbandonedRenderCleanup(r: Reaction) {
    abandonedRendersFutureItems.add(r);
    if (!abandonedRendersCleanupTimeout) {
        abandonedRendersCleanupTimeout = setTimeout(() => {
            const items = abandonedRendersCurrentItems;
            abandonedRendersCurrentItems = abandonedRendersFutureItems;
            abandonedRendersFutureItems = new Set();

            items.forEach((r) => r._unsubscribe());
        }, ABANDONED_RENDER_TIMEOUT);
    }
}

function removeAbandonedRenderCleanup(r: Reaction) {
    abandonedRendersFutureItems.delete(r);
    abandonedRendersCurrentItems.delete(r);
}

export function useObserver(): void {
    const store = useMemo(() => {
        let revision = {};
        let subscribers = new Set<() => void>();
        let renderResult = null;
        let didUnsubscribe = false;

        const r = new Reaction(
            () => {},
            () => {
                revision = {};
                subscribers.forEach((notify) => notify());
            }
        );

        addAbandonedRenderCleanup(r);

        return {
            _subscribe(notify: () => void): () => void {
                if (didUnsubscribe && subscribers.size === 0) {
                    r._subscribe();

                    didUnsubscribe = false;
                }

                subscribers.add(notify);

                removeAbandonedRenderCleanup(r);

                return () => {
                    subscribers.delete(notify);

                    if (subscribers.size === 0) {
                        didUnsubscribe = true;

                        r._unsubscribe();
                    }
                };
            },
            _getRevision() {
                return revision;
            },
            _getRenderResult() {
                return renderResult;
            },
            _reaction: r,
        };
    }, EMPTY_ARRAY);

    useSyncExternalStore(store._subscribe, store._getRevision);

    setCurrentReactReaction(store._reaction);
}
