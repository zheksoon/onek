export type IdentityFn<T> = T extends (...args: infer Args) => infer R
    ? (...args: Args) => R
    : never;

export interface ISubscriber {
    readonly _weakRef: WeakRef<ISubscriber>;
    readonly _subscriptions: Map<ISubscription, IRevision>;

    _notify(): void;
}

export interface ISubscription {
    _getRevision(): IRevision;

    _subscribers: Set<WeakRef<ISubscriber>>;
}

export type IRevision = number;

export type MaybeSubscriber = ISubscriber | null;

export interface IGettable<T> {
    get(): T;

    _getRevision(): IRevision;
}

export interface IObservable<T> extends IGettable<T> {
    set(newValue?: T | UpdaterFn<T>, asIs?: boolean): void;

    notify(): void;
}

export interface IObservableImpl<T> extends IObservable<T>, ISubscription { }

export interface IComputed<T> extends IGettable<T> {
    destroy(): void;
}

export interface IComputedImpl<T> extends IComputed<T>, ISubscriber, ISubscription { }

export type Destructor = (() => void) | null | undefined | void;
export type ReactionFn = () => Destructor;
export type Disposer = (() => void) & { run: () => void };

export interface IReaction {
    destroy(): void;

    run(): void;

    runManager(): void;

    unsubscribeAndCleanup(): void;
}

export interface IReactionImpl extends IReaction, ISubscriber { }

export type Equals<T> = (prev: T, next: T) => boolean;
export type UpdaterFn<T> = (prevValue: T) => T;

export interface IGetter<T> {
    (subscriber?: ISubscriber): T;

    revision(): IRevision;
}

export interface ISetter<T> {
    (value?: T | UpdaterFn<T>, asIs?: boolean): void;
}

export interface IObservableGetter<T> extends IGetter<T> {
    instance: IObservable<T>;
}

export interface IComputedGetter<T> extends IGetter<T> {
    instance: IComputed<T>;

    destroy(): void;
}

export type IOptions = {
    reactionScheduler?: (runner: () => void) => void;
    reactionExceptionHandler?: (exception: Error) => void;
};
