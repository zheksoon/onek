import {
    ReactionFn,
    ReactionImpl,
    ReactionReturnValue,
    State,
    Subscription,
} from "../types";
import {
    scheduleReaction,
    scheduleStateActualization,
} from "../reactionScheduler";
import { Computed } from "./computed";
import { utx } from "../transaction";

export type ReactionState = State.CLEAN | State.DIRTY | State.DESTROYED;

export class Reaction implements ReactionImpl {
    _subscriptions = [];
    _destructor = null;
    _state = State.CLEAN as ReactionState;
    _shouldSubscribe = true;

    constructor(public _fn: ReactionFn, public _manager?: () => void) {}

    _runnerFn = () => {
        this._destructor = this._fn();
    };

    _addSubscription(subscription: Subscription): void {
        if (!this._shouldSubscribe || subscription._addSubscriber(this)) {
            this._subscriptions.push(subscription);
        }
    }

    _notify(state: State, subscription: Subscription): void {
        if (state === State.MAYBE_DIRTY) {
            scheduleStateActualization(subscription as Computed);
        } else if (this._state === State.CLEAN) {
            this._state = State.DIRTY;
            scheduleReaction(this);
        }
    }

    _subscribe(): void {
        this._subscriptions.forEach((subs) => {
            subs._addSubscriber(this);
        });
    }

    _unsubscribe(): void {
        this._subscriptions.forEach((subs) => {
            subs._removeSubscriber(this);
        });
    }

    _unsubscribeAndRemove(): void {
        this._unsubscribe();
        this._subscriptions = [];
        this._destructor && this._destructor();
        this._destructor = null;
        this._state = State.CLEAN;
    }

    _runManager(): void {
        if (this._state === State.DESTROYED) {
            return;
        }

        if (this._manager) {
            this._manager();
        } else {
            this._run();
        }
    }

    _destroy(): void {
        this._unsubscribeAndRemove();
        this._state = State.DESTROYED;
    }

    _run(): void {
        this._unsubscribeAndRemove();

        utx(this._runnerFn, this);
    }
}

export function reaction(
    fn: ReactionFn,
    manager?: () => void
): ReactionReturnValue {
    const r = new Reaction(fn, manager);
    const destructor = r._destroy.bind(r);
    destructor.run = r._run.bind(r);

    r._run();

    return destructor;
}
