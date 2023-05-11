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
import { scheduleReaction, scheduleStateActualization } from "../schedulers";
import { utx } from "../transaction";
import { checkRevisions, subscribe, unsubscribe } from "./common";

type ReactionState = State.CLEAN | State.DIRTY | State.DESTROYED;

export class Reaction implements IReactionImpl {
    public shouldSubscribe = true;
    public _changedSubscriptions = new Set<Subscription>();

    private _subscriptions: Map<Subscription, IRevision> = new Map();
    private _destructor: Destructor = null;
    private _state = State.CLEAN as ReactionState;

    constructor(private _fn: ReactionFn, private _manager?: () => void) {}

    addSubscription(subscription: Subscription): void {
        if (this.shouldSubscribe) {
            subscription._addSubscriber(this);
        }

        this._subscriptions.set(subscription, subscription.revision());
    }

    _notify(state: NotifyState, subscription: Subscription): void {
        if (state === State.MAYBE_DIRTY) {
            scheduleStateActualization(subscription);
        } else {
            this._changedSubscriptions.add(subscription);

            if (this._state === State.CLEAN) {
                this._state = State.DIRTY;
                scheduleReaction(this);
            }
        }
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

    subscribe(): void {
        subscribe(this._subscriptions, this);
    }

    unsubscribe(): void {
        unsubscribe(this._subscriptions, this);
    }

    unsubscribeAndCleanup(): void {
        this.unsubscribe();
        this._subscriptions.clear();
        this._changedSubscriptions.clear();
        this._destructor && this._destructor();
        this._destructor = null;
        this._state = State.CLEAN;
    }

    missedRun(): boolean {
        return checkRevisions(this._subscriptions);
    }

    destroy(): void {
        this.unsubscribeAndCleanup();
        this._state = State.DESTROYED;
    }

    run(): void {
        this.unsubscribeAndCleanup();

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
