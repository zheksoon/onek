import { useEffect, useMemo, useState } from "react";
import {
    addAbandonedRenderCleanup,
    removeAbandonedRenderCleanup,
} from "onek/src/react";
import { Reaction, setSubscriber, SubscriberBase } from "onek/src/core";

type UnsubscribeFn = () => void;

export interface IObserver extends SubscriberBase {
    <T>(callback: () => T): T;
}

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [] as const;
const EMPTY_OBJECT = {} as const;
const NOOP = () => {};

const NOOP_OBSERVER: IObserver = (callback) => callback();
NOOP_OBSERVER._addSubscription = NOOP;

export function useObserver(): IObserver {
    if (!isInBrowser) {
        return NOOP_OBSERVER;
    }

    const [, triggerUpdate] = useState(EMPTY_OBJECT);

    const store = useMemo(() => {
        let didSubscribe = false;
        let didUnsubscribe = false;
        let shouldRerender = false;

        const reaction = new Reaction(NOOP, () => {
            if (didSubscribe) {
                triggerUpdate({});
            } else {
                shouldRerender = true;
            }
        });

        const observer: IObserver = (callback) => {
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
            _subscriptionEffect(): UnsubscribeFn {
                removeAbandonedRenderCleanup(reaction);

                if (shouldRerender) {
                    shouldRerender = false;
                    triggerUpdate({});
                }

                didSubscribe = true;

                if (didUnsubscribe) {
                    reaction._subscribe();
                    didUnsubscribe = false;
                }

                return () => {
                    reaction._unsubscribe();
                    didUnsubscribe = true;
                };
            },
            _reaction: reaction,
            _observer: observer,
        };
    }, EMPTY_ARRAY);

    useEffect(store._subscriptionEffect, EMPTY_ARRAY);

    store._reaction._unsubscribeAndRemove();

    return store._observer;
}
