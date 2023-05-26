import type { IRevision, ISubscriber, ISubscription, NotifyState } from "../types";
import { State } from "../constants";
import { setSubscriber, subscriber } from "../subscriber";
import { actualizationQueue, subscribersCheckQueue } from "../schedulers";
import { checkRevisions, notify, subscribe, unsubscribe } from "./common";

type ComputedState =
    | State.NOT_INITIALIZED
    | State.COMPUTING
    | State.COMPUTING_PASSIVE
    | State.CLEAN
    | State.MAYBE_DIRTY
    | State.DIRTY
    | State.PASSIVE;

export function computed<T = any>(_fn: () => T, _checkFn) {
    let _value: T | undefined;
    let _revision: IRevision = {};
    const _subscribers: Set<ISubscriber> = new Set();
    const _subscriptions: Map<ISubscription, IRevision> = new Map();
    let _state: ComputedState = State.NOT_INITIALIZED;

    const self = {
        _addSubscription(subscription: ISubscription): void {
            if (_state !== State.COMPUTING_PASSIVE) {
                subscription._addSubscriber(self);
            }

            _subscriptions.set(subscription, subscription._getRevision());
        },
        _addSubscriber(subscriber: ISubscriber): void {
            _subscribers.add(subscriber);

            if (_state === State.PASSIVE) {
                subscribe(_subscriptions, self);
                _state = State.CLEAN;
            }
        },
        _removeSubscriber(subscriber: ISubscriber): void {
            _subscribers.delete(subscriber);

            if (_subscribers.size && _state !== State.PASSIVE) {
                subscribersCheckQueue.add(self);
            }
        },
        _actualize(willHaveSubscriber: boolean): void {
            if (_state === State.PASSIVE) {
                if (!checkRevisions(_subscriptions)) return;
            }

            if (_state === State.MAYBE_DIRTY) {
                _subscriptions.forEach((revision, subscription) => {
                    subscription._actualize(willHaveSubscriber);
                });

                if (_state === State.MAYBE_DIRTY) {
                    _state = State.CLEAN;
                }
            }

            if (_state !== State.CLEAN) {
                const wasInitialized = _state !== State.NOT_INITIALIZED;
                const wasNotPassive = _state !== State.PASSIVE;

                const isActive = willHaveSubscriber || (wasInitialized && wasNotPassive);

                _state = isActive ? State.COMPUTING : State.COMPUTING_PASSIVE;

                _subscriptions.clear();

                const oldSubscriber = setSubscriber(self);

                try {
                    const newValue = _fn();

                    _state = isActive ? State.CLEAN : State.PASSIVE;

                    if (_checkFn && wasInitialized) {
                        if (_checkFn(_value!, newValue)) {
                            return;
                        }
                        notify(_subscribers, State.DIRTY);
                    }
                    _value = newValue;
                    _revision = {};
                } catch (e) {
                    destroy();
                    throw e;
                } finally {
                    setSubscriber(oldSubscriber);
                }
            }
        },
        _getRevision(): IRevision {
            self._actualize(false);

            return _revision;
        },
        _checkAndPassivate(): void {
            if (!_subscribers.size && _state !== State.PASSIVE) {
                unsubscribe(_subscriptions, self);
                _state = State.PASSIVE;
            }
        },
        _notify(state: NotifyState) {
            if (_state === state) {
                return;
            }

            if (_checkFn) {
                actualizationQueue.add(self);

                if (_state === State.CLEAN) {
                    notify(_subscribers, State.MAYBE_DIRTY);
                }
            } else {
                notify(_subscribers, state);
            }

            _state = state;

            if (state === State.DIRTY) {
                unsubscribe(_subscriptions, self);
            }
        },
    };

    const get = (_subscriber = subscriber): T => {
        if (_state === State.COMPUTING || _state === State.COMPUTING_PASSIVE) {
            throw new Error("recursive computed call");
        }

        self._actualize(!!subscriber);

        if (_subscriber) {
            _subscriber._addSubscription(self);
        }

        return _value!;
    };

    const destroy = (): void => {
        unsubscribe(_subscriptions, self);
        _subscriptions.clear();
        _state = State.NOT_INITIALIZED;
        _value = undefined;
    };

    get.destroy = destroy;

    return get;
}

//
// export function computed<T>(fn: () => T, checkFn?: boolean | CheckFn<T>): IComputedGetter<T> {
//     const comp = new Computed(fn, checkFn);
//     const get = comp.get.bind(comp) as IComputedGetter<T>;
//
//     get.instance = comp;
//     get.destroy = comp.destroy.bind(comp);
//     get._getRevision = comp._getRevision.bind(comp);
//
//     return get;
// }
//
// computed.box = <T>(fn: () => T, checkFn?: boolean | CheckFn<T>): IComputed<T> => {
//     return new Computed(fn, checkFn);
// };
//
// computed.prop = <T>(fn: () => T, checkFn?: boolean | CheckFn<T>): T => {
//     return new Computed(fn, checkFn) as unknown as T;
// };
