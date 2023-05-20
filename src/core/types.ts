import { State } from "./constants";

export type NotifyState = State.MAYBE_DIRTY | State.DIRTY;

export type IdentityFn<T> = T extends (...args: infer Args) => infer R
    ? (...args: Args) => R
    : never;

export interface ISubscriber {
    _notify(state: NotifyState): void;

    addSubscription(subscription: ISubscription): void;
}

export interface ISubscription {
    revision(): IRevision;

    _addSubscriber(subscriber: ISubscriber): void;

    _removeSubscriber(subscriber: ISubscriber): void;

    _actualize(willHaveSubscriber: boolean): void;
}

export interface IRevision {}

export type MaybeSubscriber = ISubscriber | null;

export interface IGettable<T> {
    get(_subscriber?: ISubscriber): T;

    revision(): IRevision;
}

export interface IObservable<T> extends IGettable<T> {
    set(newValue?: T | UpdaterFn<T>, asIs?: boolean): void;

    notify(): void;
}

export interface IObservableImpl<T> extends IObservable<T>, ISubscription {}

export interface IComputed<T> extends IGettable<T> {
    destroy(): void;
}

export interface IComputedImpl<T> extends IComputed<T>, ISubscriber, ISubscription {
    _checkAndPassivate(): void;
}

export type Destructor = (() => void) | null | undefined | void;
export type ReactionFn = () => Destructor;
export type Disposer = (() => void) & { run: () => void };

export interface IReaction {
    destroy(): void;

    run(): void;

    runManager(): void;

    subscribe(): void;

    unsubscribe(): void;

    unsubscribeAndCleanup(): void;

    updateRevisions(): void;
}

export interface IReactionImpl extends IReaction, ISubscriber {}

export type CheckFn<T> = (prev: T, next: T) => boolean;
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
