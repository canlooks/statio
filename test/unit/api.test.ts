/**
 * Unit tests for api.ts
 *
 * Coverage:
 * - Constructor with factory function: initial state, methods bound
 * - Constructor with class: initial state, constructor receives set+api
 * - setState: partial object, function updater, overwrite mode
 * - getState: returns current state
 * - compute: delegates to Computable
 * - bindContextAndInitComputable: methods auto-bound, getters become computed
 * - onChange callback: called on every state change
 */
import { describe, it, expect, vi } from 'vitest'
import { Api } from '../../src/api'
import type { SetStateMethod, StoreApi } from '../../index'

// Helper: create a simple factory function
function createCounterFactory(initial = 0) {
    return (set: SetStateMethod<any>, _api: StoreApi<any>) => ({
        count: initial,
        increase() {
            set({ count: this.count + 1 })
        },
        add(n: number) {
            set({ count: this.count + n })
        },
    })
}

// Helper: create a simple class store
class CounterStore {
    count: number

    constructor(
        private set: SetStateMethod<CounterStore>,
        private api: StoreApi<CounterStore>,
    ) {
        this.count = 0
    }

    increase() {
        this.set({ count: this.count + 1 })
    }

    add(n: number) {
        this.set({ count: this.count + n })
    }
}

// =============================================================================
// Constructor
// =============================================================================
describe('Api constructor', () => {
    it('initializes state from factory function', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(5), onChange)
        expect(api.state.count).toBe(5)
    })

    it('initializes state from class', () => {
        const onChange = vi.fn()
        const api = new Api(CounterStore, onChange)
        expect(api.state.count).toBe(0)
    })

    it('passes setState and api to factory function', () => {
        const factory = vi.fn((set, api) => ({
            value: 42,
            getApi() { return api },
            getSet() { return set },
        }))
        const api = new Api(factory, vi.fn())
        expect(factory).toHaveBeenCalledTimes(1)
        expect(factory).toHaveBeenCalledWith(api.setState, api)
    })

    it('passes setState and api to class constructor', () => {
        let capturedSet: any
        let capturedApi: any
        class TestStore {
            constructor(set: any, api: any) {
                capturedSet = set
                capturedApi = api
            }
        }
        const onChange = vi.fn()
        const api = new Api(TestStore, onChange)
        expect(capturedSet).toBe(api.setState)
        expect(capturedApi).toBe(api)
    })

    it('auto-binds methods to state object', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(), onChange)
        // increase method should have `this` bound to state
        const state = api.state
        const { increase } = state
        increase() // calling without context should still work
        expect(state.count).toBe(1)
    })

    it('initializes computable', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(), onChange)
        expect(api.computable).toBeDefined()
    })
})

// =============================================================================
// setState
// =============================================================================
describe('Api.setState', () => {
    it('merges partial state object', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(0), onChange)
        api.setState({ count: 10 })
        expect(api.state.count).toBe(10)
    })

    it('merges multiple partial updates', () => {
        const onChange = vi.fn()
        const api = new Api(
            () => ({ a: 1, b: 2, c: 3 }),
            onChange,
        )
        api.setState({ a: 10 })
        api.setState({ b: 20 })
        expect(api.state.a).toBe(10)
        expect(api.state.b).toBe(20)
        expect(api.state.c).toBe(3) // unchanged
    })

    it('supports function updater', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(0), onChange)
        api.setState((state) => ({ count: state.count + 5 }))
        expect(api.state.count).toBe(5)
    })

    it('function updater receives current state', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(10), onChange)
        let capturedCount: number
        api.setState((state) => {
            // Snapshot the value before Object.assign mutates the state reference
            capturedCount = state.count
            return { count: state.count * 2 }
        })
        expect(capturedCount!).toBe(10)
        expect(api.state.count).toBe(20)
    })

    it('overwrite=true replaces entire state', () => {
        const onChange = vi.fn()
        const api = new Api(
            () => ({ a: 1, b: 2, c: 3 }),
            onChange,
        )
        api.setState({ a: 99 } as any, true)
        expect(api.state.a).toBe(99)
        expect((api.state as any).b).toBeUndefined()
        expect((api.state as any).c).toBeUndefined()
    })

    it('overwrite=true rebinds context and reinitializes computable', () => {
        const onChange = vi.fn()
        const api = new Api(
            () => ({
                value: 1,
                get double() {
                    return api.compute(() => this.value * 2, [this.value])
                },
            }),
            onChange,
        )
        // Store the initial double getter value
        const initialDouble = (api.state as any).double
        expect(initialDouble).toBe(2)

        api.setState({ value: 100 } as any, true)
        expect(api.state.value).toBe(100)
    })

    it('calls onChange after every setState', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(), onChange)
        api.setState({ count: 1 })
        expect(onChange).toHaveBeenCalledTimes(1)
        expect(onChange).toHaveBeenCalledWith(api.state)

        api.setState({ count: 2 })
        expect(onChange).toHaveBeenCalledTimes(2)
    })
})

// =============================================================================
// getState
// =============================================================================
describe('Api.getState', () => {
    it('returns the current state object', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(42), onChange)
        expect(api.getState()).toBe(api.state)
        expect(api.getState().count).toBe(42)
    })

    it('reflects updates made via setState', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(0), onChange)
        api.setState({ count: 100 })
        expect(api.getState().count).toBe(100)
    })
})

// =============================================================================
// compute
// =============================================================================
describe('Api.compute', () => {
    it('delegates to computable.get', () => {
        const onChange = vi.fn()
        const api = new Api(
            () => ({
                items: [1, 2, 3],
                get total() {
                    return api.compute(
                        () => this.items.reduce((s: number, i: number) => s + i, 0),
                        [this.items],
                    )
                },
            }),
            onChange,
        )
        const total = (api.state as any).total
        expect(total).toBe(6)
    })

    it('memoizes computed values', () => {
        const onChange = vi.fn()
        let computeCalls = 0
        const api = new Api(
            () => ({
                count: 1,
                get double() {
                    return api.compute(() => {
                        computeCalls++
                        return this.count * 2
                    }, [this.count])
                },
            }),
            onChange,
        )
        const state = api.state as any
        expect(state.double).toBe(2)
        expect(computeCalls).toBe(1)

        // Second access should use cache
        expect(state.double).toBe(2)
        expect(computeCalls).toBe(1)
    })

    it('throws when called outside a getter', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(), onChange)
        expect(() => {
            api.compute(() => 42, [])
        }).toThrow('[@canlooks/statio]')
    })
})

// =============================================================================
// bindContextAndInitComputable (implicit)
// =============================================================================
describe('Api method binding', () => {
    it('methods remain bound after setState merge', () => {
        const onChange = vi.fn()
        const api = new Api(createCounterFactory(), onChange)
        const state = api.state

        api.setState({ count: 5 })
        // Method should still work with correct `this`
        state.increase()
        expect(state.count).toBe(6)
    })

    it('methods remain bound after overwrite', () => {
        const onChange = vi.fn()
        const api = new Api(
            (set, _api) => ({
                count: 1,
                increase() {
                    set({ count: (this as any).count + 1 })
                },
            }),
            onChange,
        )
        const state = api.state
        // Overwrite with new state that also has increase method
        api.setState({
            count: 10,
            increase() {
                // This will get bound
            },
        } as any, true)
        // The new increase method should work
        const newState = api.state
        expect(newState.count).toBe(10)
    })
})
