import type {
    Equals,
    IObservable,
    IObservableGetter,
    IObservableImpl,
    IRevision,
    ISetter,
    ISubscriber,
    UpdaterFn,
} from "../types";
import { Computed } from "./computed";
import { getRevision } from "./revision";
import { subscriber } from "../subscriber";
import { endTx, withUntracked } from "../transaction";
import { notify } from "./common";

export class Observable<T = any> implements IObservableImpl<T> {
    private _revision: IRevision = getRevision();
    private _subscribers: Set<WeakRef<ISubscriber>> = new Set();

    private declare _value: T;
    private declare readonly _equals: Equals<T>;

    constructor(value: T, equals = Object.is) {
        this._value = value;
        this._equals = withUntracked(equals);
    }

    _addSubscriber(subscriberRef: WeakRef<ISubscriber>): void {
        this._subscribers.add(subscriberRef);
    }

    _removeSubscriber(subscriberRef: WeakRef<ISubscriber>): void {
        this._subscribers.delete(subscriberRef);
    }

    _getRevision(): IRevision {
        return this._revision;
    }

    get(): T {
        if (subscriber) {
            subscriber._subscriptions.set(this, this._revision);
            this._subscribers.add(subscriber._weakRef);
        }

        return this._value;
    }

    set(newValue?: T | UpdaterFn<T>, asIs?: boolean): void {
        if (subscriber instanceof Computed) {
            throw new Error("Changing observable inside of computed");
        }

        if (arguments.length > 0) {
            if (typeof newValue === "function" && !asIs) {
                newValue = (newValue as UpdaterFn<T>)(this._value);
            }

            if (this._equals(this._value, newValue as T)) {
                return;
            }

            this._value = newValue as T;
        }

        this.notify();
    }

    notify(): void {
        this._revision = getRevision();

        notify(this._subscribers);

        endTx();
    }
}

export function observable<T>(value: T, checkFn?: Equals<T>) {
    const obs = new Observable(value, checkFn);
    const get = obs.get.bind(obs) as IObservableGetter<T>;
    const set = obs.set.bind(obs) as ISetter<T>;

    get.instance = obs;
    get.revision = obs._getRevision.bind(obs);

    return [get, set] as const;
}

observable.box = <T>(value: T, checkFn?: Equals<T>): IObservable<T> => {
    return new Observable(value, checkFn);
};

observable.prop = <T>(value: T, checkFn?: Equals<T>): T => {
    return new Observable(value, checkFn) as unknown as T;
};
