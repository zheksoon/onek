import { IRevision, ISubscriber, ISubscription } from "../types";

export function revisionsChanged(subscriptions: Map<ISubscription, IRevision>) {
    for (const [subscription, revision] of subscriptions) {
        if (subscription._recomputeAndGetRevision() !== revision) {
            return true;
        }
    }

    return false;
}

export function unsubscribeAndCleanup(subscriber: ISubscriber): void {
    for (const [subscription] of subscriber._subscriptions) {
        subscription._subscribers.delete(subscriber._weakRef);
    }
    subscriber._subscriptions.clear();
}

export function notify(subscribers: Set<WeakRef<ISubscriber>>): void {
    for (const ref of subscribers) {
        const subscriber = ref.deref();
        if (subscriber !== undefined) {
            subscriber._notify();
        }
    }
}
