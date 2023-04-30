import { useMemo, useState, useEffect } from "react";
import { Reaction } from "onek/src/core/classes";
import {
    addAbandonedRenderCleanup,
    removeAbandonedRenderCleanup,
} from "onek/src/react/abandonedRendererCleanup";

type UnsubscribeFn = () => void;

export type Observer = Reaction | undefined;

const isInBrowser = typeof window !== "undefined";

const EMPTY_ARRAY = [] as const;
const EMPTY_OBJECT = {} as const;
const NOOP = () => {};

export function useObserver(): Observer {
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
                removeAbandonedRenderCleanup(reaction);

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
        };
    }, EMPTY_ARRAY);

    useEffect(store._subscriptionEffect, EMPTY_ARRAY);

    const reaction = store._reaction;

    reaction._unsubscribeAndRemove();

    return reaction;
}
