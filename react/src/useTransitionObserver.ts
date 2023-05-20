import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Reaction } from "onek";

export function useTransitionObserver<T>(fn: () => T) {
    const [isPending, startTransition] = useTransition();

    const fnRef = useRef(fn);

    fnRef.current = fn;

    let value: T;

    const r = useMemo(() => {
        const reaction = new Reaction(
            () => {
                value = fnRef.current();
            },
            () => {
                reaction.run();

                startTransition(() => {
                    setTransitionValue(value!);
                });
            }
        );

        reaction.shouldSubscribe = false;

        return reaction;
    }, []);

    useEffect(() => {
        r.shouldSubscribe = true;

        if (r.missedRun()) {
            r.runManager();
        } else {
            r.subscribe();
        }

        return () => {
            r.destroy();
            r.shouldSubscribe = false;
        };
    }, [r]);

    const [transitionValue, setTransitionValue] = useState<T>(() => {
        r.run();

        return value;
    });

    return [isPending, transitionValue] as const;
}
