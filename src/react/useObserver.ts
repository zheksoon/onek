import { useCallback, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import {
    Computed,
    IGettable,
    IGetter,
    Observable,
    Reaction,
    Revision,
    setSubscriber,
    SubscriberBase,
} from "../core";

type NotifyFn = () => void;
type UnsubscribeFn = () => void;

type UseObserverOptions = {
    startTransition?: boolean | Array<IGetter<any> | IGettable<any>>;
};

export interface IObserver extends SubscriberBase {
    isPending: boolean;

    <T>(callback: () => T): T;
}

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [] as const;
const NOOP = () => {
    // noop
};

const NOOP_OBSERVER: IObserver = (callback) => callback();
NOOP_OBSERVER.addSubscription = NOOP;
NOOP_OBSERVER.isPending = false;

export function useObserver(options?: UseObserverOptions): IObserver {
    if (!isInBrowser) {
        return NOOP_OBSERVER;
    }

    const startTransition = options && options.startTransition;

    let isPending = false;

    let notifyChanged: (reaction: Reaction, subscribers: Set<NotifyFn>) => void;

    if (startTransition) {
        const transitionEverything = startTransition === true;

        const startTransitionObservablesRef = useRef<Array<IGettable<any>>>([]);

        if (!transitionEverything) {
            startTransitionObservablesRef.current = useMemo(() => {
                return startTransition!.map((observable) => {
                    if (observable instanceof Observable || observable instanceof Computed) {
                        return observable;
                    } else if (typeof observable === "function" && observable.instance) {
                        return observable.instance;
                    } else {
                        throw new Error(
                            "Observable in 'startTransition' is not getter or instance"
                        );
                    }
                });
            }, startTransition);
        }

        const [, setStartTransition] = useState(new Revision());

        const [isTransitionPending, _startTransition] = useTransition();

        notifyChanged = useCallback((reaction: Reaction, subscribers: Set<NotifyFn>) => {
            const transitionObservables = startTransitionObservablesRef.current!;
            const changedSubscriptions = reaction._changedSubscriptions as Set<IGettable<any>>;

            const transitionSubscriptionsCount = transitionObservables.reduce((acc, observable) => {
                return acc + (changedSubscriptions.has(observable) ? 1 : 0);
            }, 0);

            if (
                transitionEverything ||
                transitionSubscriptionsCount === changedSubscriptions.size
            ) {
                _startTransition(() => {
                    setStartTransition(new Revision());
                });
            } else {
                // in case there are some non-transition changes, run immediate notification
                subscribers.forEach((notify) => {
                    notify();
                });
            }
        }, EMPTY_ARRAY);

        isPending = isTransitionPending;
    } else {
        notifyChanged = useCallback((reaction: Reaction, subscribers: Set<NotifyFn>) => {
            subscribers.forEach((notify) => {
                notify();
            });
        }, EMPTY_ARRAY);
    }

    const store = useMemo(() => {
        let revision = new Revision();
        let subscribers = new Set<NotifyFn>();

        const reaction = new Reaction(NOOP, () => {
            revision = new Revision();

            notifyChanged(reaction, subscribers);
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
        observer.isPending = false;

        return {
            _subscribe(notify: NotifyFn): UnsubscribeFn {
                if (!subscribers.size) {
                    reaction.shouldSubscribe = true;

                    reaction.subscribe();

                    if (reaction.missedRun()) {
                        notify();
                    }
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

    store._observer.isPending = isPending;

    return store._observer;
}
