<p align="center">
  <img align="center" src="https://github.com/zheksoon/onek/blob/main/assets/1K.svg?raw=true" width="150" alt="Onek" /> 
</p>

<p align="center">
  <b>Onek</b>
</p>

<p align="center">
⚡️ <b>2KB</b> full-featured state management inspired by MobX and Solid.js, <b>batteries included</b> ⚡️
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
</p>

**Onek** (reads as **_one-kay_** or **_one-key_**) is a simple but powerful state management library
for **React** based on a solid foundation of functional reactive data structures from **MobX** and *
*Solid.js**, providing everything needed for managing state in complex React applications,
all in a less than **2KB package**.

## Features

- 🚀 **Reactive observable and computed values** - just like MobX, Solid.js and Preact Signals
- 🎭 **Both MobX and Solid.js** flavors - choose what you like
- 🤔 **Not opinionated** about the structure of your models
- 👁 **Transparency** - no data glitches guaranteed
- 💧 **No memory leaks** - optimal computed caching without compromises
- 🧩 **Single hook** - effortless integration with React components
- 🤓 **Built-in shallow equality** - easily optimize re-renders
- 💾 **Compatibility** - only ES6 `Set` and `Map` are required
- 💯 **100% test coverage** with complex cases
- ⭐️ Written in **100% TypeScript**
- 📦 ...and all in less than **2KB package**

## Table of contents

- [Installation](#installation)
- [Introduction](#introduction)
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

## Introduction

**Note:** in this section Solid.js flavor will be used. If you want examples for MobX flavor, check
out the [MobX flavor](#mobx-flavor) section.

### Observable values

`observable` is a simple function that accepts an initial value and returns a tuple of getter and
setter functions - the same convention as `useState` from React:

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

<details>
  <summary><b>Extra:</b> equality check argument</summary>

The second argument to `observable` might be an equality check function (or `true` for the
built-in `shallowEquals` implementation):

```js
import { shallowEquals } from "onek";

const [number, setNumber] = observable(1, true);
// or equivalently
const [number, setNumber] = observable(1, shallowEquals);

setNumber(1); // no updates to dependant computeds and reactions
```

</details>

<details>
  <summary><b>Extra:</b> storing functions in observable</summary>

In order to store a function in an observable you need to pass `true` as the second argument to the
setter function. This argument means the setter should store the first argument as-is, without its
interpretation as an updater function:

```js
const [callback, setCallback] = observable(() => console.log("hello!"));

setCallback(() => console.log("hola!"), true); // stores callback as is
```

</details>

### Computed values

A computed value is like `useMemo` in React - it's cached and returns the cached value afterwards.
All accessed `observable` or other `computed` values are automatically tracked, there is no need to
specify a dependency list.
Changes to these tracked values automatically invalidate the cached value, which is recalculated on
next access to the `computed`:

```js
import { computed } from "onek";

const loudGreeting = computed(() => greeting().toUpperCase());

loudGreeting() === "HOLA!!!!";

setGreeting("hi!");

loudGreeting() === "HI!";
```

<details>
  <summary><b>Extra:</b> equality check argument</summary>

The second argument to `computed` is also an equality check function (or `true` for the built-in
implementation):

```js
const [numbers, setNumbers] = observable([1, 2, 3, 4]);

const sortedNumbers = computed(() => numbers().slice().sort(), true);

const result = sortedNumbers();

console.log(result); // [1,2,3,4]

setNumbers([4, 3, 2, 1]);

sortedNumbers() === result; // result is referrentially the same
```

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
code with it or pass it to `observable` and `computed` getters in order to get the component update
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
getters untracked - so if your action is called inside a component's render function or inside a
reaction it won't make it re-render on accessed values change.

**Important note**: by default all changes to `observable` values are batched until the end of the
current microtask. In order to run reactions synchronously on transaction end, please read
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

To get the same behavior as `action` use `utx` (**U**ntracked transaction) instead:

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
execute side effects synchronously after each transaction end. In this case you need to use `action`
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
getters/setters/actions, which can be cumbersome for large models. Also it requires defining a
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

It defines observable and computed values on class and then calls `makeObservable` to create
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

### Reaction scheduler

The reaction scheduler is a function that's called at the end of the first transaction executed
after the previous scheduler run. It has one argument - a `runner` function that should somehow be "
scheduled" to run. The default implementation of the scheduler is a microtask Promise-based
scheduler:

```js
const reaction = (runner) => Promise.resolve().then(runner);

configure({ reaction });
```

This is a good compromise between speed and developer experience, but sometimes you might want to
run all reactions synchronously at transaction end (for example, this is done in the Onek test
suite):

```js
const reaction = (runner) => runner();

configure({ reaction });
```

Another alternative to the default microtask scheduler is a **macro**task scheduler:

```js
const reaction = (runner) => setTimeout(runner, 0);

configure({ reaction });
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
subscriber or is being read in untracked context without existing subscribers, it enters a **passive
** state. This state means the computed is no longer referenced by any observable or other computed,
but still holds references to its dependencies, so it can check later if some of them changed.

How is the change detection possible without guarantees that values stored in observables and
computeds are immutable? The answer is simple: along with the value, observable and computed store a
**revision** - an immutable plain object that is new each time an observable or computed is updated.
This the implementation of `reselect`-like logic of checking computed dependencies with very small
overhead and preserve cached values without any memory leaks.

## API Documentation

### Interfaces

Here are some general interfaces used in the following documentation:

```ts
import { ComputedImpl, ObservableImpl } from "./types";

type Subscriber = ComputedImpl | ReactionImpl;

interface Getter<T> {
  (subscriber?: Subscriber): T;
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

The getter is a function that can accept a `Subscriber` - return value of `useObserver` hook or the
value of `instance`attribute of a computed getter.

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

### reaction

```ts
type Destructor = (() => void) | null | undefined | void;

type Disposer = (() => void) & { run: () => void };

function reaction(fn: () => Destructor, manager?: () => void): Disposer;
```

## action

```ts
function action<Args extends any[], T>(
  fn: (...args: Args) => T
): (...args: Args) => T;
```

## tx

```ts
function tx(fn: () => void): void;
```

## utx

```ts
function utx<T>(fn: () => T, subscriber = null): T;
```

### untracked

```ts
function untracked<Args extends any[], T>(
  fn: (...args: Args) => T
): (...args: Args) => T;
```

### useObserver

```ts
function useObserver(): Subscriber | undefined;
```

### shallowEquals

```ts
function shallowEquals<T>(prev: T, next: T): boolean;
```

## License

MIT

## Author

Eugene Daragan
