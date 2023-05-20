import { useEffect, useMemo, useRef } from "react";
import { computed, observable, Reaction, ReactionFn } from "onek";

const EMPTY_ARR = [] as const;

export function useObservable<T>(value: T) {
    return useMemo(() => observable(value), EMPTY_ARR);
}

export function useComputed<T>(fn: () => T, deps: readonly any[] = EMPTY_ARR) {
    const fnRef = useRef(fn);

    fnRef.current = fn;

    return useMemo(() => {
        return computed(() => fnRef.current());
    }, deps);
}

export function useReaction(body: ReactionFn, deps: readonly any[] = EMPTY_ARR) {
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
