import { useMemo, useSyncExternalStore } from "react";
import { Reaction, getRevision, setSubscriber } from "onek";

type NotifyFn = () => void;
type UnsubscribeFn = () => void;

export interface IObserver {
    <T>(callback: () => T): T;
}

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [] as const;
const NOOP = (value?: any) => value;

const NOOP_OBSERVER: IObserver = (callback) => callback();

export function useObserver(): IObserver {
    if (!isInBrowser) {
        return NOOP_OBSERVER;
    }

    const store = useMemo(() => {
        let revision = getRevision();
        let subscribers = new Set<NotifyFn>();

        const reaction = new Reaction(NOOP, () => {
            revision = getRevision();

            for (const notify of subscribers) {
                notify();
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

        return {
            _subscribe(notify: NotifyFn): UnsubscribeFn {
                subscribers.add(notify);

                return () => {
                    subscribers.delete(notify);
                };
            },
            _getRevision() {
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
