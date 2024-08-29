import type {
    CheckFn,
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
import { Revision } from "./revision";
import { checkRevisions, notify, subscribe, unsubscribe } from "./common";

type ComputedState = State.CLEAN | State.NOT_INITIALIZED | State.COMPUTING | State.DIRTY;

export class Computed<T = any> implements IComputedImpl<T> {
    private _value: T | undefined = undefined;
    private _revision: IRevision = new Revision();
    private readonly _subscribers: Set<ISubscriber> = new Set();
    private readonly _subscriptions: Map<ISubscription, IRevision> = new Map();
    private _state: ComputedState = State.NOT_INITIALIZED;

    private declare readonly _fn: () => T;
    private declare readonly _checkFn: CheckFn<T>;

    constructor(fn: () => T, checkFn: CheckFn<T> = Object.is) {
        this._fn = fn;
        this._checkFn = withUntracked(checkFn);
    }

    addSubscription(subscription: ISubscription): void {
        this._subscriptions.set(subscription, subscription._getRevision());

        if (this._subscribers.size) {
            subscription._addSubscriber(this);
        }
    }

    _addSubscriber(subscriber: ISubscriber): void {
        if (!this._subscribers.size) {
            subscribe(this._subscriptions, this);
        }

        this._subscribers.add(subscriber);
    }

    _removeSubscriber(subscriber: ISubscriber): void {
        this._subscribers.delete(subscriber);

        if (!this._subscribers.size) {
            scheduleSubscribersCheck(this);
        }
    }

    _checkAndPassivate(): void {
        if (!this._subscribers.size) {
            unsubscribe(this._subscriptions, this);
            this._state = State.DIRTY;
        }
    }

    _notify() {
        unsubscribe(this._subscriptions, this);
        notify(this._subscribers);
        this._state = State.DIRTY;
    }

    _getRevision(): IRevision {
        if (this._state === State.NOT_INITIALIZED) {
            this._value = this._recompute();
        }

        if (this._state === State.DIRTY) {
            if (checkRevisions(this._subscriptions)) {
                let result = this._recompute();

                if (!this._checkFn(this._value!, result)) {
                    this._value = result;
                    this._revision = new Revision();
                }
            } else if (this._subscribers.size) {
                subscribe(this._subscriptions, this);
            }
        }

        this._state = this._subscribers.size ? State.CLEAN : State.DIRTY;

        return this._revision;
    }

    _recompute(): T {
        unsubscribe(this._subscriptions, this);

        this._subscriptions.clear();
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
        unsubscribe(this._subscriptions, this);
        this._subscriptions.clear();
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
    }

    get(_subscriber = subscriber): T {
        if (this._state === State.COMPUTING) {
            throw new Error("Recursive computed call");
        }

        if (_subscriber) {
            _subscriber.addSubscription(this);
        }

        this._getRevision();

        return this._value!;
    }
}

export function computed<T>(fn: () => T, checkFn?: CheckFn<T>): IComputedGetter<T> {
    const comp = new Computed(fn, checkFn);
    const get = comp.get.bind(comp) as IComputedGetter<T>;

    get.instance = comp;
    get.destroy = comp.destroy.bind(comp);
    get.revision = comp._getRevision.bind(comp);

    return get;
}

computed.box = <T>(fn: () => T, checkFn?: CheckFn<T>): IComputed<T> => {
    return new Computed(fn, checkFn);
};

computed.prop = <T>(fn: () => T, checkFn?: CheckFn<T>): T => {
    return new Computed(fn, checkFn) as unknown as T;
};
