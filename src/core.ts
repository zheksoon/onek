const enum States {
    NOT_INITIALIZED = 0,
    CLEAN = 1,
    MAYBE_DIRTY = 2,
    DIRTY = 3,
    COMPUTING = 4,
}

const apply = (fn) => fn();

let txDepth = 0;
let subscriber: Computed | Reaction | null = null;
let subscriberChecks: Array<Computed> = [];
let reactionsScheduled = false;
let reactionsQueue: Array<Reaction> = [];
let reactionsRunner = apply;
let stateActualizationQueue: Array<Computed> = [];
let cacheOnUntrackedRead = true;

function configure(options) {
    if (options.reactionRunner !== undefined) {
        reactionsRunner = options.reactionRunner;
    }
    if (options.cacheOnUntrackedRead !== undefined) {
        cacheOnUntrackedRead = options.cacheOnUntrackedRead;
    }
}

function tx(fn) {
    ++txDepth;
    try {
        fn();
    } finally {
        if (!--txDepth) endTx();
    }
}

function utx(fn) {
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

function action(fn) {
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

function endTx() {
    const shouldRunReactions =
        reactionsQueue.length || stateActualizationQueue.length;
    if (!reactionsScheduled && shouldRunReactions) {
        reactionsScheduled = true;
        reactionsRunner(runReactions);
    }
}

function runReactions() {
    try {
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

type CheckFn<T> = (prev: T, next: T) => boolean;

class Observable<T = any> {
    public declare _value: T;
    public declare _subscribers: Set<Computed | Reaction>;
    public declare _checkFn?: CheckFn<T>;

    constructor(value: T, checkFn?: CheckFn<T>) {
        this._value = value;
        this._subscribers = new Set();
        this._checkFn = checkFn && action(checkFn);
    }

    _addSubscriber(subscriber) {
        this._subscribers.add(subscriber);
    }

    _removeSubscriber(subscriber) {
        this._subscribers.delete(subscriber);
    }

    _notify() {
        this._subscribers.forEach((subs) => subs._notify(States.DIRTY, this));
        !txDepth && endTx();
    }

    _getValue(_subscriber = subscriber) {
        if (_subscriber) {
            _subscriber._addSubscription(this);
        }
        return this._value;
    }

    _setValue(newValue, asIs) {
        if (subscriber && subscriber instanceof Computed) {
            throw new Error("changing observable inside of computed");
        }
        if (arguments.length > 0) {
            if (typeof newValue === "function" && !asIs) {
                newValue = newValue(this._value);
            }
            if (this._checkFn && this._checkFn(this._value, newValue)) {
                return;
            }
            this._value = newValue;
        }
        this._notify();
    }
}

function observable(value, checkFn) {
    const obs = new Observable(value, checkFn);
    const get = obs._getValue.bind(obs);
    const set = obs._setValue.bind(obs);

    get.$$observable = obs;

    return [get, set];
}

class Computed<T = any> {
    public declare _fn: () => T;
    public declare _value?: T;
    public declare _subscribers: Set<Computed | Reaction>;
    public declare _subscriptions: Array<Observable | Computed>;
    public declare _subscriptionsToActualize: Array<Computed>;
    public declare _state: States;
    public declare _checkFn?: CheckFn<T>;

    constructor(fn: () => T, checkFn: CheckFn<T>) {
        this._fn = fn;
        this._value = undefined;
        this._subscribers = new Set();
        this._subscriptions = [];
        this._subscriptionsToActualize = [];
        this._state = States.NOT_INITIALIZED;
        this._checkFn = checkFn && action(checkFn);
    }

    _removeSubscriptions() {
        this._subscriptions.forEach((subs) => subs._removeSubscriber(this));
        this._subscriptions = [];
        this._subscriptionsToActualize = [];
    }

    _notifySubscribers(state) {
        this._subscribers.forEach((subs) => subs._notify(state, this));
    }

    _addSubscription(subscription) {
        if (!subscription._subscribers.has(this)) {
            subscription._subscribers.add(this);
            this._subscriptions.push(subscription);
        }
    }

    _addSubscriber(subscriber) {
        if (this._state !== States.CLEAN) {
            this._actualizeAndRecompute();
        }
        this._subscribers.add(subscriber);
    }

    _removeSubscriber(subscriber) {
        this._subscribers.delete(subscriber);
        if (!this._subscribers.size) {
            subscriberChecks.push(this);
        }
    }

    _checkSubscribers() {
        if (!this._subscribers.size && this._state !== States.NOT_INITIALIZED) {
            this._destroy();
        }
    }

    _notify(state, subscription) {
        if (this._state >= state) return;

        if (this._checkFn) {
            if (this._state === States.CLEAN)
                this._notifySubscribers(States.MAYBE_DIRTY);
        } else {
            this._notifySubscribers(state);
        }

        this._state = state;

        if (state === States.MAYBE_DIRTY) {
            this._subscriptionsToActualize.push(subscription);
        } else {
            this._removeSubscriptions();
        }
    }

    _actualizeAndRecompute() {
        if (this._state === States.MAYBE_DIRTY) {
            this._state = States.CLEAN;
            this._subscriptionsToActualize.forEach((subs) => {
                subs._actualizeAndRecompute();
            });
            this._subscriptionsToActualize = [];
        }

        if (this._state !== States.CLEAN) {
            const oldState = this._state;
            const oldValue = this._value;
            const oldSubscriber = subscriber;
            const shouldCache = cacheOnUntrackedRead || oldSubscriber;
            subscriber = shouldCache ? this : null;
            this._state = States.COMPUTING;
            try {
                this._value = this._fn();
                this._state = shouldCache
                    ? States.CLEAN
                    : States.NOT_INITIALIZED;
            } catch (e) {
                this._destroy();
                throw e;
            } finally {
                subscriber = oldSubscriber;
            }

            if (this._checkFn && oldState !== States.NOT_INITIALIZED) {
                if (this._checkFn(oldValue!, this._value!)) {
                    this._value = oldValue;
                } else {
                    this._notifySubscribers(States.DIRTY);
                }
            }
        }
    }

    _destroy() {
        this._state = States.NOT_INITIALIZED;
        this._value = undefined;
        this._removeSubscriptions();
    }

    _getValue(_subscriber = subscriber) {
        if (this._state === States.COMPUTING) {
            throw new Error("recursive computed call");
        }

        this._actualizeAndRecompute();

        if (_subscriber) {
            _subscriber._addSubscription(this);
        }

        return this._value;
    }
}

function computed(fn, checkFn) {
    const comp = new Computed(fn, checkFn);
    const get = comp._getValue.bind(comp);

    get.$$computed = comp;
    get.destroy = comp._destroy.bind(comp);

    return get;
}

type ReactionDestructorFn = void | undefined | (() => void);
type ReactionFn = () => ReactionDestructorFn;

class Reaction {
    public declare _fn: ReactionFn;
    public declare _manager?: () => void;
    public declare _subscriptions: Array<Observable | Computed>;
    public declare _destructor: ReactionDestructorFn;
    public declare _isDestroyed: boolean;
    public declare _shouldSubscribe: boolean;

    constructor(fn: ReactionFn, manager?: () => void) {
        this._fn = fn;
        this._manager = manager;
        this._subscriptions = [];
        this._destructor = undefined;
        this._isDestroyed = false;
        this._shouldSubscribe = true;
    }

    _subscribe() {
        this._subscriptions.forEach((subs) => subs._addSubscriber(this));
    }

    _unsubscribe() {
        this._subscriptions.forEach((subs) => subs._removeSubscriber(this));
    }

    _unsubscribeAndRemove() {
        this._unsubscribe();
        this._destructor && this._destructor();
        this._subscriptions = [];
    }

    _runManager() {
        if (!this._isDestroyed) {
            if (this._manager) {
                this._manager();
            } else {
                this._run();
            }
        }
    }

    _destroy() {
        this._unsubscribeAndRemove();
        this._isDestroyed = true;
    }

    _run() {
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

    _addSubscription(subscription) {
        if (!this._shouldSubscribe) {
            this._subscriptions.push(subscription);
            return;
        }

        if (!subscription._subscribers.has(this)) {
            subscription._subscribers.add(this);
            this._subscriptions.push(subscription);
        }
    }

    _notify(state, subscription) {
        if (state === States.MAYBE_DIRTY) {
            stateActualizationQueue.push(subscription);
        } else {
            this._unsubscribeAndRemove();
            reactionsQueue.push(this);
        }
    }
}

function reaction(fn, manager) {
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
    action,
    configure,
};
