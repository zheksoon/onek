import type {
    Destructor,
    Disposer,
    IReactionImpl,
    IRevision,
    NotifyState,
    ReactionFn,
    Subscription,
} from "../types";
import { State } from "../constants";
import { scheduleReaction } from "../schedulers";
import { utx } from "../transaction";

type ReactionState = State.CLEAN | State.DIRTY | State.DESTROYED;

export class Reaction implements IReactionImpl {
    public _shouldSubscribe = true;

    private _subscriptions: Map<Subscription, IRevision> = new Map();
    private _destructor: Destructor = null;
    private _state = State.CLEAN as ReactionState;

    constructor(private _fn: ReactionFn, private _manager?: () => void) {
    }

    addSubscription(subscription: Subscription): void {
        if (this._shouldSubscribe) {
            subscription._addSubscriber(this);
        }

        this._subscriptions.set(subscription, subscription.revision());
    }

    _notify(state: NotifyState): void {
        if (state === State.MAYBE_DIRTY) {
            return;
        }

        if (this._state === State.CLEAN) {
            this._state = State.DIRTY;
            scheduleReaction(this);
        }
    }

    _subscribe(): void {
        this._subscriptions.forEach((revision, subscription) => {
            subscription._addSubscriber(this);
        });
    }

    _unsubscribe(): void {
        this._subscriptions.forEach((revision, subscription) => {
            subscription._removeSubscriber(this);
        });
    }

    _unsubscribeAndRemove(): void {
        this._unsubscribe();
        this._subscriptions.clear();
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
            this.run();
        }
    }

    _missedRun(): boolean {
        let revisionsChanged = false;

        this._subscriptions.forEach((revision, subscription) => {
            revisionsChanged ||= subscription.revision() !== revision;
        });

        return revisionsChanged;
    }

    destroy(): void {
        this._unsubscribeAndRemove();
        this._state = State.DESTROYED;
    }

    run(): void {
        this._unsubscribeAndRemove();

        utx(this._runnerFn, this);
    }

    private _runnerFn = () => {
        this._destructor = this._fn();
    };
}

export function reaction(fn: ReactionFn, manager?: () => void): Disposer {
    const r = new Reaction(fn, manager);
    const destructor = r.destroy.bind(r) as Disposer;
    destructor.run = r.run.bind(r);

    r.run();

    return destructor;
}
