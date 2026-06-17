import { IRevision, ISubscriber, ISubscription } from "../types";

type HeldValue = Readonly<{
    ref: WeakRef<ISubscriber>;
    subscriptions: Map<ISubscription, IRevision>;
}>;

const registry = new FinalizationRegistry<HeldValue>((heldValue) => {
    for (const [subscription] of heldValue.subscriptions) {
        subscription._subscribers.delete(heldValue.ref);
    }
});

export function registerSubscriber(subscriber: ISubscriber) {
    registry.register(subscriber, {
        ref: subscriber._weakRef,
        subscriptions: subscriber._subscriptions,
    });
}
