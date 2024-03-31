<p align="center">
  <img align="center" src="https://github.com/zheksoon/onek/blob/main/assets/1K.svg?raw=true" width="150" alt="Onek" /> 
</p>

<p align="center">
  <b>Onek</b>
</p>

<p align="center">
⚡️ <b>1.7KB</b> full-featured state management inspired by MobX and Solid.js, <b>batteries included</b> ⚡️
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/onek" > 
    <img src="https://badgen.net/npm/v/onek?color=5fbfcd" alt="Onek version"/> 
  </a>
  <a href="https://bundlephobia.com/package/onek" > 
    <img src="https://badgen.net/badgesize/brotli/file-url/unpkg.com/onek/dist/onek.mjs?color=5fbfcd" alt="Onek brotli size"/> 
  </a>
  <a href="https://github.com/zheksoon/onek/blob/main/LICENSE" > 
    <img src="https://badgen.net/github/license/zheksoon/onek?color=5fbfcd" alt="Onek license"/> 
  </a>
  <a href="https://codecov.io/github/zheksoon/onek" > 
    <img src="https://codecov.io/github/zheksoon/onek/branch/main/graph/badge.svg?token=5ZQAEJ0A9H"/> 
  </a>
</p>

**Onek** (reads as **_one-kay_** or **_on-ek_**) is a simple but powerful state management library
for **React** based on a solid foundation of functional reactive data structures from **MobX** and
**Solid.js**. It provides everything needed for managing state in complex React applications,
all in a less than **2KB package**.

## Features

- 🚀 **Reactive Observable and Computed Values** - Inspired by MobX, Solid.js and Preact Signals
- 🎭 **Both MobX and Solid.js Flavors** - Feel free to choose and mix the styles that best fit your needs
- 🤔 **Not Opinionated** - Use global state, relational or object-oriented models - whatever you need to do your task
- 👁 **Transparency** - Everything is cached and up-to=date, no worries!
- 💧 **No Memory Leaks** - No subscription to observable - no leaks, it is
- 🧩 **Single Hook** - Just one to make your components reactive
- 🔀 **Concurrent React Features** - [out-of-the-box support](#react-concurrent-rendering) to blow the performance
- 🤓 **Built-in Shallow Equality** - optimizations, optimizations everywhere...
- 💾 **Compatibility** - Has ES6? No worries then!
- 💯 **100% Test Coverage** - Nothing is missed
- ⭐️ **Fully TypeScript** - No comments, as is
- ☯️ **Beauty Inside** - "Nothing to add, nothing to take away"
- 📦 ...and all in a less than **2KB package**

## Table of contents

- [Installation](#installation)
- [Introduction](#introduction)
  - [Show me the code!](#show-me-the-code)
  - [Observable values](#observable-values)
  - [Computed values](#computed-values)
  - [Using with React](#using-with-react)
  - [Actions and transactions](#actions-and-transactions)
  - [Reactions](#reactions)
  - [Making models](#making-models)
    - [Solid.js flavor](#solidjs-flavor)
    - [MobX flavor](#mobx-flavor)
- [Examples](#examples)
  - [Counter](#simple-counter)
  - [Counter list](#counter-list)
  - [Todo list](#todo-list)
- [Recipes](#recipes)
  - [Configuring reaction scheduler](#reaction-scheduler)
  - [Catching exceptions in reactions](#reaction-exception-handler)
  - [Memory leaks: why not?](#memory-leaks-why-not)
- [API Documentation](#api-documentation)

## Installation

```bash
yarn add onek

npm install --save onek
```

## Show me the code

Here's an example of a counter app that showcases all the main features of Onek with React:

```jsx
import { action, computed, observable } from "onek";
import { useObserver } from "onek/react";

// defined observable value
const [count, setCount] = observable(0);

// define computed values derived from the observable
const canIncrease = computed(() => count() < 10);

const canDecrease = computed(() => count() > 0);

// defined actions that manipulate observable values
const increase = action(() => {
  if (canIncrease()) {
    setCount((count) => count + 1);
  }
});

const decrease = action(() => {
  if (canDecrease()) {
    setCount((count) => count - 1);
  }
});

const Counter = () => {
  // get observer instance
  const observer = useObserver();

  // wrap your render code with the observer to make it reactive
  return observer(() => (
    <div>
      <p>Count: {count()}</p>
      <button disabled={!canDecrease()} onClick={decrease}>
        -
      </button>
      <button disabled={!canIncrease()} onClick={increase}>
        +
      </button>
    </div>
  ));
};

// two counters rendered in sync
root.render(
  <>
    <Counter />
    <Counter />
  </>
);
```

[See it on CodeSandbox](https://codesandbox.io/s/onek-counter-example-ynilr8?file=/src/App.tsx)

## Introduction

**Note:** in this section Solid.js flavor will be used. If you want examples of MobX flavor, check
out the [MobX flavor](#mobx-flavor) section.

### Observable values

If you're familiar with React's `useState` hook, you're already halfway to understanding Onek's `observable` function. Like the `useState` hook, it accepts an initial value and returns a tuple of value getter and setter. The difference is that the value getter is a **function** that returns the value instead of the value itself:

```js
import { observable } from "onek";

// create observable value
const [greeting, setGreeting] = observable("hello!");

// set value directly
setGreeting("hola!");

// set value with updater function
setGreeting((oldGreeting) => oldGreeting + "!!!");

greeting() === "hola!!!!";
```

Please note that while it's similar to React's `useState`, it shouldn't be used in a React component. In this case, use the `useObservable` hook described in [Using with React](#using-with-react) section.

<details>
  <summary><b>Extra:</b> equality check argument</summary>

`observable` supports an equality check function as a second argument. This function can be used to prevent unnecessary updates when the value hasn't effectively changed. You can also use `true` to use the built-in `shallowEquals` implementation:

```js
import { shallowEquals } from "onek";

const [greetings, setGreetings] = observable(["hello"], true);
// or equivalently
const [greetings, setGreetings] = observable(["hello"], shallowEquals);

// setting an equal value doesn't trigger updates
setNumber(["hello"]);
```

Built-in `shallowEquals` covers plain objects, arrays, `Map` and `Set` equality, but if you need something else (like lodash `isEqual`), just pass it as the second argument.

</details>

<details>
  <summary><b>Extra:</b> storing functions in observable</summary>

In Onek, you can store functions directly in an observable. This is useful for cases where you need to store callback or computation functions. To do this, pass true as the second argument to the setter function:

```js
// create an observable for a callback function
const [callback, setCallback] = observable(() => console.log("hello!"));

// stores the callback as is
setCallback(() => console.log("hola!"), true);
```

</details>

### Computed values

A computed value is like `useMemo` in React - it's cached and returns the cached value afterward.
All accessed `observable` or other `computed` values are automatically tracked, there is no need to
specify a dependency list.
Changes to these tracked values automatically invalidate the cached value, which is recalculated on the next access to the `computed`:

```js
import { computed } from "onek";

const loudGreeting = computed(() => greeting().toUpperCase());

loudGreeting() === "HOLA!!!!";

setGreeting("hi!");

loudGreeting() === "HI!";
```

<details>
  <summary><b>Extra:</b> equality check argument</summary>

Just like with `observable`, you can also provide an equality check function as a second argument to `computed` (or `true` for default `shallowEquals` implementation). This allows you to control when the `computed` value is considered to have changed and needs to notify its subscribers about it. In case the equality check function returns `true`, the output of the computed remains referentially equal to the old one:

```js
// create observable with an array of numbers
const [numbers, setNumbers] = observable([1, 2, 3, 4]);

// create a computed value that returns sorted array
const sortedNumbers = computed(() => [...numbers()].sort(), true);

const result = sortedNumbers();

console.log(result); // output: [1,2,3,4]

// the array is different, but sorted result is the same
setNumbers([4, 3, 2, 1]);

sortedNumbers() === result; // result is referrentially the same
```

The primary goal of the equality check argument is to manage and limit side effects, such as updates to React components or executions of `reaction` functions. These side effects might occur due to changes in the source `observable` or `computed` values. By using an equality check, you can ensure that these side effects are triggered only when the result of the `computed` function changes substantially, rather than being activated by every minor change to the source values. This approach can be particularly useful when the source values change frequently, but the computed result does not.

</details>

### Using with React

Using `observable` and `computed` in React components is as simple as:

```jsx
import { computed, observable, useObserver } from "onek";

const [greeting, setGreeting] = observable("hello!");

const loudGreeting = computed(() => greeting().toUpperCase());

const LoudGreeting = () => {
  const observer = useObserver();

  return observer(() => <p>{loudGreeting()}</p>);
};

const GreetingInput = () => {
  const observer = useObserver();

  return observer(() => (
    <input
      type="text"
      onChange={(e) => setGreeting(e.target.value)}
      value={greeting()}
    />
  ));
};

root.render(
  <>
    <GreetingInput />
    <LoudGreeting />
  </>
);
```

`useObserver` hook has no arguments and returns an observer function. You can wrap your component
code with it or pass it to `observable` and `computed` getters to get the component update
on their changes. Reading observable values outside of the observer fn or without passing it to
getters won't subscribe the component to changes:

```js
const [value, setValue] = observable(1);

const Component = () => {
  const observer = useObserver();

  observer(() => value()); // component will rerender on value change
  observer(value); // correct, will rerender as well
  value(observer); // also corrrect
  value(); // no rerender on value change
};
```

### Actions and transactions

**Actions** automatically batch updates to observable values, and also make access to observable
getters untracked - so if your action is called inside a component's render function or a reaction it won't make it re-render on accessed values change.

**Important note**: by default, all changes to `observable` values are batched until the end of the
current microtask. To run reactions synchronously on the transaction end, please read
the [Changing reaction scheduler](#reaction-scheduler) section.

```js
const [x, setX] = observable(1);
const [y, setY] = observable(2);

const updateValues = action((value) => {
  const xValue = x(); // access to x is not tracked by reaction or component

  setX(0); // these two updates are batched,
  setY(xValue + value); // so components will see updated values at once
});

updateValues(100);
```

A **transaction** is the same, except it's executed immediately and doesn't make values access
untracked:

```js
import { tx } from "onek";

tx(() => {
  setX(100);
  setY(200);
});
```

To get the same behavior as the `action` use `utx` (**U**ntracked transaction) instead:

```js
const result = utx(() => {
  setX(1000);
  setY(2000);

  return x() + y(); // access is untracked
});
```

### Async operations

Just define an action with async function:

```js
const [data, setData] = observable(null);
const [fetching, setFetching] = observable(false);
const [error, setError] = observable(null);

const fetchData = action(async () => {
  try {
    setFetching(true);
    const responseData = await axios.get("url");
    setData(responseData);
  } catch (err) {
    setError(err);
  } finally {
    setFetching(false);
  }
});

await fetchData();
```

By default, Onek uses a microtask scheduler for reactions, so updates to observables are batched
until the current microtask end. This means both `data` and `fetching` values will be consistent
when any side effects run.

<details>
  <summary><b>Extra:</b> async operations for synchronous scheduler</summary>

[You can configure](#reaction-scheduler) Onek to use synchronous reaction scheduler that will
execute side effects synchronously after each transaction ends. In this case, you need to use `action`
for promise handlers or `utx` for code blocks in async function, i.e.:

```js
const fetchData = action(() => {
  setFetching(true);

  return axios
    .get("url")
    .then(
      action((data) => {
        setFetching(false);
        setData(data);
      })
    )
    .catch(
      action((err) => {
        setFetching(false);
        setError(err);
      })
    );
});
```

or with async functions:

```js
const fetchData = action(async () => {
  setFetching(true);

  try {
    const data = await axios.fetch("url");
    utx(() => {
      setFetching(false);
      setData(data);
    });
  } catch (err) {
    utx(() => {
      setFetching(false);
      setError(err);
    });
  }
});
```

</details>

### Reactions

A **reaction** is a way to react to observable or computed changes without involving React. It's the
same as the `autorun` function from MobX:

```js
import { reaction } from "onek";

// will print "Greeting is HOLA!!!!"
const disposer = reaction(() => {
  console.log("Greeting is " + greeting());
});

setGreeting("Привет!"); // prints "Greeting is Привет!"

disposer();

setGreeting("Hello!"); // doesn't print anymore

disposer.run(); // prints "Greeting is Hello!" again
```

<details>
  <summary><b>Extra:</b> reaction destructor</summary>

The return value of the reaction body might be a **reaction destructor** - a function that is called
before each reaction run and on `disposer` call:

```js
const [topic, setTopic] = observable("something");

const disposer = reaction(() => {
  const currentTopic = topic();

  subscribeToTopic(currentTopic, callback);

  return () => {
    unsubscribeFromTopic(currentTopic, callback);
  };
});

setTopic("different"); // calls destructor function before executing reaction

disposer(); // unsubscribes from topic and won't run anymore
```

</details>

### Making models

#### Solid.js flavor

To compose your observable and computed values into a single model, you can use the following
pattern:

```js
function makeModel(initialValue) {
  const [value, setValue] = observable(initialValue);
  const doubleValue = computed(() => value() * 2);

  return {
    value,
    setValue,
    doubleValue,
  };
}
```

A downside of this approach is that it's required to explicitly return all model
getters/setters/actions, which can be cumbersome for large models. Also, it requires defining a
convenient TypeScript type for the model:

```ts
type Model = ReturnType<typeof makeModel>;
```

#### MobX flavor

Another flavor for making Onek models is MobX flavor. It requires importing an additional tiny
(~300 bytes) package:

```js
import { makeObservable } from "onek/mobx";

class Model {
  constructor(initialValue) {
    this.value = observable.prop(initialValue);
    this.double = computed.prop(() => this.value * 2);

    makeObservable(this);
  }
}

const model = new Model(10);

// read observable and computed values
model.value === 10;
model.double === 20;

// set observable value
model.value = 100;
```

It defines observable and computed values on the class and then calls `makeObservable` to create
getters/setters on the class instance. The only difference in defining the values on the class is
that you need to use `.prop` modifier on observable/computed factories. Otherwise, the usage of MobX
models is equivalent to Solid.js ones - just read the values inside `observer` function to make a
component re-render on changes.

**Note:** it's safe to call `makeObservable` more than once on a class instance. This makes it work
for inheritance cases where both base and inherited classes have observable values.

## Examples?

### Simple counter

<details>
    <summary><b>Simple counter</b> - Actions and models</summary>

```jsx
import { action, observable, useObserver } from "onek";

const makeCounter = (initial) => {
  const [count, setCount] = observable(initial);
  const inc = action(() => setCount((count) => count + 1));
  const dec = action(() => setCount((count) => count - 1));
  const reset = action(() => setCount(initial));

  return { count, inc, dec, reset };
};

const Counter = ({ counter }) => {
  const observer = useObserver();

  const { count, inc, dec, reset } = counter;

  return observer(() => (
    <>
      <button onClick={inc}>+</button>
      <button onClick={dec}>-</button>
      <button onClick={reset}>Reset</button>
      Count: {count()}
    </>
  ));
};

const counter = makeCounter(0);

root.render(<Counter counter={counter} />);
```

</details>

### Counter list

<details>
    <summary><b>Counter list with stats</b> - Model composition and computed data</summary>

```jsx
import { observable, computed, action, useObserver } from "onek";
import { makeCounter, Counter } from "./Counter";

const makeCountersList = () => {
  const [counters, setCounters] = observable([]);

  const countersCount = computed(() => counters().length);
  const countersSum = computed(() =>
    counters().reduce((sum, counter) => sum + counter.count(), 0)
  );

  const addCounter = action(() => {
    const counter = makeCounter(0);
    setCounters((counters) => [...counters, counter]);
  });

  const removeCounter = action((counter) => {
    setCounters((counters) =>
      counters.filter((_counter) => _counter !== counter)
    );
  });

  const resetAll = action(() => {
    counters().forEach((counter) => counter.reset());
  });

  return {
    counters,
    countersCount,
    countersSum,
    addCounter,
    removeCounter,
    resetAll,
  };
};

const CounterStats = ({ count, sum }) => {
  const observer = useObserver();

  return observer(() => (
    <>
      <p>Total count: {count()}</p>
      <p>Total sum: {sum()}</p>
    </>
  ));
};

const CountersList = ({ model }) => {
  const observer = useObserver();

  return observer(() => (
    <div>
      <CounterStats count={model.countersCount} sum={model.countersSum} />
      <button onClick={model.addCounter}>Add</button>
      <button onClick={model.resetAll}>Reset all</button>
      {model.counters().map((counter) => (
        <div>
          <Counter counter={counter} />
          <button onClick={() => model.removeCounter(counter)}>Remove</button>
        </div>
      ))}
    </div>
  ));
};

const countersList = makeCountersList();

root.render(<CountersList model={countersList} />);
```

</details>

### Todo List

<details>
  <summary><b>Todo List</b> - Complex multi-component app</summary>

```jsx
import { action, computed, observable, useObserver } from "onek";

let id = 0;

export const makeTodo = (todoText) => {
  const [text, setText] = observable(todoText);
  const [done, setDone] = observable(false);

  const toggleDone = action(() => {
    setDone((done) => !done);
  });

  return {
    id: id++,
    text,
    done,
    setText,
    toggleDone,
  };
};

export const makeTodoList = () => {
  const [text, setText] = observable("");
  const [todos, setTodos] = observable([], true);
  const [filter, setFilter] = observable("ALL");

  const doneTodos = computed(() => {
    return todos().filter((todo) => todo.done());
  });

  const undoneTodos = computed(() => {
    return todos().filter((todo) => !todo.done());
  });

  const visibleTodos = computed(() => {
    switch (filter()) {
      case "ALL":
        return todos();
      case "DONE":
        return doneTodos();
      case "UNDONE":
        return undoneTodos();
    }
  }, true);

  const addTodo = action(() => {
    const todo = makeTodo(text());
    setTodos((todos) => [...todos, todo]);
    setText("");
  });

  const removeTodo = action((todo) => {
    setTodos((todos) => todos.filter((_todo) => _todo !== todo));
  });

  const clearDone = action((todo) => {
    setTodos(undoneTodos());
  });

  return {
    text,
    setText,
    todos,
    filter,
    visibleTodos,
    setFilter,
    addTodo,
    removeTodo,
    clearDone,
  };
};

const FILTER_OPTIONS = [
  { name: "All", value: "ALL" },
  { name: "Done", value: "DONE" },
  { name: "Undone", value: "UNDONE" },
];

const NewTodoInput = ({ model }) => {
  const observer = useObserver();

  const { text, setText, addTodo } = model;

  return observer(() => (
    <div>
      <input onChange={(e) => setText(e.target.value)} value={text()} />
      <button onClick={addTodo} disabled={text().length === 0}>
        Add
      </button>
    </div>
  ));
};

const TodoListFilter = ({ model }) => {
  const observer = useObserver();

  return observer(() => (
    <select
      value={model.filter()}
      onChange={(e) => model.setFilter(e.target.value)}
    >
      {FILTER_OPTIONS.map(({ name, value }) => (
        <option key={value} value={value}>
          {name}
        </option>
      ))}
    </select>
  ));
};

const Todo = ({ model }) => {
  const observer = useObserver();

  return observer(() => (
    <div className="todo">
      <label>
        <input
          type="checkbox"
          checked={model.done()}
          onChange={model.toggleDone}
        />
        <span
          style={{ textDecoration: model.done() ? "line-through" : "none" }}
        >
          {model.text()}
        </span>
      </label>
    </div>
  ));
};

export const TodoList = ({ model }) => {
  const observer = useObserver();

  return observer(() => (
    <div className="todo-list">
      <button onClick={model.clearDone}>Clear done</button>
      <TodoListFilter model={model} />
      <NewTodoInput model={model} />
      {model.visibleTodos().map((todo) => (
        <Todo key={todo.id} model={todo} />
      ))}
    </div>
  ));
};
```

</details>

## Recipes

### Optimizing React re-renders with check flag

The `check` flag in `observable` and `computed` constructors can be used to optimize React re-renders. It's useful when the result of your computed changes much less frequently than the source observable values. In this case, you can use the `check` flag to prevent unnecessary re-renders:

```js
// todos can change frequently
const [todos, setTodos] = observable([]);

// but the result of this computed changes much less frequently
const isEmpty = computed(() => todos().length === 0, true);
```

### Reaction scheduler

The reaction scheduler is a function that's called at the end of the first transaction executed
after the previous scheduler run. It has one argument - a `runner` function that should somehow be "
scheduled" to run. The default implementation of the scheduler is a microtask Promise-based
scheduler:

```js
const reactionScheduler = (runner) => Promise.resolve().then(runner);

configure({ reactionScheduler });
```

This is a good compromise between speed and developer experience, but sometimes you might want to
run all reactions synchronously at the transaction end (for example, this is done in the Onek test
suite):

```js
const reactionScheduler = (runner) => runner();

configure({ reactionScheduler });
```

Another alternative to the default microtask scheduler is a **macro**task scheduler:

```js
const reactionScheduler = (runner) => setTimeout(runner, 0);

configure({ reactionScheduler });
```

### Reaction exception handler

The default exception handler for auto-run reactions is just `console.error`. It can be configured
by the `reactionExceptionHandler` option:

```js
configure({
  reactionExceptionHandler: (exception) => {
    // some exception handling logic
  },
});
```

### Memory leaks: why not?

Onek does not have memory leaks while maintaining optimal caching for computed values. There is
no `keepAlive` option like in `MobX`, and here's why. When a computed value has lost its last
subscriber or is being read in an untracked context without existing subscribers, it enters a **passive
** state. This state means the computed is no longer referenced by any observable or other computed,
but still holds references to its dependencies, so it can check later if some of them changed.

How is change detection possible without guarantees that values stored in observable and computed value are immutable? The answer is simple: along with the value, observable and computed store a
**revision** - an immutable plain object that is new each time an observable or computed is updated.
This allows the implementation of `reselect`-like logic of checking computed dependencies with very small
overhead and preserves cached values without any memory leaks.

## API Documentation

### Interfaces

Here are some general interfaces used in the following documentation:

```ts
import { ComputedImpl, ObservableImpl } from "./types";

type ISubscriber = ComputedImpl | ReactionImpl;

interface Getter<T> {
  (subscriber?: ISubscriber): T;
}

interface ObservableGetter<T> extends Getter<T> {
  instance: IObservable<T>;
}

interface ComputedGetter<T> extends Getter<T> {
  instance: IComputed<T>;

  destroy(): void;
}

interface Setter<T> {
  (value?: T | UpdaterFn<T>, asIs?: boolean): void;
}

type CheckFn<T> = (prev: T, next: T) => boolean;
type UpdaterFn<T> = (prevValue: T) => T;
```

### observable

```ts
function observable<T>(
  value: T,
  checkFn?: boolean | CheckFn<T>
): readonly [ObservableGetter<T>, Setter<T>];
```

Creates a getter and setter for reactive value. The `value` argument is the value stored in the
observable instance, and the `checkFn`
is a function that's used for checking if the new value from the setter is the same as the old one.

The getter is a function that can accept an `ISubscriber` - return value of `useObserver` hook or the
value of `instance` attribute of a computed getter.

The setter function can accept a `value` argument that can be of a generic type or an updater
function that returns a value of the generic type.

The second argument to the setter function is an `asIs` boolean that indicates if the `value` should
be stored as is without interpreting it as an updater function.

The setter also can be called without arguments - this will mark the observable as changed without
changing its value. This can be useful when you mutate the observable value directly without
changing the reference to it.

### computed

```ts
function computed<T>(
  fn: () => T,
  checkFn?: boolean | CheckFn<T>
): ComputedGetter<T>;
```

Creates a getter for a computed value. The `fn` argument is a function that returns the computed.
The `checkFn` argument is a function that's used for checking if the new value from the setter is the same as the old one. It can be `true` to use the built-in `shallowEquals` implementation.

### reaction

```ts
type Destructor = (() => void) | null | undefined | void;

type Disposer = (() => void) & { run: () => void };

function reaction(fn: () => Destructor, manager?: () => void): Disposer;
```

Creates a reaction that runs the `fn` function and subscribes to all accessed observables and computed values. The `fn` function can return a **reaction destructor** - a function that's called before each reaction run and on the `disposer` call. If the `manager` function is specified, it's called instead of the reaction body. It should schedule the reaction to run later.

## action

```ts
function action<Args extends any[], T>(
  fn: (...args: Args) => T
): (...args: Args) => T;
```

Creates an action that runs the `fn` function and batches all updates to observables and computed.

## tx

```ts
function tx(fn: () => void): void;
```

Executes the `fn` function immediately and batches all updates to observables and computed.

## utx

```ts
function utx<T>(fn: () => T, subscriber = null): T;
```

Executes the `fn` function immediately and batches all updates to observables and computed. The difference from `tx` is that it makes all observable and computed values accessed inside the `fn` untracked, so they won't make the component rerender or reaction run.

### untracked

```ts
function untracked<Args extends any[], T>(
  fn: (...args: Args) => T
): (...args: Args) => T;
```

Creates a function that runs the `fn` function and makes all observable and computed values accessed inside the `fn` untracked, so they won't make the component rerender or reaction run.

### useObserver

```ts
function useObserver(): ISubscriber | undefined;
```

Returns the `ISubscriber` instance that is also a function. The resulting function can be used to wrap your component code with it or be passed as an argument to `observable` and `computed` getters to make the component rerender on their changes. Also, it can be called with `observable` or `computed` as an argument, it will also make the component rerender on their changes.

### shallowEquals

```ts
function shallowEquals<T>(prev: T, next: T): boolean;
```

Returns `true` if `prev` and `next` are equal. Supports plain objects, arrays, `Map` and `Set`.

## License

MIT

## Author

Eugene Daragan
