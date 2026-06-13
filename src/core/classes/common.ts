import { IRevision, ISubscriber, ISubscription } from "../types";

export function revisionsChanged(subscriptions: Map<ISubscription, IRevision>) {
    for (const [subscription, revision] of subscriptions) {
        if (subscription._getRevision() !== revision) {
            return true;
        }
    }

    return false;
}

export function unsubscribe(
    subscriptions: Map<ISubscription, IRevision>,
    subscriber: ISubscriber
): void {
    for (const [subscription] of subscriptions) {
        subscription._removeSubscriber(subscriber._weakRef);
    }
}

export function notify(subscribers: Set<WeakRef<ISubscriber>>): void {
    for (const ref of subscribers) {
        const subscriber = ref.deref();
        if (subscriber !== undefined) {
            subscriber._notify();
        }
    }
}
