import { NotifyState, Subscriber, Subscription } from "../types";
import { Revision } from "./revision";

export function checkRevisions(subscriptions: Map<Subscription, Revision>) {
    let revisionsChanged = false;

    subscriptions.forEach((revision, subscription) => {
        revisionsChanged ||= subscription.revision() !== revision;
    });

    return revisionsChanged;
}

export function unsubscribe(
    subscriptions: Map<Subscription, Revision>,
    subscriber: Subscriber
): void {
    subscriptions.forEach((revision, subscription) => {
        subscription._removeSubscriber(subscriber);
    });
}

export function subscribe(
    subscriptions: Map<Subscription, Revision>,
    subscriber: Subscriber
): void {
    subscriptions.forEach((revision, subscription) => {
        subscription._addSubscriber(subscriber);
    });
}

export function notifySubscribers(
    subscribers: Set<Subscriber>,
    state: NotifyState,
    self: Subscription
): void {
    subscribers.forEach((subscriber) => {
        subscriber._notify(state, self);
    });
}
