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
import { revisionsChanged, subscribe, unsubscribe } from "./common";

type ReactionState = State.CLEAN | State.DIRTY | State.DESTROYED;

export class Reaction implements IReactionImpl {
    public shouldSubscribe = true;

    private _subscriptions: Map<ISubscription, IRevision> = new Map();
    private _destructor: Destructor = null;
    private _state: ReactionState = State.CLEAN;

    constructor(private _fn: ReactionFn, private _manager?: () => void) {}

    addSubscription(subscription: ISubscription): void {
        if (this.shouldSubscribe) {
            subscription._addSubscriber(this);
        }

        this._subscriptions.set(subscription, subscription._getRevision());
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

    subscribe(): void {
        subscribe(this._subscriptions, this);
    }

    unsubscribe(): void {
        unsubscribe(this._subscriptions, this);
    }

    unsubscribeAndCleanup(): void {
        this.unsubscribe();
        this._subscriptions.clear();
        this._destructor && this._destructor();
        this._destructor = null;
        this._state = State.CLEAN;
    }

    missedRun(): boolean {
        return revisionsChanged(this._subscriptions);
    }

    destroy(): void {
        this.unsubscribeAndCleanup();
        this._state = State.DESTROYED;
    }

    run(): void {
        this.unsubscribeAndCleanup();

        utx(this._runnerFn, this);
    }

    updateRevisions(): void {
        this._subscriptions.forEach((revision, subscription) => {
            this._subscriptions.set(subscription, subscription._getRevision());
        });
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
