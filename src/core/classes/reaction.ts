import type { Destructor, IRevision, ISubscription, NotifyState } from "../types";
import { State } from "../constants";
import { reactionQueue } from "../schedulers";
import { action } from "../transaction";
import { checkRevisions, subscribe, unsubscribe } from "./common";

type ReactionState = State.CLEAN | State.DIRTY | State.DESTROYED;

export function reaction(_fn, _manager) {
    const _subscriptions: Map<ISubscription, IRevision> = new Map();
    let _destructor: Destructor;
    let _state = State.CLEAN as ReactionState;

    const self = {
        _addSubscription(subscription: ISubscription): void {
            if (run._shouldSubscribe) {
                subscription._addSubscriber(self);
            }
            _subscriptions.set(subscription, subscription._getRevision());
        },
        _notify(state: NotifyState): void {
            if (state === State.MAYBE_DIRTY) {
                return;
            }

            if (_state === State.CLEAN) {
                _state = State.DIRTY;
                reactionQueue.push(_runManager);
            }
        },
    };

    const _runManager = (): void => {
        if (_state === State.DESTROYED) {
            return;
        }

        if (_manager) {
            _manager();
        } else {
            run();
        }
    };

    const cleanup = (): void => {
        unsubscribe(_subscriptions, self);
        _subscriptions.clear();
        _destructor && _destructor();
        _destructor = undefined;
        _state = State.CLEAN;
    };

    const destroy = (): void => {
        cleanup();
        _state = State.DESTROYED;
    };

    const runnerFn = action(() => {
        _destructor = _fn();
    }, self);

    const run = (): void => {
        cleanup();
        runnerFn();
    };

    run.destroy = destroy;

    run._shouldSubscribe = true;

    run._subscriptions = _subscriptions;

    run._subscribe = () => {
        subscribe(_subscriptions, self);
    };

    run._missedRun = () => {
        return checkRevisions(_subscriptions);
    };

    run._cleanup = cleanup;

    run._self = self;

    return run;
}

// export function reaction(fn: ReactionFn, manager?: () => void): Disposer {
//     const r = new Reaction(fn, manager);
//     const destructor = r.destroy.bind(r) as Disposer;
//     destructor.run = r.run.bind(r);
//
//     r.run();
//
//     return destructor;
// }
