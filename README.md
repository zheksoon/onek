<p align="center">
  <img align="center" src="https://github.com/zheksoon/onek/blob/main/assets/1K.svg?raw=true" width="150" alt="onek" /> 
</p>

<p align="center">
⚡️ <b>1.7KB</b> full-featured state management inspired by MobX and Solid, <b>batteries included</b> ⚡️
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/onek" > 
    <img src="https://badgen.net/npm/v/onek?color=5fbfcd"/> 
  </a>
  <a href="https://bundlephobia.com/package/onek" > 
    <img src="https://badgen.net/badgesize/gzip/file-url/unpkg.com/onek/dist/onek.js?color=5fbfcd"/> 
  </a>
  <a href="https://github.com/zheksoon/onek/blob/main/LICENSE" > 
    <img src="https://badgen.net/github/license/zheksoon/onek?color=5fbfcd"/> 
  </a>
</p>


**Onek** is a simple but powerful state management library for React based on solid foundation of functional reactive data structures from MobX and Solid.js, providing everything needed for managing state for complex React applications, all in less then 2KB package.

**Features**

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

**Examples?**

<details>
    <summary><b>Hello, WORLD!</b> - Basic example of shared state</summary>

```jsx
import { observable, computed, useObserver } from "onek";

const [name, setName] = observable("Eugene");
const uppercaseName = computed(() => name().toUpperCase());

const NameInput = () => {
    useObserver();

    const onChange = useCallback((e) => setName(e.target.value), [setName]);

    return <input type="text" value={name()} onChange={onChange} />;
};

const Greeter = () => {
    useObserver();

    return <span>Hello, {uppercaseName()}!</span>;
};

root.render(
    <>
        <NameInput />
        <Greeter />
    </>
);
```

</details>

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

    useObserver();

    return (
        <>
            <button onClick={inc}>+</button>
            <button onClick={dec}>-</button>
            <button onClick={reset}>Reset</button>
            Count: {counter()}
        </>
    );
};

const counter = makeCounter(0);

root.render(<Counter counter={counter} />);
```

</details>

<details>
    <summary><b>Counter list with stats</b> - Model composition and computed data</summary>

```jsx
import { observable, computed, action, useObserver } from "onek";
import { makeCounter, Counter } from "./Counter";

const makeCountersList = () => {
    const [counters, setCounters] = observable([]);

    const countersCount = computed(() => counters().length);
    const countersSum = computed(() => counters().reduce((sum, counter) => sum + counter.count(), 0));

    const addCounter = action(() => {
        const counter = makeCounter(0);
        setCounters((counters) => [...counters, counter]);
    });
    const removeCounter = action((counter) => {
        setCounters((counters) => counters.filter((_counter) => _counter !== counter));
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
    useObserver();

    return (
        <>
            <p>Total count: {count()}</p>
            <p>Total sum: {sum()}</p>
        </>
    );
};

const CountersList = ({ model }) => {
    useObserver();

    return (
        <div>
            <CounterStats count={model.countersCount} sum={model.countersSum} />
            <button onClick={model.addCounter}>Add</button>
            <button onClick={model.resetAll}>Reset all</button>
            {model.counters().map((counter) => (
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

    useObserver();

    return (
        <div>
            <input onChange={(e) => setText(e.target.value)} value={text()} />
            <button onClick={addTodo} disabled={text().length === 0}>
                Add
            </button>
        </div>
    );
};

const TodoListFilter = ({ model }) => {
    useObserver();

    return (
        <select value={model.filter()} onChange={(e) => model.setFilter(e.target.value)}>
            {FILTER_OPTIONS.map(({ name, value }) => (
                <option key={value} value={value}>
                    {name}
                </option>
            ))}
        </select>
    );
};

const Todo = ({ model }) => {
    useObserver();

    return (
        <div className="todo">
            <label>
                <input type="checkbox" checked={model.done()} onChange={model.toggleDone} />
                <span style={{ textDecoration: model.done() ? "line-through" : "none" }}>
          {model.text()}
        </span>
            </label>
        </div>
    );
};

export const TodoList = ({ model }) => {
    useObserver();

    return (
        <div className="todo-list">
            <button onClick={model.clearDone}>Clear done</button>
            <TodoListFilter model={model} />
            <NewTodoInput model={model} />
            {model.visibleTodos().map((todo) => (
                <Todo key={todo.id} model={todo} />
            ))}
        </div>
    );
};
```

</details>

## Author

Eugene Daragan
