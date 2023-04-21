import { useMemo, useSyncExternalStore } from "react";
import { Reaction } from "./core";

type NotifyFn = () => void;
type UnsubscribeFn = () => void;

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [];
const NOOP = () => {};
const ABANDONED_RENDER_TIMEOUT = 5000;

let abandonedRendersFutureItems = new Set<Reaction>();
let abandonedRendersCurrentItems = new Set<Reaction>();
let abandonedRendersCleanupTimeout: ReturnType<typeof setTimeout> | null = null;

function addAbandonedRenderCleanup(r: Reaction) {
    abandonedRendersFutureItems.add(r);
    if (!abandonedRendersCleanupTimeout) {
        abandonedRendersCleanupTimeout = setTimeout(() => {
            abandonedRendersCleanupTimeout = null;

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

export function useObserver(): Reaction {
    if (!isInBrowser) {
        return;
    }

    const store = useMemo(() => {
        let revision = {};
        let subscribers: NotifyFn[] = [];
        let didUnsubscribe = false;

        const r = new Reaction(NOOP, () => {
            revision = {};
            subscribers.forEach((notify) => notify());
        });

        addAbandonedRenderCleanup(r);

        return {
            _subscribe(notify: NotifyFn): UnsubscribeFn {
                if (didUnsubscribe && subscribers.length === 0) {
                    r._subscribe();

                    didUnsubscribe = false;
                }

                subscribers.push(notify);

                removeAbandonedRenderCleanup(r);

                return () => {
                    subscribers.splice(subscribers.indexOf(notify));

                    if (subscribers.length === 0) {
                        didUnsubscribe = true;

                        r._unsubscribe();
                    }
                };
            },
            _getRevision() {
                return revision;
            },
            _reaction: r,
        };
    }, EMPTY_ARRAY);

    useSyncExternalStore(store._subscribe, store._getRevision);

    return store._reaction;
}
