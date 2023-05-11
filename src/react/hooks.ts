import { useEffect, useMemo, useRef } from "react";
import { computed, observable, reaction, ReactionFn } from "../core";

export function useObservable<T>(value: T) {
    return useMemo(() => observable(value), []);
}

export function useComputed<T>(fn: () => T, deps: any[] = []) {
    const fnRef = useRef(fn);

    fnRef.current = fn;

    return useMemo(() => computed(() => fnRef.current()), deps);
}

export function useReaction(body: ReactionFn, deps: any[] = []) {
    const bodyRef = useRef(body);

    bodyRef.current = body;

    useEffect(() => reaction(() => bodyRef.current()), deps);
}
