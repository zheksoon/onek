import { shallowEquals } from "./utils";

const enum State {
    NOT_INITIALIZED = 0,
    CLEAN = 1,
    MAYBE_DIRTY = 2,
    DIRTY = 3,
    COMPUTING = 4,
    DESTROYED = 5,
}

export type CheckFn<T> = (prev: T, next: T) => boolean;
export type UpdaterFn<T> = (prevValue: T) => T;

export interface Getter<T> {
    (subscriber?: Subscriber): T;
}

export interface Setter<T> {
    (value: T | UpdaterFn<T>, asIs?: boolean): void;
}

export interface ObservableGetter<T> extends Getter<T> {
    $$observable: Observable<T>;
}

export interface ComputedGetter<T> extends Getter<T> {
    destroy(): void;
    $$computed: Computed<T>;
}

type ReactionDestructor = () => void;
type ReactionFnReturnValue = ReactionDestructor | null | undefined | void;
type ReactionFn = () => ReactionFnReturnValue;

export type ReactionReturnValue = ReactionDestructor & { run: () => void };

type Subscriber = Computed | Reaction;
type Subscription = Observable | Computed;

export type Options = {
    reactionRunner?: (runner: () => void) => void;
    reactionExceptionHandler?: (exception: Error) => void;
    cacheOnUntrackedRead?: boolean;
};

let txDepth = 0;
let subscriber: Subscriber | null = null;
const subscriberChecks: Array<Computed> = [];
const stateActualizationQueue: Array<Computed> = [];
let reactionsScheduled = false;
let reactionsQueue: Array<Reaction> = [];
let reactionsRunner = (runner: () => void) => {
    Promise.resolve().then(runner);
};
let reactionExceptionHandler = (exception: Error) => {
    console.error("Reaction exception:", exception);
};
let cacheOnUntrackedRead = true;

function configure(options: Options) {
    if (options.reactionRunner !== undefined) {
        reactionsRunner = options.reactionRunner;
    }
    if (options.reactionExceptionHandler !== undefined) {
        reactionExceptionHandler = options.reactionExceptionHandler;
    }
    if (options.cacheOnUntrackedRead !== undefined) {
        cacheOnUntrackedRead = options.cacheOnUntrackedRead;
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
    const shouldRunReactions = reactionsQueue.length || stateActualizationQueue.length;
    if (!reactionsScheduled && shouldRunReactions) {
        reactionsScheduled = true;
        reactionsRunner(runReactions);
    }
}

function runReactions(): void {
    try {
        let i = 100;
        while (reactionsQueue.length || stateActualizationQueue.length) {
            for (let comp; (comp = stateActualizationQueue.pop()); ) {
                comp._actualizeAndRecompute();
            }

            while (reactionsQueue.length && --i) {
                const reactions = reactionsQueue;
                reactionsQueue = [];
                reactions.forEach((r) => {
                    try {
                        r._runManager();
                    } catch (exception) {
                        reactionExceptionHandler(exception);
                    }
                });
            }
            if (!i) {
                throw new Error("Infinite reactions loop");
            }
        }

        for (let computed; (computed = subscriberChecks.pop()); ) {
            computed._checkSubscribers();
        }
    } finally {
        reactionsScheduled = false;
        reactionsQueue = [];
    }
}

class Observable<T = any> {
    public declare _value: T;
    public declare _subscribers: Set<Subscriber>;
    public declare _checkFn?: CheckFn<T>;

    constructor(value: T, checkFn?: boolean | CheckFn<T>) {
        this._value = value;
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

    _notifyChanged(): void {
        this._subscribers.forEach((subs) => subs._notify(State.DIRTY, this));
        !txDepth && endTx();
    }

    _getValue(_subscriber = subscriber): T {
        if (_subscriber) {
            _subscriber._addSubscription(this);
        }
        return this._value;
    }

    _setValue(newValue: T | UpdaterFn<T>, asIs?: boolean): void {
        if (subscriber && subscriber instanceof Computed) {
            throw new Error("Changing observable inside of computed");
        }
        if (arguments.length > 0) {
            if (typeof newValue === "function" && !asIs) {
                newValue = (newValue as UpdaterFn<T>)(this._value);
            }
            if (this._checkFn && this._checkFn(this._value, newValue as T)) {
                return;
            }
            this._value = newValue as T;
        }
        this._notifyChanged();
    }
}

function observable<T>(value: T, checkFn?: boolean | CheckFn<T>) {
    const obs = new Observable(value, checkFn);
    const get = obs._getValue.bind(obs) as ObservableGetter<T>;
    const set = obs._setValue.bind(obs) as Setter<T>;

    get.$$observable = obs;

    return [get, set] as const;
}

type ComputedState =
    | State.NOT_INITIALIZED
    | State.CLEAN
    | State.MAYBE_DIRTY
    | State.DIRTY
    | State.COMPUTING;

class Computed<T = any> {
    public declare _value?: T;
    public declare readonly _subscribers: Set<Subscriber>;
    public declare readonly _checkFn?: CheckFn<T>;
    public declare readonly _fn: () => T;
    public declare _subscriptions: Array<Subscription>;
    public declare _subscriptionsToActualize: Array<Computed>;
    public declare _state: ComputedState;

    constructor(fn: () => T, checkFn?: boolean | CheckFn<T>) {
        this._fn = fn;
        this._value = undefined;
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

        this._state = state as ComputedState;

        if (state === State.MAYBE_DIRTY) {
            this._subscriptionsToActualize.push(subscription as Computed);
        } else {
            this._removeSubscriptions();
        }
    }

    _actualizeAndRecompute(): void {
        if (this._state === State.MAYBE_DIRTY) {
            this._subscriptionsToActualize.forEach((subs) => {
                subs._actualizeAndRecompute();
            });
            this._subscriptionsToActualize = [];

            if (this._state === State.MAYBE_DIRTY) {
                this._state = State.CLEAN;
            }
        }

        if (this._state !== State.CLEAN) {
            const oldSubscriber = subscriber;
            const shouldCheck = this._state !== State.NOT_INITIALIZED;
            const shouldCache =
                this._subscribers.size > 0 || cacheOnUntrackedRead || !!oldSubscriber;
            subscriber = shouldCache ? this : null;
            this._state = State.COMPUTING;
            try {
                const newValue = this._fn();
                this._state = shouldCache ? State.CLEAN : State.NOT_INITIALIZED;

                if (shouldCheck && this._checkFn) {
                    if (this._checkFn(this._value!, newValue)) {
                        return;
                    }
                    this._notifySubscribers(State.DIRTY);
                }
                this._value = newValue;
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

    _getValue(_subscriber = subscriber): T {
        if (this._state === State.COMPUTING) {
            throw new Error("recursive computed call");
        }

        const oldSubscriber = subscriber;
        try {
            subscriber = _subscriber;
            this._actualizeAndRecompute();

            if (subscriber) {
                subscriber._addSubscription(this);
            }
        } finally {
            subscriber = oldSubscriber;
        }

        return this._value!;
    }
}

function computed<T>(fn: () => T, checkFn?: boolean | CheckFn<T>): ComputedGetter<T> {
    const comp = new Computed(fn, checkFn);
    const get = comp._getValue.bind(comp);

    get.$$computed = comp;
    get.destroy = comp._destroy.bind(comp);

    return get;
}

type ReactionState = State.CLEAN | State.DIRTY | State.DESTROYED;

class Reaction {
    public declare readonly _fn: ReactionFn;
    public declare readonly _manager?: () => void;
    public declare _subscriptions: Array<Subscription>;
    public declare _destructor: ReactionFnReturnValue;
    public declare _state: ReactionState;

    constructor(fn: ReactionFn, manager?: () => void) {
        this._fn = fn;
        this._manager = manager;
        this._subscriptions = [];
        this._destructor = null;
        this._state = State.CLEAN;
    }

    _addSubscription(subscription: Subscription): void {
        if (subscription._addSubscriber(this)) {
            this._subscriptions.push(subscription);
        }
    }

    _notify(state: State, subscription: Subscription): void {
        if (state === State.MAYBE_DIRTY) {
            stateActualizationQueue.push(subscription as Computed);
        } else if (this._state === State.CLEAN) {
            this._state = State.DIRTY;
            reactionsQueue.push(this);
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

        const oldSubscriber = subscriber;
        subscriber = this;
        ++txDepth;
        try {
            this._destructor = this._fn();
        } finally {
            subscriber = oldSubscriber;
            if (!--txDepth) endTx();
        }
    }
}

function reaction(fn: ReactionFn, manager?: () => void): ReactionReturnValue {
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
