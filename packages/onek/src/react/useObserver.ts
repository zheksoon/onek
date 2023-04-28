import { useMemo, useSyncExternalStore } from "react";
import { Reaction } from "../core/classes";
import {
    addAbandonedRenderCleanup,
    removeAbandonedRenderCleanup,
} from "./abandonedRendererCleanup";

type NotifyFn = () => void;
type UnsubscribeFn = () => void;

export type Observer = Reaction | undefined;

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [] as const;
const NOOP = () => {};

export function useObserver(): Observer {
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
        };
    }, EMPTY_ARRAY);

    useSyncExternalStore(store._subscribe, store._getRevision);

    const reaction = store._reaction;

    reaction._unsubscribeAndRemove();

    return reaction;
}
