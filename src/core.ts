import { shallowEquals, shallowEqualsArrays } from "./utils";

const enum State {
    NOT_INITIALIZED = 0,
    CLEAN = 1,
    MAYBE_DIRTY = 2,
    DIRTY = 3,
    COMPUTING = 4,
}

export type CheckFn<T> = (prev: T, next: T) => boolean;
export type UpdaterFn<T> = (prevValue: T) => T;
export type Revision<T> = { value: T };

export interface ValueGetter<T> {
    (subscriber?: Subscriber): T;
    revision(): Revision<T>;
}

export interface ObservableGetter<T> extends ValueGetter<T> {
    $$observable: Observable<T>;
}

export interface ObservableSetter<T> {
    (value: T | UpdaterFn<T>, asIs?: boolean): void;
}

export interface ComputedGetter<T> extends ValueGetter<T> {
    destroy(): void;
    $$computed: Computed<T>;
}

export type ReactionDestructorFn = void | undefined | (() => void);
export type ReactionFn = () => ReactionDestructorFn;

type Subscriber = Computed | Reaction;
type Subscription = Observable | Computed;

export type Options = {
    reactionsRunner?: (runner: () => void) => void;
    cacheOnUntrackedRead?: boolean;
    onTxEnd?: () => void;
};

let txDepth = 0;
let subscriber: Subscriber | null = null;
let subscriberChecks: Array<Computed> = [];
let stateActualizationQueue: Array<Computed> = [];
let reactionsScheduled = false;
let reactionsQueue: Array<Reaction> = [];
let reactionsRunner = (runner: () => void) => {
    Promise.resolve().then(runner);
};
let cacheOnUntrackedRead = true;
let onTxEnd: null | (() => void) = null;

function configure(options) {
    if (options.reactionRunner !== undefined) {
        reactionsRunner = options.reactionRunner;
    }
    if (options.cacheOnUntrackedRead !== undefined) {
        cacheOnUntrackedRead = options.cacheOnUntrackedRead;
    }
    if (options.onTxEnd !== undefined) {
        onTxEnd = options.onTxEnd;
    }
}

function tx(fn: () => void): void {
    ++txDepth;
    try {
        fn();
    } finally {
        if (!--txDepth) endTx();
    }
}

function utx<T>(fn: () => T): T {
    const oldSubscriber = subscriber;
    subscriber = null;
    ++txDepth;
    try {
        return fn();
    } finally {
        subscriber = oldSubscriber;
        if (!--txDepth) endTx();
    }
}

function untracked<Args extends any[], T>(fn: (...args: Args) => T): (...args: Args) => T {
    return function () {
        const oldSubscriber = subscriber;
        subscriber = null;
        try {
            return fn.apply(this, arguments);
        } finally {
            subscriber = oldSubscriber;
        }
    };
}

function action<Args extends any[], T>(fn: (...args: Args) => T): (...args: Args) => T {
    return function () {
        const oldSubscriber = subscriber;
        subscriber = null;
        ++txDepth;
        try {
            return fn.apply(this, arguments);
        } finally {
            subscriber = oldSubscriber;
            if (!--txDepth) endTx();
        }
    };
}

function endTx(): void {
    const shouldRunReactions = reactionsQueue.length || stateActualizationQueue.length || onTxEnd;
    if (!reactionsScheduled && shouldRunReactions) {
        reactionsScheduled = true;
        reactionsRunner(runReactions);
    }
}

function runReactions(): void {
    try {
        onTxEnd && onTxEnd();

        let i = 100;
        while (reactionsQueue.length || stateActualizationQueue.length) {
            let comp;
            while ((comp = stateActualizationQueue.pop())) {
                comp._actualizeAndRecompute();
            }

            while (reactionsQueue.length && --i) {
                const reactions = reactionsQueue;
                reactionsQueue = [];
                reactions.forEach((r) => r._runManager());
            }
            if (!i) {
                throw new Error("infinite reactions loop");
            }
        }

        let computed;
        while ((computed = subscriberChecks.pop())) {
            computed._checkSubscribers();
        }
    } finally {
        reactionsScheduled = false;
        reactionsQueue = [];
    }
}

class Observable<T = any> {
    public declare _value: T;
    public declare _revision: Revision<T>;
    public declare _subscribers: Set<Subscriber>;
    public declare _checkFn?: CheckFn<T>;

    constructor(value: T, checkFn?: boolean | CheckFn<T>) {
        this._value = value;
        this._revision = { value };
        this._subscribers = new Set();
        this._checkFn = checkFn
            ? typeof checkFn === "function"
                ? untracked(checkFn)
                : shallowEquals
            : undefined;
    }

    _addSubscriber(subscriber: Subscriber): boolean {
        if (!this._subscribers.has(subscriber)) {
            this._subscribers.add(subscriber);
            return true;
        }
        return false;
    }

    _removeSubscriber(subscriber: Subscriber): void {
        this._subscribers.delete(subscriber);
    }

    _notify(): void {
        this._subscribers.forEach((subs) => subs._notify(State.DIRTY, this));
        !txDepth && endTx();
    }

    _getRevision(): Revision<T> {
        return this._revision;
    }

    _getValue(_subscriber = subscriber): T {
        if (_subscriber) {
            _subscriber._addSubscription(this);
        }
        return this._value;
    }

    _setValue(newValue: T | UpdaterFn<T>, asIs?: boolean): void {
        if (subscriber && subscriber instanceof Computed) {
            throw new Error("changing observable inside of computed");
        }
        if (arguments.length > 0) {
            if (typeof newValue === "function" && !asIs) {
                newValue = (newValue as UpdaterFn<T>)(this._value);
            }
            if (this._checkFn && this._checkFn(this._value, newValue as T)) {
                return;
            }
            this._value = newValue as T;
            this._revision = { value: newValue as T };
        }
        this._notify();
    }
}

function observable<T>(value: T, checkFn?: boolean | CheckFn<T>) {
    const obs = new Observable(value, checkFn);
    const get = obs._getValue.bind(obs) as ObservableGetter<T>;
    const set = obs._setValue.bind(obs) as ObservableSetter<T>;

    get.revision = obs._getRevision.bind(obs);
    get.$$observable = obs;

    return [get, set] as const;
}

class Computed<T = any> {
    public declare _fn: () => T;
    public declare _value?: T;
    public declare _revision?: Revision<T>;
    public declare _subscribers: Set<Subscriber>;
    public declare _subscriptions: Array<Subscription>;
    public declare _subscriptionsToActualize: Array<Computed>;
    public declare _state: State;
    public declare _checkFn?: CheckFn<T>;

    constructor(fn: () => T, checkFn?: boolean | CheckFn<T>) {
        this._fn = fn;
        this._value = undefined;
        this._revision = undefined;
        this._subscribers = new Set();
        this._subscriptions = [];
        this._subscriptionsToActualize = [];
        this._state = State.NOT_INITIALIZED;
        this._checkFn = checkFn
            ? typeof checkFn === "function"
                ? untracked(checkFn)
                : shallowEquals
            : undefined;
    }

    _addSubscription(subscription: Subscription): void {
        if (subscription._addSubscriber(this)) {
            this._subscriptions.push(subscription);
        }
    }

    _removeSubscriptions(): void {
        this._subscriptions.forEach((subs) => {
            subs._removeSubscriber(this);
        });
        this._subscriptions = [];
        this._subscriptionsToActualize = [];
    }

    _addSubscriber(subscriber: Subscriber): boolean {
        if (this._state !== State.CLEAN) {
            this._actualizeAndRecompute();
        }
        if (!this._subscribers.has(subscriber)) {
            this._subscribers.add(subscriber);
            return true;
        }
        return false;
    }

    _removeSubscriber(subscriber: Subscriber): void {
        this._subscribers.delete(subscriber);
        if (!this._subscribers.size) {
            subscriberChecks.push(this);
        }
    }

    _notifySubscribers(state: State): void {
        this._subscribers.forEach((subs) => {
            subs._notify(state, this);
        });
    }

    _checkSubscribers(): void {
        if (!this._subscribers.size && this._state !== State.NOT_INITIALIZED) {
            this._destroy();
        }
    }

    _notify(state: State, subscription: Subscription) {
        if (this._state >= state) return;

        if (this._checkFn) {
            if (this._state === State.CLEAN) this._notifySubscribers(State.MAYBE_DIRTY);
        } else {
            this._notifySubscribers(state);
        }

        this._state = state;

        if (state === State.MAYBE_DIRTY) {
            this._subscriptionsToActualize.push(subscription as Computed);
        } else {
            this._removeSubscriptions();
        }
    }

    _actualizeAndRecompute(): void {
        if (this._state === State.MAYBE_DIRTY) {
            this._state = State.CLEAN;
            this._subscriptionsToActualize.forEach((subs) => {
                subs._actualizeAndRecompute();
            });
            this._subscriptionsToActualize = [];
        }

        if (this._state !== State.CLEAN) {
            const oldSubscriber = subscriber;
            const shouldCheck = this._state !== State.NOT_INITIALIZED;
            const shouldCache = cacheOnUntrackedRead || oldSubscriber;
            subscriber = shouldCache ? this : null;
            this._state = State.COMPUTING;
            try {
                const newValue = this._fn();
                this._state = shouldCache ? State.CLEAN : State.NOT_INITIALIZED;

                if (shouldCheck && this._checkFn) {
                    if (!this._checkFn(this._value!, newValue)) {
                        this._value = newValue;
                        this._revision = { value: newValue };
                        this._notifySubscribers(State.DIRTY);
                    }
                } else {
                    this._value = newValue;
                    this._revision = { value: newValue };
                }
            } catch (e) {
                this._destroy();
                throw e;
            } finally {
                subscriber = oldSubscriber;
            }
        }
    }

    _destroy(): void {
        this._state = State.NOT_INITIALIZED;
        this._value = undefined;
        this._removeSubscriptions();
    }

    _getRevision(): Revision<T> {
        this._actualizeAndRecompute();
        return this._revision!;
    }

    _getValue(_subscriber = subscriber): T {
        if (this._state === State.COMPUTING) {
            throw new Error("recursive computed call");
        }

        this._actualizeAndRecompute();

        if (_subscriber) {
            _subscriber._addSubscription(this);
        }

        return this._value!;
    }
}

function computed<T>(fn: () => T, checkFn?: boolean | CheckFn<T>): ComputedGetter<T> {
    const comp = new Computed(fn, checkFn);
    const get = comp._getValue.bind(comp);

    get.$$computed = comp;
    get.revision = comp._getRevision.bind(comp);
    get.destroy = comp._destroy.bind(comp);

    return get;
}

class Reaction {
    public declare _fn: ReactionFn;
    public declare _manager?: () => void;
    public declare _subscriptions: Array<Subscription>;
    public declare _revisions: Revision<any>[];
    public declare _destructor: ReactionDestructorFn;
    public declare _isDestroyed: boolean;
    public declare _shouldSubscribe: boolean;

    constructor(fn: ReactionFn, manager?: () => void) {
        this._fn = fn;
        this._manager = manager;
        this._subscriptions = [];
        this._revisions = [];
        this._destructor = undefined;
        this._isDestroyed = false;
        this._shouldSubscribe = true;
    }

    _addSubscription(subscription: Subscription): void {
        if (!this._shouldSubscribe) {
            this._subscriptions.push(subscription);
            this._revisions.push(subscription._getRevision());
        } else if (subscription._addSubscriber(this)) {
            this._subscriptions.push(subscription);
        }
    }

    _notify(state: State, subscription: Subscription): void {
        if (state === State.MAYBE_DIRTY) {
            stateActualizationQueue.push(subscription as Computed);
        } else {
            this._unsubscribeAndRemove();
            reactionsQueue.push(this);
        }
    }

    _subscribe(): void {
        this._subscriptions.forEach((subs) => {
            subs._addSubscriber(this);
        });
        this._revisions = [];
    }

    _unsubscribe(): void {
        this._subscriptions.forEach((subs) => {
            subs._removeSubscriber(this);
        });
        this._revisions = this._getRevisions();
    }

    _getRevisions(): Revision<any>[] {
        return this._subscriptions.map((subs) => subs._getRevision());
    }

    _unsubscribeAndRemove(): void {
        this._subscriptions.forEach((subs) => {
            subs._removeSubscriber(this);
        });
        this._destructor && this._destructor();
        this._destructor = undefined;
        this._subscriptions = [];
        this._revisions.length && (this._revisions = []);
    }

    _runManager(): void {
        if (!this._isDestroyed) {
            if (this._manager) {
                this._manager();
            } else {
                this._run();
            }
        }
    }

    _revisionsChanged(): boolean {
        if (this._revisions.length || this._subscriptions.length) {
            const newRevisions = this._getRevisions();
            if (!shallowEqualsArrays(this._revisions, newRevisions)) {
                this._revisions = newRevisions;
                return true;
            }
        }
        return false;
    }

    _destroy(): void {
        this._unsubscribeAndRemove();
        this._isDestroyed = true;
    }

    _run(): void {
        this._unsubscribeAndRemove();

        const oldSubscriber = subscriber;
        subscriber = this;
        ++txDepth;
        try {
            this._isDestroyed = false;
            this._destructor = this._fn();
        } finally {
            subscriber = oldSubscriber;
            if (!--txDepth) endTx();
        }
    }
}

function reaction(fn: ReactionFn, manager?: () => void): () => void {
    const r = new Reaction(fn, manager);
    const destructor = r._destroy.bind(r);
    destructor.run = r._run.bind(r);

    r._run();

    return destructor;
}

export {
    Observable,
    observable,
    Computed,
    computed,
    Reaction,
    reaction,
    tx,
    utx,
    untracked,
    action,
    configure,
};
