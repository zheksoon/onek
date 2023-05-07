import { IdentityFn, MaybeSubscriber } from "./types";
import { setSubscriber } from "./subscriber";
import { scheduleReactionRunner } from "./schedulers";

let txDepth = 0;

export function tx(fn: () => void): void {
    txDepth += 1;
    try {
        fn();
    } finally {
        txDepth -= 1;
        endTx();
    }
}

export function utx<T>(fn: () => T, subscriber: MaybeSubscriber = null): T {
    const oldSubscriber = setSubscriber(subscriber);
    txDepth += 1;
    try {
        return fn();
    } finally {
        txDepth -= 1;
        setSubscriber(oldSubscriber);
        endTx();
    }
}

export function untracked<T>(fn: () => T): T {
    const oldSubscriber = setSubscriber(null);
    try {
        return fn();
    } finally {
        setSubscriber(oldSubscriber);
    }
}

export function withUntracked<T extends Function>(fn: T): IdentityFn<T> {
    return function (this: any) {
        const oldSubscriber = setSubscriber(null);
        try {
            return fn.apply(this, arguments as any);
        } finally {
            setSubscriber(oldSubscriber);
        }
    } as IdentityFn<T>;
}

export function action<T extends Function>(fn: T): IdentityFn<T> {
    return function (this: any) {
        const oldSubscriber = setSubscriber(null);
        txDepth += 1;
        try {
            return fn.apply(this, arguments as any);
        } finally {
            txDepth -= 1;
            setSubscriber(oldSubscriber);
            endTx();
        }
    } as IdentityFn<T>;
}

export function endTx() {
    if (!txDepth) {
        scheduleReactionRunner();
    }
}
