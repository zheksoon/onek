import type {
    CheckFn,
    ObservableGetter,
    ObservableImpl,
    Revision,
    Setter,
    Subscriber,
    UpdaterFn,
} from "../types";
import { State } from "../constants";
import { Computed } from "./computed";
import { subscriber } from "../subscriber";
import { scheduleReactionRunner } from "../schedulers";
import { txDepth, withUntracked } from "../transaction";
import { shallowEquals } from "../utils";

export class Observable<T = any> implements ObservableImpl<T> {
    private _revision: Revision = {};
    private _subscribers: Set<Subscriber> = new Set();

    private declare _value: T;
    private declare readonly _checkFn?: CheckFn<T>;

    constructor(value: T, checkFn?: boolean | CheckFn<T>) {
        this._value = value;
        this._checkFn = checkFn
            ? typeof checkFn === "function"
                ? withUntracked(checkFn)
                : shallowEquals
            : undefined;
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
    }

    _getRevision(): Revision {
        return this._revision;
    }

    _getValue(_subscriber = subscriber): T {
        if (_subscriber) {
            _subscriber._addSubscription(this);
        }
        return this._value;
    }

    _setValue(newValue?: T | UpdaterFn<T>, asIs?: boolean): void {
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
            this._revision = {};
        }
        this._notifyChanged();
    }

    private _notifyChanged(): void {
        this._subscribers.forEach((subs) => subs._notify(State.DIRTY, this));
        !txDepth && scheduleReactionRunner();
    }
}

export function observable<T>(value: T, checkFn?: boolean | CheckFn<T>) {
    const obs = new Observable(value, checkFn);
    const get = obs._getValue.bind(obs) as ObservableGetter<T>;
    const set = obs._setValue.bind(obs) as Setter<T>;

    get.$$observable = obs;

    return [get, set] as const;
}
