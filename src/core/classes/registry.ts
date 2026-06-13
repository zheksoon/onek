import { IRevision, ISubscriber, ISubscription } from "../types";

type HeldValue = Readonly<{
    _ref: WeakRef<ISubscriber>;
    _subscriptions: Map<ISubscription, IRevision>;
}>;

const registry = new FinalizationRegistry<HeldValue>((heldValue) => {
    for (const [subscription] of heldValue._subscriptions) {
        subscription._removeSubscriber(heldValue._ref);
    }
});

export function register(subscriber: ISubscriber, subscriptions: Map<ISubscription, IRevision>) {
    registry.register(subscriber, { _ref: subscriber._weakRef, _subscriptions: subscriptions });
}
