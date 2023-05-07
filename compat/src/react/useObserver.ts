import { useLayoutEffect, useMemo, useState } from "react";
import { Reaction, Revision, setSubscriber, SubscriberBase } from "onek";

type UnsubscribeFn = () => void;

export interface IObserver extends SubscriberBase {
    <T>(callback: () => T): T;
}

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [] as const;
const NOOP = () => {};

const NOOP_OBSERVER: IObserver = (callback) => callback();
NOOP_OBSERVER.addSubscription = NOOP;

export function useObserver(): IObserver {
    if (!isInBrowser) {
        return NOOP_OBSERVER;
    }

    const [, triggerUpdate] = useState(new Revision());

    const store = useMemo(() => {
        const reaction = new Reaction(NOOP, () => {
            triggerUpdate(new Revision());
        });

        reaction.shouldSubscribe = false;

        const observer: IObserver = (callback) => {
            const oldSubscriber = setSubscriber(reaction);

            try {
                return callback();
            } finally {
                setSubscriber(oldSubscriber);
            }
        };

        observer.addSubscription = reaction.addSubscription.bind(reaction);

        return {
            _subscriptionEffect(): UnsubscribeFn {
                reaction.shouldSubscribe = true;

                reaction.subscribe();

                if (reaction.missedRun()) {
                    triggerUpdate(new Revision());
                }

                return () => {
                    reaction.unsubscribe();

                    reaction.shouldSubscribe = false;
                };
            },
            _onBeforeRender() {
                reaction.unsubscribeAndCleanup();
            },
            _observer: observer,
        };
    }, EMPTY_ARRAY);

    useLayoutEffect(store._subscriptionEffect, EMPTY_ARRAY);

    store._onBeforeRender();

    return store._observer;
}
