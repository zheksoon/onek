Minimal reactive system

* All relevant tests from reactive library tests pass
* You don't understand it - it does't exist for you
* Clean, minimalistic, intuitive, object oriented
* Prefer clean data structures to obscure complex optimizations
* Shold read as a poem, with meaning in every word

In the modern world, software complexity can be astounishing. React was many thousands lines of code and has become complex enough you can write a PhD thesis on it. Reactivity (observables, signals) has become very popular as a tool to achieve better performance for web apps - with frameworks like Svelte, preact (with preact-signals), or by using MobX or Zustand in your favourite React world. But if you try to understand the implmentation of, say, preact Signals or MobX, you will immediately hit the wall of complexity, edge cases handling, legacy (less actual for Preact Signals), and microoptimizations. My goal was to show you how you can achieve the same level of correctness (or even better) while being extremely simple and organized. Each line of code should have a purpose. We intentionally will drop all micro optimizations that don't change the real algorithmical complexity, focusing instead on clean code (hi uncle Bob), minimalistic data structures, and crystal clear logic with no place for bugs.

# Properties of a good reactive system

There are few main properties each good FRP (functional reactive programming) system shold have. These are:
- Caching. No change - no recomputation
- Consistency - you shold be able to read any part of your reactive graph and immediately get actual, not stale, results
- Transactionality - all side effects (reactions) should be batched within transaction boundaries, and be executed on transaction end. Following the consistency property, you still shold be able to read any value mid-transaction and get the actual fresh result
- ???

Let's start with the primitives and interfaces we want for our reactive system.

# Interfaces

Let's introduce a concept of "subscriber" and "subscription". In different libraries and frameworks this can be named in different ways (like dependant/dependency, produces/consumer), but the relationship is basically the same. 
*Subscription* is something you can subscribe to (and unsubscribe as well):
```typescript
interface ISubscription {
    subscribe(subscriber: ISubscriber): void;
    unsubscribe(subscriber: ISubscriber): void;
}
```

*Subscriber* is something that can subscribe to some subscription:
```typescript
interface ISubscriber {
    subscribeTo(subscription: ISubscription): void;
}
```


Observable values are subscriptions in the first place - we can ask it to notify us when its value is changed. Computed values are both - they subscribe to observables or the other computeds, and also can be subscribed to them. Reactions (or effects) are *subscribers*.

# Revisions

Let's introduce revision concept early - this will help us explaining some parts in the future. *Revision* is a simple immutable object (or number) that denotes the *version* of the observable or computed state. The following should be true for every revision you meet in the system: same value between two adjacent states - same revision, different values - strictly different revisions. Note that the same value in not adjacent states can have different revisions: say, you set observable `name` to `Eugene` (revision 1), then to `Lena` (revision 2), then back to `Eugene` (revision 3). Setting it two times to the same value should not change the revision. For simplicity we will be using numbers are revisions, but this can be any JS object (even empty `{}`) as long as we can do strict comparison.

# WeakRefs

Arrays, `Map`, and `Set` store *strong references* to all values - this means the object we refer to will never go away by garbage collector. If we use any of these data structures to store the subscribers of our observable or computed, this subscriber will wait for a signal forever - even if the real code already has no references to it. `WeakRef` comes to the rescue - if we store the *weak reference* (i.e. the `WeakRef` object), this won't prevent the garbage collector from removing the subscriber. This is perfect - we could drop a significant piece of logic for dead computed values (i.e. computed values that has no subscribers). But even if the dead computed value gets garbage collected, the `WeakRef` instances that point to already unreachable object will still exist. If the dead computed was subscibed to 100 observables, there will be 100 slots in subscribers `Set` that have no chances of being removed (as the colected computed will never ask for it). Or, they still have the change!

# FinalizationRegistry

JS `FinalizationRegistry` is a helpful cousin of `WeakRef` - when an object gets unreachable and garbage collected, we can execute some kind of *finalization funct
ion* - it can accept any *token* object (but never the garbage-collected object itself), do something for us. The only thing we want is to remove the `WeakRef` instances from all subscribers `Set` for all the subscriptions of the dead computed. As a code this looks very simple: we need the list of subscriptions, and the `WeakRef` instance of the token:

```typescript
type FinalizationToken = {
    subscriptions: Map<ISubscriber, number>, // Native map with all subscriptions
    ref: WeakRef<any>,
}

const registry = new FinalizationRegistry((token: FinalizationToken) => {
    for (const subscription of token.subscriptions) {
        subscription.unsubscribe(token.ref);
    }
})

function register(subscriber: ISubscriber) {
    registry.add({
        subscriptions: subscriber.subscriptions,
        ref: subscriber.ref,
    })
}
```

Ah, really forgot about this - the `ISubscription` interface should take `WeakRef` to subcriber instead of plain instance.

# Basic classes

Now we can define very base classes we will use:

```typescript
// The type defines a comparator function that can be used to determine
// if we should update revision of Observable and Computed
type EqualityCheck<T> = (prev: T, next: T) => boolean;

class Observable<T> implements ISubscription {
    private value: T;
    private subscriptions: Set<ISubscriber>;
    private equalityCheck: EqualityCheck<T>;
    private revision: number;

    constructor(initialValue: T, equalityCheck: EqualityCheck<T>) {
        this.value = initialValue;
        this.subscriptions = new Set();
        this.equalityCheck = equalityCheck;
        this.revision = getNewRevision();
    }

    get(): T {
        // Someone gets our value - we should subscribe it to us
        return this.value;
    }

    set(newValue: T) {
        if (!this.equalityCheck(this.value, newValue)) {
            this.value = newValue;
            this.revision = getNewRevision();
            // Someone sets a new value - notify subscribers about that
            
    }

    // Implementation of the ISubscription interface
    subscribe(subscriber: ISubscriber) {
        this.subscribers.add(subscriber);
    }

    unsubscribe(subscriber: ISubscriber) {
        this.subscribers.delete(subscriber);
    }
}

class Computed<T> implements ISubscription, ISubscriber {
    constructor(fn: () => T)
}