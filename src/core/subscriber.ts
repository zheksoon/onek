import type { MaybeSubscriber } from "./types";

export let subscriber: MaybeSubscriber = null;

export function setSubscriber(newSubscriber: MaybeSubscriber): MaybeSubscriber {
    const oldSubscriber = subscriber;

    subscriber = newSubscriber;

    return oldSubscriber;
}
