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
import { withUntracked } from "../transaction";
import { getRevision } from "./revision";
import { notify, unsubscribe, revisionsChanged } from "./common";
import { register } from "./registry";

type ComputedState =
    | State.CLEAN
    | State.NOT_INITIALIZED
    | State.COMPUTING
    | State.DIRTY

export class Computed<T = any> implements IComputedImpl<T> {
    readonly _weakRef = new WeakRef(this);
    readonly _subscriptions: Map<ISubscription, IRevision> = new Map();

    private _value: T | undefined = undefined;
    private _revision: IRevision = getRevision();
    private readonly _subscribers: Set<WeakRef<ISubscriber>> = new Set();
    private _state: ComputedState = State.NOT_INITIALIZED;

    private declare readonly _fn: () => T;
    private declare readonly _equals: Equals<T>;

    constructor(fn: () => T, equals: Equals<T> = Object.is) {
        this._fn = fn;
        this._equals = withUntracked(equals);

        register(this, this._subscriptions);
    }

    _addSubscriber(subscriberRef: WeakRef<ISubscriber>): void {
        this._subscribers.add(subscriberRef);

        // Recalculate the value and update revision due to the new subscriber
        // This will reset the DIRTY state to CLEAN
        // this._getRevision();
    }

    _removeSubscriber(subscriberRef: WeakRef<ISubscriber>): void {
        this._subscribers.delete(subscriberRef);
    }

    _notify() {
        if (this._state === State.CLEAN) {
            this._state = State.DIRTY;
            notify(this._subscribers);
        }
    }

    _getRevision(): IRevision {
        if (this._state === State.CLEAN) {
            return this._revision;
        }

        if (this._state === State.NOT_INITIALIZED) {
            let result = this._recompute();
            this._value = result;
            this._revision = getRevision();
        } else if (this._state === State.DIRTY) {
            if (revisionsChanged(this._subscriptions)) {
                let result = this._recompute();
                if (!this._equals(this._value!, result)) {
                    this._value = result;
                    this._revision = getRevision();
                }
            }
        }

        this._state = State.CLEAN;

        return this._revision;
    }

    _recompute(): T {
        // Unsubscribe from all current subscriptions before recomputing,
        // so we start fresh and only subscribe to what we actually read.
        unsubscribe(this._subscriptions, this);
        this._subscriptions.clear();

        const stateBefore = this._state;

        this._state = State.COMPUTING;

        const oldSubscriber = setSubscriber(this);

        try {
            const result = this._fn();

            // We will return to previous state only when there is no exception
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

        const revision = this._getRevision();

        if (subscriber) {
            subscriber._subscriptions.set(this, revision);
            this._subscribers.add(subscriber._weakRef);
        }

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
