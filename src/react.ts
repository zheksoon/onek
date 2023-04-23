import { useMemo, useSyncExternalStore } from "react";
import { Reaction } from "./core";

type NotifyFn = () => void;
type UnsubscribeFn = () => void;

export type Observer = Reaction;

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [];
const NOOP = () => {};
const CLEANUP_TIMEOUT = 5000;

let cleanupFutureItems = new Set<Reaction>();
let cleanupCurrentItems = new Set<Reaction>();
let cleanupTimeout: ReturnType<typeof setTimeout> | number | null = null;

function addAbandonedRenderCleanup(reaction: Reaction) {
    cleanupFutureItems.add(reaction);

    if (!cleanupTimeout) {
        cleanupTimeout = setTimeout(() => {
            cleanupTimeout = null;

            const items = cleanupCurrentItems;
            cleanupCurrentItems = cleanupFutureItems;
            cleanupFutureItems = new Set();

            items.forEach((r) => {
                r._unsubscribe();
            });
        }, CLEANUP_TIMEOUT);
    }
}

function removeAbandonedRenderCleanup(r: Reaction) {
    cleanupFutureItems.delete(r);
    cleanupCurrentItems.delete(r);
}

export function useObserver(): Observer | undefined {
    if (!isInBrowser) {
        return;
    }

    const store = useMemo(() => {
        let revision = {};
        let subscribers = new Set<NotifyFn>();
        let didUnsubscribe = false;

        const reaction = new Reaction(NOOP, () => {
            revision = {};
            subscribers.forEach((notify) => {
                notify();
            });
        });

        addAbandonedRenderCleanup(reaction);

        return {
            _subscribe(notify: NotifyFn): UnsubscribeFn {
                if (didUnsubscribe && !subscribers.size) {
                    reaction._subscribe();

                    didUnsubscribe = false;
                }

                subscribers.add(notify);

                removeAbandonedRenderCleanup(reaction);

                return () => {
                    subscribers.delete(notify);

                    if (!subscribers.size) {
                        didUnsubscribe = true;

                        reaction._unsubscribe();
                    }
                };
            },
            _getRevision() {
                return revision;
            },
            _reaction: reaction,
        };
    }, EMPTY_ARRAY);

    useSyncExternalStore(store._subscribe, store._getRevision);

    const reaction = store._reaction;

    reaction._unsubscribeAndRemove();

    return reaction;
}
