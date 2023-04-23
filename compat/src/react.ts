import { useMemo, useState, useEffect } from "react";
import { Reaction } from "../../src/core";

type UnsubscribeFn = () => void;

export type Observer = Reaction;

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
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

function removeAbandonedRenderCleanup(reaction: Reaction) {
    cleanupFutureItems.delete(reaction);
    cleanupCurrentItems.delete(reaction);
}

export function useObserver(): Observer | undefined {
    if (!isInBrowser) {
        return;
    }

    const [, triggerUpdate] = useState(EMPTY_OBJECT);

    const store = useMemo(() => {
        let didUnsubscribe = false;

        const reaction = new Reaction(NOOP, () => {
            triggerUpdate({});
        });

        addAbandonedRenderCleanup(reaction);

        return {
            _subscriptionEffect(): UnsubscribeFn {
                if (didUnsubscribe) {
                    reaction._subscribe();
                    didUnsubscribe = false;
                }

                removeAbandonedRenderCleanup(reaction);

                return () => {
                    reaction._unsubscribe();
                    didUnsubscribe = true;
                };
            },
            _reaction: reaction,
        };
    }, EMPTY_ARRAY);

    useEffect(store._subscriptionEffect, EMPTY_ARRAY);

    const reaction = store._reaction;

    reaction._unsubscribeAndRemove();

    return reaction;
}
