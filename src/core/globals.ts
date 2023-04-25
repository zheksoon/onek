import type { Subscriber } from "./types";

export let subscriber: Subscriber | null = null;

export function setSubscriber(
    newSubscriber: Subscriber | null
): Subscriber | null {
    const oldSubscriber = subscriber;

    subscriber = newSubscriber;

    return oldSubscriber;
}
