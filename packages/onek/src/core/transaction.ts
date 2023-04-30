import { setSubscriber } from "./subscriber";
import { scheduleReactionRunner } from "./schedulers/reaction";
import { Subscriber } from "./types";

export let txDepth = 0;

export function tx(fn: () => void): void {
    ++txDepth;
    try {
        fn();
    } finally {
        if (!--txDepth) scheduleReactionRunner();
    }
}

export function utx<T>(fn: () => T, subscriber: Subscriber | null = null): T {
    const oldSubscriber = setSubscriber(subscriber);
    ++txDepth;
    try {
        return fn();
    } finally {
        setSubscriber(oldSubscriber);
        if (!--txDepth) scheduleReactionRunner();
    }
}

export function untracked<Args extends any[], T>(
    fn: (...args: Args) => T
): (...args: Args) => T {
    return function (this: any) {
        const oldSubscriber = setSubscriber(null);
        try {
            return fn.apply(this, arguments as any);
        } finally {
            setSubscriber(oldSubscriber);
        }
    };
}

export function action<Args extends any[], T>(
    fn: (...args: Args) => T
): (...args: Args) => T {
    return function (this: any) {
        const oldSubscriber = setSubscriber(null);
        ++txDepth;
        try {
            return fn.apply(this, arguments as any);
        } finally {
            setSubscriber(oldSubscriber);
            if (!--txDepth) scheduleReactionRunner();
        }
    };
}
