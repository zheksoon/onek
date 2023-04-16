import { useMemo, useRef, useSyncExternalStore } from "react";
import { Reaction } from "./core";

const EMPTY_ARRAY = [];

export function useObserver<R extends () => any>(
    renderFn?: R
): R extends () => any ? ReturnType<R> : Reaction {
    const renderFnRef = useRef(renderFn);

    const store = useMemo(() => {
        let revision = {};
        let subscribers = new Set<() => void>();
        let renderResult = null;

        const reactionBody = () => {
            renderResult = renderFnRef.current?.();
        };

        const r = new Reaction(reactionBody, () => {
            revision = {};
            subscribers.forEach((notify) => notify());
        });

        return {
            _subscribe(notify: () => void): () => void {
                if (subscribers.size === 0) {
                    r._subscribe();
                }

                subscribers.add(notify);

                return () => {
                    subscribers.delete(notify);

                    if (subscribers.size === 0) {
                        r._unsubscribe();
                    }
                };
            },
            _getRevision() {
                return revision;
            },
            _getRenderResult() {
                return renderResult;
            },
            _reaction: r,
        };
    }, EMPTY_ARRAY);

    const r = store._reaction;

    useSyncExternalStore(store._subscribe, store._getRevision);

    if (renderFn) {
        r._run();

        return store._getRenderResult();
    } else {
        r._unsubscribeAndRemove();

        return r as any;
    }
}
