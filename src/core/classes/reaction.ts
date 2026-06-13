import type {
    Destructor,
    Disposer,
    IReactionImpl,
    IRevision,
    ReactionFn,
    ISubscription,
} from "../types";
import { State } from "../constants";
import { scheduleReaction } from "../schedulers";
import { utx } from "../transaction";
import { revisionsChanged, unsubscribe } from "./common";
import { register } from "./registry";

type ReactionState = State.CLEAN | State.DIRTY | State.DESTROYED;

export class Reaction implements IReactionImpl {
    readonly _weakRef = new WeakRef(this);
    readonly _subscriptions: Map<ISubscription, IRevision> = new Map();

    private _destructor: Destructor = null;
    private _state: ReactionState = State.CLEAN;

    constructor(private _fn: ReactionFn, private _manager?: () => void) {
        register(this, this._subscriptions);
    }

    _notify(): void {
        if (this._state === State.CLEAN) {
            this._state = State.DIRTY;
            scheduleReaction(this);
        }
    }

    runManager(): void {
        if (!revisionsChanged(this._subscriptions)) {
            this._state = State.CLEAN;

            return;
        }

        if (this._manager) {
            this._manager();
        } else {
            this.run();
        }
    }

    unsubscribeAndCleanup(): void {
        unsubscribe(this._subscriptions, this);
        this._subscriptions.clear();
        this._destructor && this._destructor();
        this._destructor = null;
        this._state = State.CLEAN;
    }

    destroy(): void {
        this.unsubscribeAndCleanup();
        this._state = State.DESTROYED;
    }

    run(): void {
        this.unsubscribeAndCleanup();

        this._destructor = utx(this._fn, this);
    }
}

export function reaction(fn: ReactionFn, manager?: () => void): Disposer {
    const r = new Reaction(fn, manager);
    const destructor = r.destroy.bind(r) as Disposer;
    destructor.run = r.run.bind(r);

    r.run();

    return destructor;
}
