import type { IRevision, ISubscriber, UpdaterFn } from "../types";
import { State } from "../constants";
import { Revision } from "./revision";
import { subscriber } from "../subscriber";
import { endTx } from "../transaction";
import { notify } from "./common";

export function observable<T = any>(_value: T, _checkFn) {
    let _revision: IRevision = {};
    const _subscribers: Set<ISubscriber> = new Set();

    const self = {
        _addSubscriber(subscriber: ISubscriber): void {
            _subscribers.add(subscriber);
        },
        _removeSubscriber(subscriber: ISubscriber): void {
            _subscribers.delete(subscriber);
        },
        _actualize(): void {
            // noop
        },
        _getRevision(): IRevision {
            return _revision;
        },
    };

    const set = (newValue?: T | UpdaterFn<T>, asIs?): void => {
        if (subscriber) {
            throw new Error("changing observable outside of action");
        }

        if (arguments.length > 0) {
            if (typeof newValue === "function" && !asIs) {
                newValue = (newValue as UpdaterFn<T>)(_value);
            }

            if (_checkFn && _checkFn(_value, newValue as T)) {
                return;
            }

            _value = newValue as T;
        }

        _notify();
    };

    const _notify = (): void => {
        _revision = {};

        notify(_subscribers, State.DIRTY);
        endTx();
    };

    const get = (_subscriber = subscriber): T => {
        if (_subscriber) {
            _subscriber._addSubscription(self);
        }
        return _value;
    };

    get.notify = _notify;

    return [get, set] as const;
}

// export function observable<T>(value: T, checkFn?: boolean | CheckFn<T>) {
//     const obs = new Observable(value, checkFn);
//     const get = obs.get.bind(obs) as IObservableGetter<T>;
//     const set = obs.set.bind(obs) as ISetter<T>;
//
//     get.instance = obs;
//     get._getRevision = obs._getRevision.bind(obs);
//
//     return [get, set] as const;
// }
//
// observable.box = <T>(value: T, checkFn?: boolean | CheckFn<T>): IObservable<T> => {
//     return new Observable(value, checkFn);
// };
//
// observable.prop = <T>(value: T, checkFn?: boolean | CheckFn<T>): T => {
//     return new Observable(value, checkFn) as unknown as T;
// };
