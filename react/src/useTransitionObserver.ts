import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Reaction } from "onek";

export function useTransitionObserver<T>(fn: () => T) {
    const [isPending, startTransition] = useTransition();

    const fnRef = useRef(fn);

    fnRef.current = fn;

    let value: T;

    const isValueInitialized = useRef(false);

    const r = useMemo(() => {
        const reaction = new Reaction(() => {
            value = fnRef.current();

            if (isValueInitialized.current) {
                startTransition(() => {
                    setTransitionValue(value!);
                });
            } else {
                isValueInitialized.current = true;
            }
        });

        reaction.shouldSubscribe = false;

        return reaction;
    }, []);

    useEffect(() => {
        r.shouldSubscribe = true;

        if (r.missedRun()) {
            r.run();
        } else {
            r.subscribe();
        }

        return () => {
            r.destroy();
            r.shouldSubscribe = false;
        };
    }, [r]);

    if (!isValueInitialized.current) {
        r.run();
    }

    const [transitionValue, setTransitionValue] = useState<T>(value!);

    return [isPending, transitionValue] as const;
}
