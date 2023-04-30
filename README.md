<p align="center">
  <img align="center" src="https://github.com/zheksoon/onek/blob/main/assets/1K.svg?raw=true" width="150" alt="Onek" /> 
</p>

<p align="center">
  <b>Onek</b>
</p>

<p align="center">
⚡️ <b>1.7KB</b> full-featured state management inspired by MobX and Solid, <b>batteries included</b> ⚡️
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/onek" > 
    <img src="https://badgen.net/npm/v/onek?color=5fbfcd" alt="onek version"/> 
  </a>
  <a href="https://bundlephobia.com/package/onek" > 
    <img src="https://badgen.net/badgesize/brotli/file-url/unpkg.com/onek/dist/onek.mjs?color=5fbfcd" alt="onek brotli size"/> 
  </a>
  <a href="https://github.com/zheksoon/onek/blob/main/LICENSE" > 
    <img src="https://badgen.net/github/license/zheksoon/onek?color=5fbfcd" alt="onek license"/> 
  </a>
</p>

**Onek** (reads as **_one-kay_** or **_one-key_**) is a simple but powerful state management library for **React** based on solid foundation of functional reactive
data structures from **MobX** and **Solid.js**, providing everything needed for managing state in complex React applications,
all in less than **2KB** package.

## Features

- 🚀 **Reactive observable and computed values** - just like MobX, Solid.js or Preact Signals
- 👁 **Transparency** - no data glitches guaranteed
- 🔄 **Transactional updates** - no unexpected side-effects
- 🙈 **Laziness** - nothing happens until you need a value
- 💧 **No memory leaks** - optimal computed caching without compromises
- 🤓 **Built-in shallow equality** - easily optimize re-renders
- 🤔 **Not opinionated** about structure of your models
- 🧩 **Single hook** - effortless integration with React components
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

### Observable values

`observable` is a simple function that accepts initial value and returns a tuple of getter and setter functions - the same convention as `useState` from React:

```js
import { observable } from "onek";

const [greeting, setGreeting] = observable("hello!");

greeting() === "hello!";

// set value directly
setGreeting("hola!");

greeting() === "hola!";

// alternative option - updater function
setGreeting((oldGreeting) => oldGreeting + "!!!");

greeting() === "hola!!!!";
```

<details>
  <summary><b>Extra:</b> equality check argument</summary>

The second argument to `observable` might be equality check function (or `true` for built-in `shallowEquals` implementation):

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

In order to store a function in observable you need to pass `true` as a second argument to setter function. This argument means the setter should store the first argument as-is, without its interpretation as updater function:

```js
const [callback, setCallback] = observable(() => console.log("hello!"));

setCallback(() => console.log("hola!"), true); // stores callback as is
```

</details>

### Computed values

Computed value is like `useMemo` in React - it's cached and returns the cached value afterwards. All accessed `observable` or other `computed` values are automatically tracked, there is no need to specify dependency list. Changes to these tracked values automatically invalidate the cached value, which is recalculated on next access to the `computed`:

```js
import { computed } from "onek";

const loudGreeting = computed(() => greeting().toUpperCase());

loudGreeting() === "HOLA!!!!";

setGreeting("hi!");

loudGreeting() === "HI!";
```

<details>
  <summary><b>Extra:</b> equality check argument</summary>
    
The second argument to `computed` is also equality check function (or `true` for built-in implementation):

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
import { observable, computed, useObserver } from "onek";

const [greeting, setGreeting] = observable("hello!");

const loudGreeting = computed(() => greeting().toUpperCase());

const LoudGreeting = () => {
  const obs = useObserver();

  return <p>{loudGreeting(obs)}</p>;
};

const GreetingInput = () => {
  const obs = useObserver();

  return (
    <input
      type="text"
      onChange={(e) => setGreeting(e.target.value)}
      value={greeting(obs)}
    />
  );
};

root.render(
  <>
    <GreetingInput />
    <LoudGreeting />
  </>
);
```

`useObserver` hook has no arguments and returns subscriber instance that should be passed to `observable` and `computed` getters in order to get the component subscribed to them. While it's still correct to read observable values without passing the subscriber, changes to them won't rerender your component:

```js
const [value, setValue] = observable(1);

const Component = () => {
  const obs = useObserver();

  value(obs); // correct, component will rerender on value change
  value(); // no rerender on value change
};
```

### Actions and transactions

**Actions** automatically batch updates to observable values, and also make access to observable getters untracked - so if your action is called inside component's render function or inside reaction, it won't make it re-render on accessed values change.

**Important note**: by default all changes to `observable` values are batched until the end of current microtask. In order to run reactions synchronously on transaction end, please read the [Changing reaction scheduler](#reaction-scheduler) section.

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

**Transaction** is the same, except it's executed immediately and doesn't make values access untracked:

```js
import { tx } from "onek";

tx(() => {
  setX(100);
  setY(200);
});
```

To get the same behaviour as `action` use `utx` (**U**ntracked transaction) instead:

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

By default, onek uses microtask scheduler for reactions, so updates to observables are batched until the current microtask end. This means both `data` and `fetching` values will be consistent when any side effects run.

<details>
  <summary><b>Extra:</b> async operations for synchronous scheduler</summary>

[You can configure](#reaction-scheduler) onek to use synchronous reaction scheduler that will execute side effects synchronously after each transaction end. In this case you need to use `action` for promise handlers or `utx` for code blocks in async function, i.e.:

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

**Reaction** is a way to react to observable or computed changes without involving React. It's the same as `autorun` function from MobX:

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

Return value of reaction body might be **reaction destructor** - a function that is called before each reaction run and on `disposer` call:

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

## Examples?

### Simple counter

<details>
    <summary><b>Simple counter</b> - Actions and models</summary>

```jsx
import { observable, action, useObserver } from "onek";

const makeCounter = (initial) => {
  const [count, setCount] = observable(initial);
  const inc = action(() => setCount((count) => count + 1));
  const dec = action(() => setCount((count) => count - 1));
  const reset = action(() => setCount(initial));

  return { count, inc, dec, reset };
};

const Counter = ({ counter }) => {
  const { count, inc, dec, reset } = counter;

  const obs = useObserver();

  return (
    <>
      <button onClick={inc}>+</button>
      <button onClick={dec}>-</button>
      <button onClick={reset}>Reset</button>
      Count: {count(obs)}
    </>
  );
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
  const obs = useObserver();

  return (
    <>
      <p>Total count: {count(obs)}</p>
      <p>Total sum: {sum(obs)}</p>
    </>
  );
};

const CountersList = ({ model }) => {
  const obs = useObserver();

  return (
    <div>
      <CounterStats count={model.countersCount} sum={model.countersSum} />
      <button onClick={model.addCounter}>Add</button>
      <button onClick={model.resetAll}>Reset all</button>
      {model.counters(obs).map((counter) => (
        <div>
          <Counter counter={counter} />
          <button onClick={() => model.removeCounter(counter)}>Remove</button>
        </div>
      ))}
    </div>
  );
};

const countersList = makeCountersList();

root.render(<CountersList model={countersList} />);
```

</details>

### Todo List

<details>
  <summary><b>Todo List</b> - Complex multi-component app</summary>

```jsx
import { action, observable, computed, useObserver } from "onek";

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
  const { text, setText, addTodo } = model;

  const obs = useObserver();

  return (
    <div>
      <input onChange={(e) => setText(e.target.value)} value={text(obs)} />
      <button onClick={addTodo} disabled={text(obs).length === 0}>
        Add
      </button>
    </div>
  );
};

const TodoListFilter = ({ model }) => {
  const obs = useObserver();

  return (
    <select
      value={model.filter(obs)}
      onChange={(e) => model.setFilter(e.target.value)}
    >
      {FILTER_OPTIONS.map(({ name, value }) => (
        <option key={value} value={value}>
          {name}
        </option>
      ))}
    </select>
  );
};

const Todo = ({ model }) => {
  const obs = useObserver();

  return (
    <div className="todo">
      <label>
        <input
          type="checkbox"
          checked={model.done(obs)}
          onChange={model.toggleDone}
        />
        <span
          style={{ textDecoration: model.done(obs) ? "line-through" : "none" }}
        >
          {model.text(obs)}
        </span>
      </label>
    </div>
  );
};

export const TodoList = ({ model }) => {
  const obs = useObserver();

  return (
    <div className="todo-list">
      <button onClick={model.clearDone}>Clear done</button>
      <TodoListFilter model={model} />
      <NewTodoInput model={model} />
      {model.visibleTodos(obs).map((todo) => (
        <Todo key={todo.id} model={todo} />
      ))}
    </div>
  );
};
```

</details>

## Recipes

### Optimizing React re-renders with check flag

### Reaction scheduler

Reaction scheduler is a function that's called on the end of the first transaction executed after previous scheduler run. It has one argument - `runner` function that should somehow be "scheduled" to run. Default implementation of the scheduler is microtask Promise-based scheduler:

```js
const reaction = (runner) => Promise.resolve().then(runner);

configure({ reaction });
```

This is a good compromise between speed and developer experience, but sometimes you might want to run all reactions synchronously on transaction end (for example, this is done in onek test suite):

```js
const reaction = (runner) => runner();

configure({ reaction });
```

Another alternative to the default microtask scheduler is **macro**task scheduler:

```js
const reaction = (runner) => setTimeout(runner, 0);

configure({ reaction });
```

### Reaction exception handler

Default exception handler for auto-run reactions is just `console.error`. It can be configured by `reactionExceptionHandler` option:

```js
configure({
  reactionExceptionHandler: (exception) => {
    // some exception handling logic
  },
});
```

### Memory leaks: why not?

Onek does not have memory leaks while maintaining optimal caching for computed values. There is no `keepAlive` option like `MobX` has, and here's why. When a computed value has lost its last subscriber or being read in untracked context without existing subscribers, it enters **passive** state. The state means the computed is no longer referenced by any observable or other computed, but still holds references to its dependencies, so it can check later if some of them changed.

How is the change detection possible without guarantees that values stored in observables and computeds are immutable? The answer is simple: along with the value, observables and computeds store **revision** - an immutable plain object that is new each time observable or computed updated. This allows to implement `reselect`-like logic of checking computed dependencies with very small overhead and preserve cached values without any memory leaks.

## API Documentation

### Interfaces

Here's some general interfaces used in the following documentation:

```ts
import { ComputedImpl, ObservableImpl } from "./types";

type Subscriber = ComputedImpl | ReactionImpl;

interface Getter<T> {
  (subscriber?: Subscriber): T;
}

interface ObservableGetter<T> extends Getter<T> {
  $$observable: ObservableImpl<T>;
}

interface ComputedGetter<T> extends Getter<T> {
  $$computed: ComputedImpl<T>;

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

Creates getter and setter for reactive value. `value` argument as a value stored in the observable instance, `checkFn` is a function that's used for checking if new value from the setter is the same as the old one.
Getter is a function that can accept `Subscriber` - return value of `useObserver` hook or value of `$$computed` attribute of computed getter.
Setter function can accept `value` argument that can be of generic type or updater function that returns a value of the generic type.
The second argument to setter function is `asIs` boolean that indicates if the `value` should be stored as is without interpreting it as updater function.
Setter also can be called without arguments - this will mark the observable as changed without changing its value. This can be useful when you mutate observable value directly without changing reference to it.

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
