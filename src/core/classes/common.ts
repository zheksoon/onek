import { IRevision, ISubscriber, ISubscription } from "../types";

export function revisionsChanged(subscriptions: Map<ISubscription, IRevision>) {
    let revisionsChanged = false;

    subscriptions.forEach((revision, subscription) => {
        revisionsChanged ||= subscription._getRevision() !== revision;
    });

    return revisionsChanged;
}

export function unsubscribe(
    subscriptions: Map<ISubscription, IRevision>,
    subscriber: ISubscriber
): void {
    subscriptions.forEach((_revision, subscription) => {
        subscription._removeSubscriber(subscriber);
    });
}

export function subscribe(
    subscriptions: Map<ISubscription, IRevision>,
    subscriber: ISubscriber
): void {
    subscriptions.forEach((_revision, subscription) => {
        subscription._addSubscriber(subscriber);
    });
}

export function notify(subscribers: Set<ISubscriber>): void {
    subscribers.forEach((subscriber) => {
        subscriber._notify();
    });
}
