import { useEffect, useMemo, useRef } from "react";
import { computed, observable, Reaction, reaction, ReactionFn } from "onek";

export function useObservable<T>(value: T) {
    return useMemo(() => observable(value), []);
}

export function useComputed<T>(fn: () => T) {
    const fnRef = useRef(fn);

    fnRef.current = fn;

    return useMemo(() => {
        return computed(() => fnRef.current());
    }, []);
}

export function useReaction(body: ReactionFn, deps: any[] = []) {
    const bodyRef = useRef(body);

    bodyRef.current = body;

    const r = useMemo(() => {
        return new Reaction(() => bodyRef.current());
    }, []);

    useEffect(() => {
        r.run();

        return () => {
            r.destroy();
        };
    }, deps);
}
