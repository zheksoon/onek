import { State } from "../constants";
import { scheduleReaction } from "../schedulers";
import { utx } from "../transaction";
import type { Destructor, IReactionImpl, IRevision, ISubscription, ReactionFn } from "../types";
import { revisionsChanged, unsubscribeAndCleanup } from "./common";
import { registerSubscriber } from "./registry";

type ReactionState = State.CLEAN | State.DIRTY | State.DESTROYED;

export class Reaction implements IReactionImpl {
    readonly _weakRef = new WeakRef(this);
    readonly _subscriptions: Map<ISubscription, IRevision> = new Map();

    private _destructor: Destructor = null;
    private _state: ReactionState = State.CLEAN;

    constructor(
        private _fn: ReactionFn,
        private _manager?: () => void
    ) {
        registerSubscriber(this);
    }

    _subscribeTo(subscription: ISubscription) {
        this._subscriptions.set(subscription, subscription._recomputeAndGetRevision());
    }

    _notify(): void {
        if (this._state === State.CLEAN) {
            this._state = State.DIRTY;
            scheduleReaction(this);
        }
    }

    _shouldRun(): boolean {
        return this._state === State.DIRTY && revisionsChanged(this._subscriptions);
    }

    _runManager(): void {
        if (this._manager) {
            this._manager();
        } else {
            this.run();
        }
    }

    _unsubscribeAndCleanup(): void {
        unsubscribeAndCleanup(this);
        this._destructor && utx(this._destructor);
        this._destructor = null;
        this._state = State.CLEAN;
    }

    _clean(): void {
        this._state = State.CLEAN;
    }

    destroy(): void {
        this._unsubscribeAndCleanup();
        this._state = State.DESTROYED;
    }

    run(fn: ReactionFn = this._fn): void {
        this._unsubscribeAndCleanup();
        this._destructor = utx(fn, this);
    }
}
