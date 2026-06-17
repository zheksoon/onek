import { State } from "../constants";
import { setSubscriber, subscriber } from "../subscriber";
import { withUntracked } from "../transaction";
import type { Equals, IComputedImpl, IRevision, ISubscriber, ISubscription } from "../types";
import { notify, revisionsChanged, unsubscribeAndCleanup } from "./common";
import { registerSubscriber } from "./registry";
import { newRevision } from "./revision";

type ComputedState = State.CLEAN | State.NOT_INITIALIZED | State.COMPUTING | State.DIRTY;

export class Computed<T = any> implements IComputedImpl<T> {
    readonly _weakRef = new WeakRef(this);
    readonly _subscriptions: Map<ISubscription, IRevision> = new Map();
    readonly _subscribers: Set<WeakRef<ISubscriber>> = new Set();

    private _value: T | undefined = undefined;
    private _revision: IRevision = newRevision();
    private _state: ComputedState = State.NOT_INITIALIZED;

    private readonly _fn: () => T;
    private readonly _equals: Equals<T>;

    constructor(fn: () => T, equals: Equals<T> = Object.is) {
        this._fn = fn;
        this._equals = withUntracked(equals);

        registerSubscriber(this);
    }

    _notify() {
        if (this._state === State.CLEAN) {
            this._state = State.DIRTY;
            notify(this._subscribers);
        }
    }

    _recomputeAndGetRevision(): IRevision {
        if (this._state === State.CLEAN) {
            return this._revision;
        }

        if (this._state === State.NOT_INITIALIZED) {
            let result = this._recompute();
            this._value = result;
            this._revision = newRevision();
        }

        if (this._state === State.DIRTY && revisionsChanged(this._subscriptions)) {
            let result = this._recompute();
            if (!this._equals(this._value!, result)) {
                this._value = result;
                this._revision = newRevision();
            }
        }

        this._state = State.CLEAN;

        return this._revision;
    }

    _recompute(): T {
        unsubscribeAndCleanup(this);
        this._state = State.COMPUTING;
        const oldSubscriber = setSubscriber(this);

        try {
            return this._fn();
        } catch (err) {
            this.destroy();
            throw err;
        } finally {
            setSubscriber(oldSubscriber);
        }
    }

    destroy(): void {
        unsubscribeAndCleanup(this);
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
    }

    get(): T {
        if (this._state === State.COMPUTING) {
            throw new Error("Recursive computed call");
        }

        const revision = this._recomputeAndGetRevision();

        if (subscriber) {
            subscriber._subscriptions.set(this, revision);
            this._subscribers.add(subscriber._weakRef);
        }

        return this._value!;
    }
}
