import { useMemo, useSyncExternalStore } from "react";
import { Reaction, Revision, setSubscriber, SubscriberBase } from "onek";

type NotifyFn = () => void;
type UnsubscribeFn = () => void;

export interface IObserver extends SubscriberBase {
    <T>(callback: () => T): T;
}

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [] as const;
const NOOP = () => {
    // noop
};

const NOOP_OBSERVER: IObserver = (callback) => callback();
NOOP_OBSERVER.addSubscription = NOOP;

export function useObserver(): IObserver {
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
            _subscribe(notify: NotifyFn): UnsubscribeFn {
                if (!subscribers.size) {
                    reaction.shouldSubscribe = true;

                    reaction.subscribe();
                }

                subscribers.add(notify);

                return () => {
                    subscribers.delete(notify);

                    if (!subscribers.size) {
                        reaction.unsubscribe();

                        reaction.shouldSubscribe = false;
                    }
                };
            },
            _getRevision() {
                if (!subscribers.size && reaction.missedRun()) {
                    reaction.updateRevisions();

                    revision = new Revision();
                }
                return revision;
            },
            _onBeforeRender() {
                reaction.unsubscribeAndCleanup();
            },
            _observer: observer,
        };
    }, EMPTY_ARRAY);

    useSyncExternalStore(store._subscribe, store._getRevision);

    store._onBeforeRender();

    return store._observer;
}
