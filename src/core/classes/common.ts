import { NotifyState, ISubscriber, ISubscription } from "../types";
import { Revision } from "./revision";

export function checkRevisions(subscriptions: Map<ISubscription, Revision>) {
    let revisionsChanged = false;

    subscriptions.forEach((revision, subscription) => {
        revisionsChanged ||= subscription.revision() !== revision;
    });

    return revisionsChanged;
}

export function unsubscribe(
    subscriptions: Map<ISubscription, Revision>,
    subscriber: ISubscriber
): void {
    subscriptions.forEach((_revision, subscription) => {
        subscription._removeSubscriber(subscriber);
    });
}

export function subscribe(
    subscriptions: Map<ISubscription, Revision>,
    subscriber: ISubscriber
): void {
    subscriptions.forEach((_revision, subscription) => {
        subscription._addSubscriber(subscriber);
    });
}

export function notifySubscribers(subscribers: Set<ISubscriber>, state: NotifyState): void {
    subscribers.forEach((subscriber) => {
        subscriber._notify(state);
    });
}
