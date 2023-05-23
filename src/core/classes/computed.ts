import type {
    CheckFn,
    IComputed,
    IComputedGetter,
    IComputedImpl,
    IRevision,
    ISubscriber,
    ISubscription,
    NotifyState,
} from "../types";
import { State } from "../constants";
import { setSubscriber, subscriber } from "../subscriber";
import { scheduleActualization, scheduleSubscribersCheck } from "../schedulers";
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
    private readonly _subscribers: Set<ISubscriber> = new Set();
    private readonly _subscriptions: Map<ISubscription, IRevision> = new Map();
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

    addSubscription(subscription: ISubscription): void {
        if (this._state !== State.COMPUTING_PASSIVE) {
            subscription._addSubscriber(this);
        }

        this._subscriptions.set(subscription, subscription.revision());
    }

    _addSubscriber(subscriber: ISubscriber): void {
        this._subscribers.add(subscriber);

        if (this._state === State.PASSIVE) {
            this._resurrect();
        }
    }

    _removeSubscriber(subscriber: ISubscriber): void {
        this._subscribers.delete(subscriber);

        if (!this._subscribers.size && this._state !== State.PASSIVE) {
            scheduleSubscribersCheck(this);
        }
    }

    _checkAndPassivate(): void {
        if (!this._subscribers.size && this._state !== State.PASSIVE) {
            this._passivate();
        }
    }

    _notify(state: NotifyState) {
        const oldState = this._state;

        if (oldState === state || oldState === State.DIRTY) {
            return;
        }

        if (this._checkFn) {
            scheduleActualization(this);

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

    _actualize(willHaveSubscriber: boolean): void {
        if (this._state === State.PASSIVE) {
            if (!checkRevisions(this._subscriptions)) {
                return;
            }
        }

        if (this._state === State.MAYBE_DIRTY) {
            this._subscriptions.forEach((revision, subscription) => {
                subscription._actualize(willHaveSubscriber);
            });

            if (this._state === State.MAYBE_DIRTY) {
                this._state = State.CLEAN;
            }
        }

        if (this._state !== State.CLEAN) {
            const oldState = this._state;
            const wasInitialized = oldState !== State.NOT_INITIALIZED;
            const wasNotPassive = oldState !== State.PASSIVE;

            const isActive = willHaveSubscriber || (wasInitialized && wasNotPassive);

            this._state = isActive ? State.COMPUTING : State.COMPUTING_PASSIVE;

            this._subscriptions.clear();

            const oldSubscriber = setSubscriber(this);

            try {
                const newValue = this._fn();

                this._state = isActive ? State.CLEAN : State.PASSIVE;

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
        this._actualize(false);

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

        this._actualize(subscriber !== null);

        if (_subscriber) {
            _subscriber.addSubscription(this);
        }

        return this._value!;
    }

    private _subscribe(): void {
        subscribe(this._subscriptions, this);
    }

    private _unsubscribe(): void {
        unsubscribe(this._subscriptions, this);
    }

    private _notifySubscribers(state: NotifyState): void {
        notifySubscribers(this._subscribers, state);
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
