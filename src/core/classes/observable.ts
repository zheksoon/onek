import { subscriber } from "../subscriber";
import { endTx, withUntracked } from "../transaction";
import type { Equals, IObservableImpl, IRevision, ISubscriber } from "../types";
import { notify } from "./common";
import { Computed } from "./computed";
import { newRevision } from "./revision";

export class Observable<T = any> implements IObservableImpl<T> {
    readonly _subscribers: Set<WeakRef<ISubscriber>> = new Set();

    private _revision: IRevision = newRevision();
    private _value: T;
    private readonly _equals: Equals<T>;

    constructor(value: T, equals: Equals<T> = Object.is) {
        this._value = value;
        this._equals = withUntracked(equals);
    }

    _recomputeAndGetRevision(): IRevision {
        return this._revision;
    }

    get(): T {
        if (subscriber) {
            subscriber._subscriptions.set(this, this._revision);
            this._subscribers.add(subscriber._weakRef);
        }

        return this._value;
    }

    set(newValue: T): void {
        if (subscriber instanceof Computed) {
            throw new Error("Changing observable inside of computed");
        }

        if (this._equals(this._value, newValue)) {
            return;
        }

        this._value = newValue as T;

        this.notify();
    }

    notify(): void {
        this._revision = newRevision();

        notify(this._subscribers);

        endTx();
    }
}
