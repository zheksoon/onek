import type {
    CheckFn,
    IComputed,
    IComputedGetter,
    IComputedImpl,
    IRevision,
    Subscriber,
    Subscription,
} from "../types";
import { State } from "../constants";
import { setSubscriber, subscriber } from "../subscriber";
import { scheduleSubscribersCheck } from "../schedulers";
import { withUntracked } from "../transaction";
import { shallowEquals } from "../utils/shallowEquals";
import { Revision } from "./revision";

type ComputedState =
    | State.NOT_INITIALIZED
    | State.CLEAN
    | State.MAYBE_DIRTY
    | State.DIRTY
    | State.COMPUTING
    | State.PASSIVE;

export class Computed<T = any> implements IComputedImpl<T> {
    private _value: T | undefined = undefined;
    private _revision: IRevision = new Revision();
    private readonly _subscribers: Set<Subscriber> = new Set();
    private readonly _subscriptions: Map<Subscription, IRevision> = new Map();
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

    addSubscription(subscription: Subscription): void {
        if (this._shouldSubscribe) {
            subscription._addSubscriber(this);
        }

        this._subscriptions.set(subscription, subscription.revision());
    }

    _addSubscriber(subscriber: Subscriber): void {
        this._subscribers.add(subscriber);

        if (this._state === State.PASSIVE) {
            this._resurrect();
        }
    }

    _removeSubscriber(subscriber: Subscriber): void {
        this._subscribers.delete(subscriber);
        this._checkSubscribers();
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

    _actualizeAndRecompute(willHaveSubscriber = false): void {
        if (this._state === State.PASSIVE) {
            let revisionsChanged = false;

            this._subscriptions.forEach((revision, subscription) => {
                revisionsChanged ||= subscription.revision() !== revision;
            });

            if (!revisionsChanged) {
                return;
            }
        }

        if (this._state === State.MAYBE_DIRTY) {
            this._subscriptionsToActualize.forEach((subs) => {
                subs._actualizeAndRecompute(willHaveSubscriber);
            });
            this._subscriptionsToActualize = [];

            if (this._state === State.MAYBE_DIRTY) {
                this._state = State.CLEAN;
            }
        }

        if (this._state !== State.CLEAN) {
            const oldState = this._state;
            const wasInitialized = oldState !== State.NOT_INITIALIZED;
            const wasNotPassive = oldState !== State.PASSIVE;

            this._shouldSubscribe = willHaveSubscriber || (wasInitialized && wasNotPassive);

            this._subscriptions.clear();

            this._state = State.COMPUTING;

            const oldSubscriber = setSubscriber(this);

            try {
                const newValue = this._fn();

                this._state = this._shouldSubscribe ? State.CLEAN : State.PASSIVE;

                if (this._checkFn && wasInitialized) {
                    if (this._checkFn(this._value!, newValue)) {
                        return;
                    }
                    this._notifySubscribers(State.DIRTY);
                }
                this._value = newValue;
                this._revision = new Revision();
            } catch (e) {
                this.destroy();
                throw e;
            } finally {
                setSubscriber(oldSubscriber);
            }
        }
    }

    revision(): IRevision {
        this._actualizeAndRecompute();

        return this._revision;
    }

    destroy(): void {
        this._unsubscribe();
        this._subscriptions.clear();
        this._subscriptionsToActualize = [];
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
    }

    get(_subscriber = subscriber): T {
        if (this._state === State.COMPUTING) {
            throw new Error("Recursive computed call");
        }

        const willHaveSubscriber = !!_subscriber;

        this._actualizeAndRecompute(willHaveSubscriber);

        if (willHaveSubscriber) {
            _subscriber.addSubscription(this);
        }

        return this._value!;
    }

    private _checkSubscribers(): void {
        if (!this._subscribers.size && this._state !== State.PASSIVE) {
            scheduleSubscribersCheck(this);
        }
    }

    private _subscribe(): void {
        this._subscriptions.forEach((revision, subscription) => {
            subscription._addSubscriber(this);
        });
    }

    private _unsubscribe(): void {
        this._subscriptions.forEach((revision, subscription) => {
            subscription._removeSubscriber(this);
        });
    }

    private _notifySubscribers(state: State): void {
        this._subscribers.forEach((subscriber) => {
            subscriber._notify(state, this);
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

export function computed<T>(fn: () => T, checkFn?: boolean | CheckFn<T>): IComputedGetter<T> {
    const comp = new Computed(fn, checkFn);
    const get = comp.get.bind(comp) as IComputedGetter<T>;

    get.instance = comp;
    get.destroy = comp.destroy.bind(comp);

    return get;
}

computed.box = <T>(fn: () => T, checkFn?: boolean | CheckFn<T>): IComputed<T> => {
    return new Computed(fn, checkFn);
};

computed.prop = <T>(fn: () => T, checkFn?: boolean | CheckFn<T>): T => {
    return new Computed(fn, checkFn) as unknown as T;
};
