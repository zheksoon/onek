import { setSubscriber } from "./globals";
import { endTx } from "./reactionScheduler";

export let txDepth = 0;

export function tx(fn: () => void): void {
    ++txDepth;
    try {
        fn();
    } finally {
        if (!--txDepth) endTx();
    }
}

export function utx<T>(fn: () => T, subscriber = null): T {
    const oldSubscriber = setSubscriber(subscriber);
    ++txDepth;
    try {
        return fn();
    } finally {
        setSubscriber(oldSubscriber);
        if (!--txDepth) endTx();
    }
}

export function untracked<Args extends any[], T>(
    fn: (...args: Args) => T
): (...args: Args) => T {
    return function () {
        const oldSubscriber = setSubscriber(null);
        try {
            return fn.apply(this, arguments);
        } finally {
            setSubscriber(oldSubscriber);
        }
    };
}

export function action<Args extends any[], T>(
    fn: (...args: Args) => T
): (...args: Args) => T {
    return function () {
        const oldSubscriber = setSubscriber(null);
        ++txDepth;
        try {
            return fn.apply(this, arguments);
        } finally {
            setSubscriber(oldSubscriber);
            if (!--txDepth) endTx();
        }
    };
}
