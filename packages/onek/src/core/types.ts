import { State } from "./constants";

export type Subscriber = ComputedImpl | ReactionImpl;
export type Subscription = ObservableImpl | ComputedImpl;
export type Revision = {};

export declare class ObservableImpl<T = any> {
    constructor(value: T, checkFn?: boolean | CheckFn<T>);

    _addSubscriber(subscriber: Subscriber): boolean;

    _removeSubscriber(subscriber: Subscriber): void;

    _getRevision(): Revision;

    _getValue(_subscriber?: Subscriber): T;

    _setValue(newValue?: T | UpdaterFn<T>, asIs?: boolean): void;
}

export declare class ComputedImpl<T = any> {
    constructor(fn: () => T, checkFn?: boolean | CheckFn<T>);

    _addSubscription(subscription: Subscription): void;

    _addSubscriber(subscriber: Subscriber): boolean;

    _removeSubscriber(subscriber: Subscriber): void;

    _checkSubscribers(): void;

    _notify(state: State, subscription: Subscription): void;

    _actualizeAndRecompute(): void;

    _destroy(): void;

    _getRevision(): Revision;

    _getValue(_subscriber?: Subscriber): T;
}

export type Destructor = (() => void) | null | undefined | void;
export type ReactionFn = () => Destructor;
export type Disposer = (() => void) & { run: () => void };

export declare class ReactionImpl {
    constructor(fn: ReactionFn, manager?: () => void);

    _addSubscription(subscription: Subscription): void;

    _notify(state: State, subscription: Subscription): void;

    _subscribe(): void;

    _unsubscribe(): void;

    _runManager(): void;

    _destroy(): void;

    _run(): void;
}

export type CheckFn<T> = (prev: T, next: T) => boolean;
export type UpdaterFn<T> = (prevValue: T) => T;

export interface Getter<T> {
    (subscriber?: Subscriber): T;
}

export interface Setter<T> {
    (value?: T | UpdaterFn<T>, asIs?: boolean): void;
}

export interface ObservableGetter<T> extends Getter<T> {
    $$observable: ObservableImpl<T>;
}

export interface ComputedGetter<T> extends Getter<T> {
    $$computed: ComputedImpl<T>;

    destroy(): void;
}

export type Options = {
    reactionScheduler?: (runner: () => void) => void;
    reactionExceptionHandler?: (exception: Error) => void;
};
