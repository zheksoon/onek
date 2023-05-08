import type {
    CheckFn,
    IObservable,
    IObservableGetter,
    IObservableImpl,
    IRevision,
    ISetter,
    Subscriber,
    SubscriberBase,
    UpdaterFn,
} from "../types";
import { State } from "../constants";
import { Computed } from "./computed";
import { Revision } from "./revision";
import { subscriber } from "../subscriber";
import { endTx, withUntracked } from "../transaction";
import { untrackedShallowEquals } from "../utils";
import { notifySubscribers } from "./common";

export class Observable<T = any> implements IObservableImpl<T> {
    private _revision: IRevision = new Revision();
    private _subscribers: Set<Subscriber> = new Set();

    private declare _value: T;
    private declare readonly _checkFn?: CheckFn<T>;

    constructor(value: T, checkFn?: boolean | CheckFn<T>) {
        this._value = value;
        this._checkFn = checkFn
            ? typeof checkFn === "function"
                ? withUntracked(checkFn)
                : untrackedShallowEquals
            : undefined;
    }

    _addSubscriber(subscriber: Subscriber): void {
        this._subscribers.add(subscriber);
    }

    _removeSubscriber(subscriber: Subscriber): void {
        this._subscribers.delete(subscriber);
    }

    _actualizeAndRecompute(): void {
        // noop
    }

    revision(): IRevision {
        return this._revision;
    }

    get(_subscriber = subscriber): T {
        if (_subscriber) {
            _subscriber.addSubscription(this);
        }
        return this._value;
    }

    set(newValue?: T | UpdaterFn<T>, asIs?: boolean): void {
        if (subscriber && subscriber instanceof Computed) {
            throw new Error("Changing observable inside of computed");
        }

        if (arguments.length > 0) {
            if (typeof newValue === "function" && !asIs) {
                newValue = (newValue as UpdaterFn<T>)(this._value);
            }

            if (this._checkFn && this._checkFn(this._value, newValue as T)) {
                return;
            }

            this._value = newValue as T;
        }

        this.notify();
    }

    notify(): void {
        this._revision = new Revision();

        notifySubscribers(this._subscribers, State.DIRTY, this);
        endTx();
    }
}

export function observable<T>(value: T, checkFn?: boolean | CheckFn<T>) {
    const obs = new Observable(value, checkFn);
    const get = obs.get.bind(obs) as IObservableGetter<T>;
    const set = obs.set.bind(obs) as ISetter<T>;

    get.instance = obs;

    return [get, set] as const;
}

observable.box = <T>(value: T, checkFn?: boolean | CheckFn<T>): IObservable<T> => {
    return new Observable(value, checkFn);
};

observable.prop = <T>(value: T, checkFn?: boolean | CheckFn<T>): T => {
    return new Observable(value, checkFn) as unknown as T;
};
