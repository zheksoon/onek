import { shallowEquals } from "../utils/shallowEquals";
import {
    CheckFn,
    ComputedGetter,
    ComputedImpl,
    Revision,
    State,
    Subscriber,
    Subscription,
} from "../types";
import { untracked } from "../transaction";
import { setSubscriber, subscriber } from "../globals";
import { scheduleSubscribersCheck } from "../reactionScheduler";

export type ComputedState =
    | State.NOT_INITIALIZED
    | State.CLEAN
    | State.MAYBE_DIRTY
    | State.DIRTY
    | State.COMPUTING
    | State.PASSIVE;

export class Computed<T = any> implements ComputedImpl<T> {
    _value: T | undefined = undefined;
    _revision: Revision = {};
    _subscribers: Set<Subscriber> = new Set();
    _revisions: Revision[] = [];
    _subscriptions: Subscription[] = [];
    _subscriptionsToActualize: Computed[] = [];
    _state: ComputedState = State.NOT_INITIALIZED;

    public declare readonly _fn: () => T;
    public declare readonly _checkFn?: CheckFn<T>;

    constructor(fn: () => T, checkFn?: boolean | CheckFn<T>) {
        this._fn = fn;
        this._checkFn = checkFn
            ? typeof checkFn === "function"
                ? untracked(checkFn)
                : shallowEquals
            : undefined;
    }

    _addSubscription(subscription: Subscription): void {
        if (subscription._addSubscriber(this)) {
            this._subscriptions.push(subscription);
            this._revisions.push(subscription._getRevision());
        }
    }

    _unsubscribe(): void {
        this._subscriptions.forEach((subs) => {
            subs._removeSubscriber(this);
        });
    }

    _addSubscriber(subscriber: Subscriber): boolean {
        if (!this._subscribers.has(subscriber)) {
            this._subscribers.add(subscriber);
            return true;
        }
        return false;
    }

    _removeSubscriber(subscriber: Subscriber): void {
        this._subscribers.delete(subscriber);

        if (!this._subscribers.size) {
            scheduleSubscribersCheck(this);
        }
    }

    _notifySubscribers(state: State): void {
        this._subscribers.forEach((subs) => {
            subs._notify(state, this);
        });
    }

    _checkSubscribers(): void {
        if (!this._subscribers.size && this._state !== State.PASSIVE) {
            this._passivate();
        }
    }

    _notify(state: State, subscription: Subscription) {
        if (this._state >= state) return;

        if (this._checkFn) {
            if (this._state === State.CLEAN) {
                this._notifySubscribers(State.MAYBE_DIRTY);
            }
        } else {
            this._notifySubscribers(state);
        }

        this._state = state as ComputedState;

        if (state === State.MAYBE_DIRTY) {
            this._subscriptionsToActualize.push(subscription as Computed);
        } else {
            this._unsubscribe();
        }
    }

    _actualizeAndRecompute(): void {
        if (this._state === State.PASSIVE) {
            const revisionsChanged = this._subscriptions.some((subs, idx) => {
                return subs._getRevision() !== this._revisions[idx];
            });

            if (!revisionsChanged) {
                return;
            }
        }

        if (this._state === State.MAYBE_DIRTY) {
            this._subscriptionsToActualize.forEach((subs) => {
                subs._actualizeAndRecompute();
            });
            this._subscriptionsToActualize = [];

            if (this._state === State.MAYBE_DIRTY) {
                this._state = State.CLEAN;
            }
        }

        if (this._state !== State.CLEAN) {
            const oldSubscriber = setSubscriber(this);
            const oldState = this._state;

            this._subscriptions = [];
            this._revisions = [];

            this._state = State.COMPUTING;

            try {
                const newValue = this._fn();

                this._state = State.CLEAN;

                if (this._checkFn && oldState !== State.NOT_INITIALIZED) {
                    if (this._checkFn(this._value!, newValue)) {
                        return;
                    }
                    this._notifySubscribers(State.DIRTY);
                }
                this._value = newValue;
                this._revision = {};
            } catch (e) {
                this._destroy();
                throw e;
            } finally {
                setSubscriber(oldSubscriber);
            }
        }
    }

    _passivate(): void {
        this._unsubscribe();
        this._state = State.PASSIVE;
    }

    _destroy(): void {
        this._unsubscribe();
        this._subscriptions = [];
        this._revisions = [];
        this._subscriptionsToActualize = [];
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
    }

    _getRevision(): Revision {
        this._actualizeAndRecompute();

        return this._revision;
    }

    _getValue(_subscriber = subscriber): T {
        if (this._state === State.COMPUTING) {
            throw new Error("Recursive computed call");
        }

        this._actualizeAndRecompute();

        if (subscriber) {
            subscriber._addSubscription(this);
        } else {
            scheduleSubscribersCheck(this);
        }

        return this._value!;
    }
}

export function computed<T>(
    fn: () => T,
    checkFn?: boolean | CheckFn<T>
): ComputedGetter<T> {
    const comp = new Computed(fn, checkFn);
    const get = comp._getValue.bind(comp);

    get.$$computed = comp;
    get.destroy = comp._destroy.bind(comp);

    return get;
}
