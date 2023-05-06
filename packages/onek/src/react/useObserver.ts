import { useMemo, useSyncExternalStore } from "react";
import { Reaction, Revision, setSubscriber } from "../core";
import type { SubscriberBase } from "../core/types";

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
        let revision = new Revision();
        let subscribers = new Set<NotifyFn>();

        const reaction = new Reaction(NOOP, () => {
            revision = new Revision();

            subscribers.forEach((notify) => {
                notify();
            });
        });

        reaction._shouldSubscribe = false;

        const observer: ObserverFn = (callback) => {
            const oldSubscriber = setSubscriber(reaction);

            try {
                return callback();
            } finally {
                setSubscriber(oldSubscriber);
            }
        };

        observer._addSubscription = reaction._addSubscription.bind(reaction);

        return {
            _subscribe(notify: NotifyFn): UnsubscribeFn {
                subscribers.add(notify);

                reaction._shouldSubscribe = true;

                reaction._subscribe();

                if (reaction._missedRun()) {
                    notify();
                }

                return () => {
                    subscribers.delete(notify);

                    if (!subscribers.size) {
                        reaction._unsubscribe();

                        reaction._shouldSubscribe = false;
                    }
                };
            },
            _getRevision() {
                return revision;
            },
            _onBeforeRender() {
                reaction._unsubscribeAndRemove();
            },
            _observer: observer,
        };
    }, EMPTY_ARRAY);

    useSyncExternalStore(store._subscribe, store._getRevision);

    store._onBeforeRender();

    return store._observer;
}
