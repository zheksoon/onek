import type {
    Equals,
    IComputed,
    IComputedGetter,
    IComputedImpl,
    IRevision,
    ISubscriber,
    ISubscription,
} from "../types";
import { State } from "../constants";
import { setSubscriber, subscriber } from "../subscriber";
import { scheduleSubscribersCheck } from "../schedulers";
import { withUntracked } from "../transaction";
import { getRevision } from "./revision";
import { revisionsChanged, notify, subscribe, unsubscribe } from "./common";

type ComputedState =
    | State.CLEAN
    | State.NOT_INITIALIZED
    | State.COMPUTING
    | State.DIRTY

export class Computed<T = any> implements IComputedImpl<T> {
    private _value: T | undefined = undefined;
    private _revision: IRevision = getRevision();
    private readonly _subscribers: Set<ISubscriber> = new Set();
    private readonly _subscriptions: Map<ISubscription, IRevision> = new Map();
    private _state: ComputedState = State.NOT_INITIALIZED;

    private declare readonly _fn: () => T;
    private declare readonly _equals: Equals<T>;

    constructor(fn: () => T, equals: Equals<T> = Object.is) {
        this._fn = fn;
        this._equals = withUntracked(equals);
    }

    addSubscription(subscription: ISubscription): void {
        this._subscriptions.set(subscription, subscription._getRevision());

        // Let the subscription add a direct reference to us only when we have a subscriber
        // So if we are passive, there will be no memory leaks because nobody refers to us
        if (this._subscribers.size) {
            subscription._addSubscriber(this);
        }
    }

    _addSubscriber(subscriber: ISubscriber): void {
        this._subscribers.add(subscriber);

        // Recalculate the value and update revision due to the new subscriber
        // This will reset the DIRTY state to CLEAN
        this._getRevision();
    }

    _removeSubscriber(subscriber: ISubscriber): void {
        this._subscribers.delete(subscriber);

        // If we've lost our last subscriber, schedule the check process
        // Because the most frequent case when someone unsubscribes and subscribes again
        // Without the check, we will do cascade unsubscriptions, which is highly non-performant
        if (!this._subscribers.size) {
            scheduleSubscribersCheck(this);
        }
    }

    _checkAndPassivate(): void {
        // After all reactions are done and we lost all our subscribers
        // enter the passive state when we have to check revisions each time on access
        if (!this._subscribers.size) {
            unsubscribe(this._subscriptions, this);

            this._state = State.DIRTY;
        }
    }

    _notify() {
        // Unsubscribing means nobody can notify as after this 
        // as all references to us are removed
        unsubscribe(this._subscriptions, this);

        notify(this._subscribers);

        this._state = State.DIRTY;
    }

    _getRevision(): IRevision {
        // NOT_INITIALIZED means we have no subscriptions at all, so recompute without checks
        if (this._state === State.NOT_INITIALIZED) {
            this._value = this._recompute();
        }

        // DIRTY means we have no active subscriptions, so we can rely on it
        if (this._state === State.DIRTY) {
            // we check the revisions of subscriptions passively
            if (revisionsChanged(this._subscriptions)) {
                // recompute will subscribe or not subscribe to subscriptions
                // depending on our subscribers size
                let result = this._recompute();

                // assign a new value and revision if the value is changed
                if (!this._equals(this._value!, result)) {
                    this._value = result;
                    this._revision = getRevision();
                }
            } else 
            // this branch means revisions aren't changed, but because we are unsubscribed
            // we need to subscribe again if there is at least one subscriber
            if (this._subscribers.size) {
                subscribe(this._subscriptions, this);
            }
        }

        // if there is no subscribers, make us dirty again, so we will check revisions
        // and recompute if needed on the next access
        this._state = this._subscribers.size ? State.CLEAN : State.DIRTY;

        return this._revision;
    }

    _recompute(): T {
        // We are recomputing only when we are dirty or not initialized
        // so this means we are unsubscribed from everyone at the moment
        this._subscriptions.clear();

        const stateBefore = this._state;
        
        this._state = State.COMPUTING;

        const oldSubscriber = setSubscriber(this);

        try {
            const result = this._fn();

            // We will return to previous state only when there is not exception
            this._state = stateBefore;

            return result;
        } catch (err) {
            // destroy resets us to NOT_INITIALIZED state and unsubscribes from everything
            this.destroy();

            throw err;
        } finally {
            setSubscriber(oldSubscriber);
        }
    }

    destroy(): void {
        // Remove all our subscriptions and enter NOT_INITIALIZED state
        // as if we are brand new computed :)
        unsubscribe(this._subscriptions, this);
        
        this._subscriptions.clear();
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
    }

    get(): T {
        // Someone is trying to get our value while we are computing
        // Usually it's a recursive computed values
        if (this._state === State.COMPUTING) {
            throw new Error("Recursive computed call");
        }

        // Ask subscriber for add us to subscriptions, and if it has subscribers,
        // it will add itself to our subscribers
        // This means we will know if the subscriber is passive, so we will behave
        // accordingly when recomputing
        if (subscriber) {
            subscriber.addSubscription(this);
        }

        // this will check revisions and actualize our value if needed
        this._getRevision();

        return this._value!;
    }
}

export function computed<T>(fn: () => T, checkFn?: Equals<T>): IComputedGetter<T> {
    const comp = new Computed(fn, checkFn);
    const get = comp.get.bind(comp) as IComputedGetter<T>;

    get.instance = comp;
    get.destroy = comp.destroy.bind(comp);
    get.revision = comp._getRevision.bind(comp);

    return get;
}

computed.box = <T>(fn: () => T, checkFn?: Equals<T>): IComputed<T> => {
    return new Computed(fn, checkFn);
};

computed.prop = <T>(fn: () => T, checkFn?: Equals<T>): T => {
    return new Computed(fn, checkFn) as unknown as T;
};
