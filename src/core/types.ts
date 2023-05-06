import { State } from "./constants";

export type IdentityFn<T> = T extends (...args: infer Args) => infer R
    ? (...args: Args) => R
    : never;

export type Subscriber = IComputedImpl | IReactionImpl;
export type Subscription = IObservableImpl | IComputedImpl;

export interface IRevision {}

export interface SubscriberBase {
    addSubscription(subscription: Subscription): void;
}

export type MaybeSubscriber = SubscriberBase | null;

export interface IGettable<T> {
    get(_subscriber?: Subscriber): T;

    revision(): IRevision;
}

export interface IObservable<T> extends IGettable<T> {
    set(newValue?: T | UpdaterFn<T>, asIs?: boolean): void;
}

export interface IObservableImpl<T = any> extends IObservable<T> {
    _addSubscriber(subscriber: Subscriber): void;

    _removeSubscriber(subscriber: Subscriber): void;
}

export interface IComputed<T> extends IGettable<T> {
    destroy(): void;
}

export interface IComputedImpl<T = any> extends IComputed<T>, SubscriberBase {
    _addSubscriber(subscriber: Subscriber): void;

    _removeSubscriber(subscriber: Subscriber): void;

    _checkSubscribersAndPassivate(): void;

    _notify(state: State, subscription: Subscription): void;

    _actualizeAndRecompute(willHaveSubscriber?: boolean): void;
}

export type Destructor = (() => void) | null | undefined | void;
export type ReactionFn = () => Destructor;
export type Disposer = (() => void) & { run: () => void };

export interface IReaction {
    new (fn: ReactionFn, manager?: () => void): IReaction;

    destroy(): void;

    run(): void;
}

export interface IReactionImpl extends SubscriberBase {
    _notify(state: State, subscription: Subscription): void;

    _subscribe(): void;

    _unsubscribe(): void;

    _runManager(): void;
}

export type CheckFn<T> = (prev: T, next: T) => boolean;
export type UpdaterFn<T> = (prevValue: T) => T;

export interface IGetter<T> {
    (subscriber?: Subscriber): T;
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
