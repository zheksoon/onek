import type {
    CheckFn,
    IComputed,
    IComputedGetter,
    IComputedImpl,
    IRevision,
    NotifyState,
    Subscriber,
    Subscription,
} from "../types";
import { State } from "../constants";
import { setSubscriber, subscriber } from "../subscriber";
import { scheduleSubscribersCheck } from "../schedulers";
import { withUntracked } from "../transaction";
import { untrackedShallowEquals } from "../utils";
import { Revision } from "./revision";
import { checkRevisions, notifySubscribers, subscribe, unsubscribe } from "./common";

type ComputedState =
    | State.NOT_INITIALIZED
    | State.COMPUTING
    | State.COMPUTING_PASSIVE
    | State.CLEAN
    | State.MAYBE_DIRTY
    | State.DIRTY
    | State.PASSIVE;

export class Computed<T = any> implements IComputedImpl<T> {
    private _value: T | undefined = undefined;
    private _revision: IRevision = new Revision();
    private readonly _subscribers: Set<Subscriber> = new Set();
    private readonly _subscriptions: Map<Subscription, IRevision> = new Map();
    private _state: ComputedState = State.NOT_INITIALIZED;

    private declare readonly _fn: () => T;
    private declare readonly _checkFn?: CheckFn<T>;

    constructor(fn: () => T, checkFn?: boolean | CheckFn<T>) {
        this._fn = fn;
        this._checkFn = checkFn
            ? typeof checkFn === "function"
                ? withUntracked(checkFn)
                : untrackedShallowEquals
            : undefined;
    }

    addSubscription(subscription: Subscription): void {
        if (this._state !== State.COMPUTING_PASSIVE) {
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

    _notify(state: NotifyState, subscription: Subscription) {
        const oldState = this._state;

        if (oldState === state) {
            return;
        }

        if (this._checkFn) {
            if (oldState === State.CLEAN) {
                this._notifySubscribers(State.MAYBE_DIRTY);
            }
        } else {
            this._notifySubscribers(state);
        }

        this._state = state;

        if (state === State.DIRTY) {
            this._unsubscribe();
        }
    }

    _actualizeAndRecompute(willHaveSubscriber = false): void {
        if (this._state === State.PASSIVE && !checkRevisions(this._subscriptions)) {
            return;
        }

        if (this._state === State.MAYBE_DIRTY) {
            this._subscriptions.forEach((revision, subscription) => {
                subscription._actualizeAndRecompute(willHaveSubscriber);
            });

            if (this._state === State.MAYBE_DIRTY) {
                this._state = State.CLEAN;
            }
        }

        if (this._state !== State.CLEAN) {
            const oldState = this._state;
            const wasInitialized = oldState !== State.NOT_INITIALIZED;
            const wasNotPassive = oldState !== State.PASSIVE;

            const shouldSubscribe = willHaveSubscriber || (wasInitialized && wasNotPassive);

            this._subscriptions.clear();

            this._state = shouldSubscribe ? State.COMPUTING : State.COMPUTING_PASSIVE;

            const oldSubscriber = setSubscriber(this);

            try {
                const newValue = this._fn();

                this._state = shouldSubscribe ? State.CLEAN : State.PASSIVE;

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
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
    }

    get(_subscriber = subscriber): T {
        if (this._state === State.COMPUTING || this._state === State.COMPUTING_PASSIVE) {
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
        subscribe(this._subscriptions, this);
    }

    private _unsubscribe(): void {
        unsubscribe(this._subscriptions, this);
    }

    private _notifySubscribers(state: NotifyState): void {
        notifySubscribers(this._subscribers, state, this);
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
    get.revision = comp.revision.bind(comp);

    return get;
}

computed.box = <T>(fn: () => T, checkFn?: boolean | CheckFn<T>): IComputed<T> => {
    return new Computed(fn, checkFn);
};

computed.prop = <T>(fn: () => T, checkFn?: boolean | CheckFn<T>): T => {
    return new Computed(fn, checkFn) as unknown as T;
};
