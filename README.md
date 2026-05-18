# @canlooks/statio

A lightweight, TypeScript-first state management library for React. Built on top of React's `useSyncExternalStore`, Statio provides a minimal yet powerful API with first-class support for **class-based stores**, **computed properties**, **persistence**, and **SSR** — all without boilerplate.

## Features

- **Dual store creation** — factory functions *or* ES6 classes, whichever fits your style
- **Automatic method binding** — `this` in your store methods always points to the current state
- **Computed properties** — memoized derived values that only recalculate when dependencies change
- **Selective re-rendering** — components only update when the slice of state they consume changes
- **Built-in persistence** — `localStorage` / `sessionStorage` support with a single wrapper, customizable storage adapter
- **SSR-ready** — separate `serverState` for hydration, works with Next.js
- **Outside-React access** — read, write, and subscribe to state from anywhere
- **Tiny footprint** — zero dependencies beyond `tslib`

## Installation

```bash
npm i @canlooks/statio
```

## Quick Start

### Creating a Store

Statio supports two patterns for defining a store. Choose the one you prefer — they have identical runtime behavior.

#### Factory Function

```ts
import { createStore } from '@canlooks/statio'

interface CounterStore {
  unused: string
  count: number
  increase(): void
}

const useCounterStore = createStore<CounterStore>((set) => ({
  unused: 'unused property',
  count: 1,
  increase() {
    set({ count: this.count + 1 })
  },
}))
```

#### Class

```ts
import { createStore, type SetStateMethod } from '@canlooks/statio'

class CounterStore {
  unused = 'unused property'
  count = 1

  constructor(private set: SetStateMethod<CounterStore>) {}

  increase() {
    this.set({ count: this.count + 1 })
  }
}

const useCounterStore = createStore(CounterStore)
```

### Using the Store in Components

```tsx
function Counter() {
  const { count, increase } = useCounterStore()

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={increase}>+1</button>
    </div>
  )
}
```

### Selective Re-rendering with Selectors

Without a selector, the component re-renders on *any* state change. Use a selector function to subscribe to a specific slice:

```tsx
function Counter() {
  // Only re-renders when `count` changes.
  // `unused` and `increase` are ignored by the diff.
  const { count, increase } = useCounterStore((state) => ({
    count: state.count,
    increase: state.increase,
  }))

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={increase}>+1</button>
    </div>
  )
}
```

**Key-based selector** (syntactic sugar):

```tsx
function Counter() {
  // Equivalent to: (s) => ({ count: s.count, increase: s.increase })
  const { count, increase } = useCounterStore('count', 'increase')

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={increase}>+1</button>
    </div>
  )
}
```

> **How it works**: selectors use `shallowEqual` by default for object results. You can override equality checks by passing a custom `isEqual` function as the second argument to the selector form.

---

## Advanced Features

### Computed (Derived) Properties

Statio provides a `compute` API for memoized derived values. A computed property only re-evaluates when its declared dependencies change.

```ts
import { createStore, type SetStateMethod, type StoreApi } from '@canlooks/statio'

interface ProductStore {
  items: { name: string; price: number }[]
  readonly totalPrice: number
  readonly itemCount: number
  addItem(item: { name: string; price: number }): void
}

const useProductStore = createStore<ProductStore>((set, api) => ({
  items: [],
  get totalPrice() {
    return api.compute(() => {
      return this.items.reduce((sum, i) => sum + i.price, 0)
    }, [this.items])
  },
  get itemCount() {
    return api.compute(() => this.items.length, [this.items])
  },
  addItem(item) {
    set({ items: [...this.items, item] })
  },
}))
```

With a class store:

```ts
class ProductStore {
  items: { name: string; price: number }[] = []

  constructor(
    private set: SetStateMethod<ProductStore>,
    private api: StoreApi<ProductStore>,
  ) {}

  get totalPrice() {
    return this.api.compute(() => {
      return this.items.reduce((sum, i) => sum + i.price, 0)
    }, [this.items])
  }

  get itemCount() {
    return this.api.compute(() => this.items.length, [this.items])
  }

  addItem(item: { name: string; price: number }) {
    this.set({ items: [...this.items, item] })
  }
}
```

**Important**: `compute()` only works inside a getter property. Calling it elsewhere will throw an error.

### Persistence (`storage`)

Wrap any store factory with `storage()` to automatically persist state to `localStorage` or `sessionStorage`:

```ts
import { createStore, storage } from '@canlooks/statio'

const useSettingsStore = createStore(
  storage(
    (set) => ({
      theme: 'light' as 'light' | 'dark',
      fontSize: 14,
      setTheme(theme: 'light' | 'dark') {
        set({ theme })
      },
    }),
    { name: 'app-settings' },
  ),
)
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | `string` | *required* | Storage key |
| `type` | `'localStorage' \| 'sessionStorage'` | `'localStorage'` | Storage backend |
| `selector` | `(state: S) => T` | auto-selects non-function, non-Api properties | Custom serialization selector |
| `adapter` | `{ getItem, setItem }` | `window[type]` | Custom storage adapter (e.g., AsyncStorage for React Native) |

**How it works:**

- The default `selector` automatically picks all non-function properties to persist
- Writes are **batched** — multiple synchronous `set()` calls in the same tick trigger only one storage write
- On initialization, previously persisted data is merged into the initial state

**Custom adapter example:**

```ts
storage(MyStore, {
  name: 'my-store',
  adapter: {
    getItem(key) { return AsyncStorage.getItem(key) },
    setItem(key, value) { AsyncStorage.setItem(key, value) },
  },
})
```

### Accessing State Outside React

The `useStore` hook exposes additional methods for imperative use:

```ts
// Read current state without subscribing
const currentState = useCounterStore.getState()

// Update state from outside a component
useCounterStore.setState({ count: 99 })

// Subscribe to changes (returns unsubscribe function)
const unsub = useCounterStore.subscribe((state) => {
  console.log('State changed:', state)
})

// Subscribe with a selector
const unsub = useCounterStore.subscribe(
  (state) => state.count,
  (count, prevCount) => {
    console.log(`Count: ${prevCount} → ${count}`)
  },
)

// Stop listening
useCounterStore.unsubscribe(listener)
```

### Server-Side Rendering (SSR)

Statio is SSR-compatible. The `storage()` middleware sets `api.serverState` to the initial state snapshot, which is used as the third argument to `useSyncExternalStore` for proper hydration.

When using Next.js App Router with a persisted store:

```tsx
// stores/counter.ts
import { createStore, storage } from '@canlooks/statio'

class CounterStore {
  count = 0
  // ...
}

export const useCounterStore = createStore(
  storage(CounterStore, { name: 'counter' }),
)
```

```tsx
// app/page.tsx
'use client'

import { useCounterStore } from '@/stores/counter'

export default function Page() {
  const { count } = useCounterStore('count')
  return <div>{count}</div>
}
```

### Batching Updates

Multiple synchronous `set()` calls are automatically batched by React 18's automatic batching. For external usage, Statio provides `createBatchAction`:

```ts
import { createBatchAction } from '@canlooks/statio'

const batchedSet = createBatchAction(
  useCounterStore.setState,
  () => console.log('All updates applied'),
)

// These two calls trigger the effect only once
batchedSet({ count: 1 })
batchedSet({ count: 2 })
```

---

## API Reference

### `createStore(factory)`

```ts
function createStore<S extends object>(
  factory: StoreFactory<S> | StoreClass<S>
): UseStoreHook<S>
```

Creates a store and returns a `useStore` hook. The factory receives two arguments:

| Parameter | Type | Description |
|-----------|------|-------------|
| `set` | `SetStateMethod<S>` | Update state (partial or updater function) |
| `api` | `StoreApi<S>` | Store API (state, getState, compute, etc.) |

**Returned hook signatures:**

```ts
// Subscribe to entire state (re-renders on any change)
useStore(): S

// Subscribe to specific keys (shorthand selector)
useStore(...keys: (keyof S)[]): Pick<S, typeof keys[number]>

// Subscribe with a custom selector
useStore<T>(selector: (state: S) => T, isEqual?: IsEqual<T>): T

// Imperative methods attached to the hook
useStore.getState(): S
useStore.setState: SetStateMethod<S>
useStore.subscribe(...): () => void
useStore.unsubscribe(listener: Function): void
```

### `SetStateMethod<S>`

```ts
type SetStateMethod<S> = (
  state: Partial<S> | ((state: S) => Partial<S>),
  overwrite?: boolean,
) => void
```

- **Partial update** (default): merges the provided partial into existing state via `Object.assign`
- **Updater function**: receives current state, returns a partial to merge
- **Overwrite mode** (`overwrite = true`): replaces the entire state object and re-binds methods/computed properties. Use sparingly — typically only for hydration

### `StoreApi<S>`

Passed as the second argument to store factories/constructors:

```ts
class StoreApi<S> {
  state: S             // Current state object
  serverState?: S      // Server-side snapshot (for SSR, set by storage middleware)
  setState: SetStateMethod<S>
  getState(): S
  compute: Compute      // Memoized derived value helper
  computable: Computable<S>
}
```

### `storage(factory, options)`

```ts
function storage<S extends object>(
  factory: StoreFactory<S> | StoreClass<S>,
  options: StorageOptions<S>,
): StoreFactory<S>
```

Wraps a store factory with persistence. Returns a new factory to pass to `createStore`.

**`StorageOptions<S>`:**

```ts
type StorageOptions<S> = {
  name: string
  type?: 'localStorage' | 'sessionStorage'        // default: 'localStorage'
  selector?<T = S>(state: S): T                    // custom serialization
  adapter?: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  }
}
```

### `compute` / `Computable`

```ts
type Compute = <T>(factory: () => T, deps: any[]) => T
```

The `api.compute()` method memoizes a computation based on a dependency array. It uses `shallowEqual` to compare deps — if they haven't changed since the last call, the cached result is returned immediately.

Must be called inside a getter property. Each getter gets its own independent memoization cache.

### Utility Functions

#### `shallowEqual(a, b)`

```ts
function shallowEqual(a: any, b: any): boolean
```

Performs a shallow equality check. Used internally for selector comparison and compute dependency diffing.

#### `nextTick(callback?, ...args)`

```ts
function nextTick<T>(callback?: (...args: T[]) => void, ...args: T[]): AbortablePromise<T>
```

Schedules a callback for the next microtask (using `queueMicrotask`). Returns an abortable promise — call `.abort()` to cancel.

#### `createBatchAction(action, effect)`

```ts
function createBatchAction<T extends (...a: any[]) => any>(
  action: T,
  effect: () => any,
): T
```

Wraps an action function so that multiple synchronous invocations only trigger the `effect` once (on the next microtask). Used internally by `storage()` to debounce writes.

#### `isClass(fn)`

```ts
function isClass(fn: Function): fn is StoreClass
```

Type guard that checks whether a function is an ES6 class constructor.

#### `getAllPropertyDescriptors(o)`

```ts
function getAllPropertyDescriptors(o: any): { [p: PropertyKey]: PropertyDescriptor }
```

Returns all property descriptors of an object, including those inherited from prototype chain (stops at `Object.prototype`, `Array.prototype`, and `Function.prototype`).

---

## TypeScript

Statio is written in TypeScript and provides first-class type inference. Store state is fully typed:

```ts
interface TodoStore {
  todos: { id: number; text: string; done: boolean }[]
  readonly activeCount: number
  addTodo(text: string): void
  toggleTodo(id: number): void
}

// Full type safety — IDE autocompletion on all state properties and methods
const useTodoStore = createStore<TodoStore>((set, api) => ({
  todos: [],
  get activeCount() {
    return api.compute(() => this.todos.filter(t => !t.done).length, [this.todos])
  },
  addTodo(text) {
    set({ todos: [...this.todos, { id: Date.now(), text, done: false }] })
  },
  toggleTodo(id) {
    set({
      todos: this.todos.map(t =>
        t.id === id ? { ...t, done: !t.done } : t
      ),
    })
  },
}))
```

Selectors are also fully typed — the return type is inferred from the selector function.

---

## License

MIT
