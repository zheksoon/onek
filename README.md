<p align="center">
  <img align="center" src="https://github.com/zheksoon/onek/blob/main/assets/1K.svg?raw=true" width="150" alt="onek" /> 
</p>

<p align="center">
  <b>Onek</b>
</p>

<p align="center">
⚡️ <b>1.7KB</b> full-featured state management inspired by MobX and Solid, <b>batteries included</b> ⚡️
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/onek" > 
    <img src="https://badgen.net/npm/v/onek?color=5fbfcd"/> 
  </a>
  <a href="https://bundlephobia.com/package/onek" > 
    <img src="https://badgen.net/badgesize/brotli/file-url/unpkg.com/onek/dist/onek.mjs?color=5fbfcd"/> 
  </a>
  <a href="https://github.com/zheksoon/onek/blob/main/LICENSE" > 
    <img src="https://badgen.net/github/license/zheksoon/onek?color=5fbfcd"/> 
  </a>
</p>

**Onek** is a simple but powerful state management library for **React** based on solid foundation of functional reactive
data structures from **MobX** and **Solid.js**, providing everything needed for managing state in complex React applications,
all in less than **2KB** package.

## Features

- 🚀 Reactive observable and computed values - just like MobX, Solid.js or Preact Signals
- 👁 Transparency - no data glitches guaranteed
- 🔄 Transactional updates - no unexpected side-effects
- 🙈 Laziness - nothing happens until you need a value
- 🤓 Built-in shallow equality for easily optimizing re-renders
- 🤔 Not opinionated about structure of your models
- 🎱 No need for selectors or wrapping your components into lambdas
- 💯 100% tests coverage with complex cases
- ⭐️ Written in 100% TypeScript
- 📦 ...and all in less than 2KB package

## Table of contents

- [Introduction](#introduction)
  - [Observable values](#observable-values)
  - [Computed values](#computed-values)
  - [Using with React](#using-with-react)
  - [Actions and transactions](#actions-and-transactions)
  - [Reactions](#reactions)
- [Examples](#examples)
  - [Counter](#simple-counter)
  - [Counter list](#counter-list)
  - [Toso List](#todo-list)

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

Define `computed` value. Computed value is like `useMemo` in React - it's cached and return the cached value afterwards. All accessed `observable` or other `computed` values are automatically tracked, there is no need to specify dependency list. Changes to these tracked values automatically invalidate the cached value, which is recalculated on next access to the `computed`:

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

`useObserver` hook has no arguments and returns subscriber instance that should be passed to observable and computed values in order to get the component subscribed to them. While it's still correct to read observable values without passing the subscriber, changes to them won't rerender your component:

```js
const [value, setValue] = observable(1);

const Component = () => {
  const obs = useObserver();

  value(obs); // correct, component will subscribe to the value
  value(); // no subscription
};
```

### Actions and transactions

**Actions** automatically batch updates to observable values, and also make access to observable getters untracked - so if your action is called inside component's render function or inside reaction, it won't make it re-render on change of these accessed values.

**Important note**: by default all changes to `observable` values are batched until the end of current microtask. In order to make reaction run synchronous on changes, please read Changing reaction runner

```js
const [x, setX] = observable(1);
const [y, setY] = observable(2);

const updateValues = action((value) => {
  const xValue = x(); // access to x is not tracked by calling reaction or component

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

To get the same behaviour as `action` use `utx` (**U**ntracked transaction) instead.

### Reactions

**Reaction** is a way to react to observable or computed changes without involving React. It's the same as `autorun` function from MobX:

```js
import { reaction } from "onek";

// will print "Greeting is HOLA!!!!"
const disposer = reaction(() => {
  console.log("Greeting is " + greeting());
});

setGreeting("Привет!"); // prints "Привет!"

disposer();

setGreeting("Hello!"); // doesn't print anymore

disposer.run(); // prints "Hello!" again
```

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
  const { counter, inc, dec, reset } = counter;

  const obs = useObserver();

  return (
    <>
      <button onClick={inc}>+</button>
      <button onClick={dec}>-</button>
      <button onClick={reset}>Reset</button>
      Count: {counter(obs)}
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
          <Counter model={counter} />
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

## License

MIT

## Author

Eugene Daragan
