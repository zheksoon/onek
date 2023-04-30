import { useMemo, useSyncExternalStore } from "react";
import { Reaction, setSubscriber } from "../core";
import type { SubscriberBase } from "../core/types";
import {
    addAbandonedRenderCleanup,
    removeAbandonedRenderCleanup,
} from "./abandonedRendererCleanup";

type NotifyFn = () => void;
type UnsubscribeFn = () => void;

export interface ObserverFn extends SubscriberBase {
    <T>(callback: () => T): T;
}

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [] as const;
const NOOP = () => {};

const NOOP_OBSERVER: ObserverFn = (callback) => callback();
NOOP_OBSERVER._addSubscription = NOOP;

export function useObserver(): ObserverFn {
    if (!isInBrowser) {
        return NOOP_OBSERVER;
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

        const observer: ObserverFn = (callback) => {
            const oldSubscriber = setSubscriber(reaction);

            try {
                return callback();
            } finally {
                setSubscriber(oldSubscriber);
            }
        };

        observer._addSubscription = reaction._addSubscription.bind(reaction);

        addAbandonedRenderCleanup(reaction);

        return {
            _subscribe(notify: NotifyFn): UnsubscribeFn {
                removeAbandonedRenderCleanup(reaction);

                if (didUnsubscribe && !subscribers.size) {
                    reaction._subscribe();

                    didUnsubscribe = false;
                }

                subscribers.add(notify);

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
            _observer: observer,
        };
    }, EMPTY_ARRAY);

    useSyncExternalStore(store._subscribe, store._getRevision);

    store._reaction._unsubscribeAndRemove();

    return store._observer;
}
