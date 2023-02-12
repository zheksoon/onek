import { useMemo, useSyncExternalStore } from "react";
import { Reaction } from './core';

const EMPTY_ARRAY = [];

export function useReactive() {
    const store = useMemo(() => {
        let revision = {};
        let notify;
        const it = new Reaction(() => {
            revision = {};
            notify && notify();
        });

        it._shouldSubscribe = false;

        return {
            _subscribe(_notify) {
                notify = _notify;
                it._shouldSubscribe = true;
                it._subscribe();

                return () => {
                    notify = null;
                    it._shouldSubscribe = false;
                    it._unsubscribe();
                };
            },
            _getRevision() {
                return revision;
            },
            _it: it,
        };
    }, EMPTY_ARRAY);

    const it = store._it;

    it._unsubscribeAndRemove();

    useSyncExternalStore(store._subscribe, store._getRevision);

    return it;
}