import { useMemo, useSyncExternalStore } from "react";
import { Reaction } from "./core";

const EMPTY_ARRAY = [];

export function useObserver() {
    const store = useMemo(() => {
        let revision = {};
        let notify: null | (() => void) = null;

        const r = new Reaction(() => {
            revision = {};
            notify && notify();
        });

        r._shouldSubscribe = false;

        return {
            _subscribe(_notify: () => void): () => void {
                notify = _notify;
                r._shouldSubscribe = true;
                r._subscribe();

                return () => {
                    notify = null;
                    r._shouldSubscribe = false;
                    r._unsubscribe();
                };
            },
            _getRevision() {
                if (!notify && r._revisionsChanged()) {
                    revision = {};
                }

                return revision;
            },
            _r: r,
        };
    }, EMPTY_ARRAY);

    const r = store._r;

    r._unsubscribeAndRemove();

    useSyncExternalStore(store._subscribe, store._getRevision);

    return r;
}
