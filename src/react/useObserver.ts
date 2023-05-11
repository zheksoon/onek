import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
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

type UseObserverParams = {
    startTransitionOn?: Array<IGetter<any> | IGettable<any>>;
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

export function useObserver({ startTransitionOn }: UseObserverParams): IObserver {
    if (!isInBrowser) {
        return NOOP_OBSERVER;
    }

    const startTransitionObservables = startTransitionOn
        ? useMemo(() => {
              return startTransitionOn.map((observable) => {
                  if (observable instanceof Observable || observable instanceof Computed) {
                      return observable;
                  } else if (typeof observable === "function" && observable.instance) {
                      return observable.instance;
                  } else {
                      throw new Error(
                          "Observable in 'startTransitionOn' is not getter or instance"
                      );
                  }
              });
          }, startTransitionOn)
        : [];

    const startTransitionObservablesRef = useRef(startTransitionObservables);

    startTransitionObservablesRef.current = startTransitionObservables;

    const [, setStartTransition] = useState(new Revision());

    const [isPending, startTransition] = useTransition();

    const store = useMemo(() => {
        let revision = new Revision();
        let subscribers = new Set<NotifyFn>();

        const reaction = new Reaction(NOOP, () => {
            revision = new Revision();

            const transitionObservables = startTransitionObservablesRef.current;
            const changedSubscriptions = reaction._changedSubscriptions as Set<IGettable<any>>;

            const transitionSubscriptions = transitionObservables.filter((observable) =>
                changedSubscriptions.has(observable)
            );

            const transitionSubscriptionsCount = transitionSubscriptions.length;

            if (transitionSubscriptionsCount) {
                startTransition(() => {
                    setStartTransition(new Revision());
                });
            }

            if (transitionSubscriptionsCount < changedSubscriptions.size) {
                subscribers.forEach((notify) => {
                    notify();
                });
            }
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
