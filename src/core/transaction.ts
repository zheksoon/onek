import { IdentityFn, MaybeSubscriber } from "./types";
import { setSubscriber } from "./subscriber";
import { scheduleReactionRunner } from "./schedulers";

let txDepth = 0;

export function action<T extends Function>(fn: T, subscriber?: MaybeSubscriber): IdentityFn<T> {
    return function (this: any) {
        const oldSubscriber = setSubscriber(subscriber);
        txDepth += 1;
        try {
            return fn.apply(this, arguments as any);
        } finally {
            setSubscriber(oldSubscriber);
            txDepth -= 1;
            endTx();
        }
    } as IdentityFn<T>;
}

export function untracked<T>(fn: () => T): T {
    const oldSubscriber = setSubscriber();
    try {
        return fn();
    } finally {
        setSubscriber(oldSubscriber);
    }
}

export function endTx() {
    if (!txDepth) {
        scheduleReactionRunner();
    }
}
