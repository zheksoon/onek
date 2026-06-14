import type {
    Equals,
    IObservableImpl,
    IRevision,
    ISubscriber,
    UpdaterFn,
} from "../types";
import { Computed } from "./computed";
import { newRevision } from "./revision";
import { subscriber } from "../subscriber";
import { endTx, withUntracked } from "../transaction";
import { notify } from "./common";

export class Observable<T = any> implements IObservableImpl<T> {
    readonly _subscribers: Set<WeakRef<ISubscriber>> = new Set();

    private _revision: IRevision = newRevision();
    private declare _value: T;
    private declare readonly _equals: Equals<T>;

    constructor(value: T, equals = Object.is) {
        this._value = value;
        this._equals = withUntracked(equals);
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
        this._revision = newRevision();

        notify(this._subscribers);

        endTx();
    }
}
