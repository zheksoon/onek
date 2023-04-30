import type {
    CheckFn,
    ComputedGetter,
    ComputedImpl,
    Revision,
    Subscriber,
    Subscription,
} from "../types";
import { State } from "../constants";
import { setSubscriber, subscriber } from "../subscriber";
import { scheduleSubscribersCheck } from "../schedulers";
import { withUntracked } from "../transaction";
import { shallowEquals } from "../utils";

type ComputedState =
    | State.NOT_INITIALIZED
    | State.CLEAN
    | State.MAYBE_DIRTY
    | State.DIRTY
    | State.COMPUTING
    | State.PASSIVE;

export class Computed<T = any> implements ComputedImpl<T> {
    private _value: T | undefined = undefined;
    private _revision: Revision = {};
    private readonly _subscribers: Set<Subscriber> = new Set();
    private _subscriptions: Subscription[] = [];
    private _subscriptionRevisions: Revision[] = [];
    private _subscriptionsToActualize: Computed[] = [];
    private _state: ComputedState = State.NOT_INITIALIZED;
    private _shouldSubscribe = true;

    private declare readonly _fn: () => T;
    private declare readonly _checkFn?: CheckFn<T>;

    constructor(fn: () => T, checkFn?: boolean | CheckFn<T>) {
        this._fn = fn;
        this._checkFn = checkFn
            ? typeof checkFn === "function"
                ? withUntracked(checkFn)
                : shallowEquals
            : undefined;
    }

    _addSubscription(subscription: Subscription): void {
        if (!this._shouldSubscribe || subscription._addSubscriber(this)) {
            this._subscriptions.push(subscription);
            this._subscriptionRevisions.push(subscription._getRevision());
        }
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
        this._checkSubscribers();
    }

    _checkSubscribers(): void {
        if (!this._subscribers.size && this._state !== State.PASSIVE) {
            scheduleSubscribersCheck(this);
        }
    }

    _checkSubscribersAndPassivate(): void {
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
                return subs._getRevision() !== this._subscriptionRevisions[idx];
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
            const oldState = this._state;
            const wasPassive = oldState === State.PASSIVE;
            const oldSubscriber = setSubscriber(this);

            this._subscriptions = [];
            this._subscriptionRevisions = [];
            this._shouldSubscribe = !wasPassive;

            this._state = State.COMPUTING;

            try {
                const newValue = this._fn();

                this._state = wasPassive ? State.PASSIVE : State.CLEAN;

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

    _destroy(): void {
        this._unsubscribe();
        this._subscriptions = [];
        this._subscriptionRevisions = [];
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

        if (_subscriber) {
            if (this._state === State.PASSIVE) {
                this._resurrect();
            }

            _subscriber._addSubscription(this);
        } else {
            this._checkSubscribers();
        }

        return this._value!;
    }

    private _subscribe(): void {
        this._subscriptions.forEach((subs) => {
            subs._addSubscriber(this);
        });
    }

    private _unsubscribe(): void {
        this._subscriptions.forEach((subs) => {
            subs._removeSubscriber(this);
        });
    }

    private _notifySubscribers(state: State): void {
        this._subscribers.forEach((subs) => {
            subs._notify(state, this);
        });
    }

    private _passivate(): void {
        this._unsubscribe();
        this._state = State.PASSIVE;
    }

    private _resurrect(): void {
        this._subscribe();
        this._state = State.CLEAN;
    }
}

export function computed<T>(
    fn: () => T,
    checkFn?: boolean | CheckFn<T>
): ComputedGetter<T> {
    const comp = new Computed(fn, checkFn);
    const get = comp._getValue.bind(comp) as ComputedGetter<T>;

    get.$$computed = comp;
    get.destroy = comp._destroy.bind(comp);

    return get;
}
