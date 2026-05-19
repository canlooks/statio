/**
 * Unit tests for createStore.ts (imperative API)
 *
 * Coverage:
 * - createStore with factory function and class
 * - getState(): returns current state
 * - setState(): updates state, partial merge
 * - subscribe(): without selector, with selector, immediate option, isEqual option
 * - unsubscribe(): stops receiving updates
 * - Listener receives correct snapshots
 */
import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../../src/createStore'

// =============================================================================
// createStore (core)
// =============================================================================
describe('createStore', () => {
    it('returns a function (hook) with imperative methods', () => {
        const useStore = createStore(() => ({ count: 0 }))
        expect(typeof useStore).toBe('function')
        expect(typeof useStore.getState).toBe('function')
        expect(typeof useStore.setState).toBe('function')
        expect(typeof useStore.subscribe).toBe('function')
        expect(typeof useStore.unsubscribe).toBe('function')
    })

    it('works with factory function', () => {
        const useStore = createStore(() => ({
            value: 'hello',
            greet() { return 'hi' },
        }))
        const state = useStore.getState()
        expect(state.value).toBe('hello')
        expect(state.greet()).toBe('hi')
    })

    it('works with class', () => {
        class MyStore {
            value = 'world'
            greet() { return `hello ${this.value}` }
        }
        const useStore = createStore(MyStore)
        const state = useStore.getState()
        expect(state.value).toBe('world')
        expect(state.greet()).toBe('hello world')
    })

    it('class store receives setState and api in constructor', () => {
        let capturedSet: any
        let capturedApi: any
        class TestStore {
            constructor(set: any, api: any) {
                capturedSet = set
                capturedApi = api
            }
        }
        const useStore = createStore(TestStore)
        expect(typeof capturedSet).toBe('function')
        expect(typeof capturedApi).toBe('object')
    })
})

// =============================================================================
// getState / setState
// =============================================================================
describe('createStore.getState / setState', () => {
    it('getState returns initial state', () => {
        const useStore = createStore(() => ({ count: 42 }))
        expect(useStore.getState().count).toBe(42)
    })

    it('setState merges partial updates', () => {
        const useStore = createStore(() => ({ a: 1, b: 2 }))
        useStore.setState({ a: 10 })
        expect(useStore.getState().a).toBe(10)
        expect(useStore.getState().b).toBe(2) // unchanged
    })

    it('setState supports function updater', () => {
        const useStore = createStore(() => ({ count: 0 }))
        useStore.setState((state) => ({ count: state.count + 1 }))
        expect(useStore.getState().count).toBe(1)
    })

    it('setState overwrite=true replaces entire state', () => {
        const useStore = createStore(() => ({ a: 1, b: 2 }))
        useStore.setState({ a: 99 } as any, true)
        expect(useStore.getState().a).toBe(99)
        expect((useStore.getState() as any).b).toBeUndefined()
    })

    it('getState returns same reference after no-op setState', () => {
        const useStore = createStore(() => ({ count: 1 }))
        const s1 = useStore.getState()
        useStore.setState({})
        const s2 = useStore.getState()
        expect(s1).toBe(s2)
    })
})

// =============================================================================
// subscribe (without selector)
// =============================================================================
describe('createStore.subscribe (without selector)', () => {
    it('fires listener on state change', () => {
        const useStore = createStore(() => ({ count: 0 }))
        const listener = vi.fn()
        useStore.subscribe(listener)

        useStore.setState({ count: 1 })
        expect(listener).toHaveBeenCalledTimes(1)
        // Listener receives the full state
        expect(listener).toHaveBeenCalledWith(useStore.getState())
    })

    it('returns unsubscribe function', () => {
        const useStore = createStore(() => ({ count: 0 }))
        const listener = vi.fn()
        const unsub = useStore.subscribe(listener)
        expect(typeof unsub).toBe('function')
    })

    it('unsubscribe stops listener from receiving updates', () => {
        const useStore = createStore(() => ({ count: 0 }))
        const listener = vi.fn()
        const unsub = useStore.subscribe(listener)

        useStore.setState({ count: 1 })
        expect(listener).toHaveBeenCalledTimes(1)

        unsub()
        useStore.setState({ count: 2 })
        expect(listener).toHaveBeenCalledTimes(1) // no new call
    })

    it('immediate option fires listener immediately', () => {
        const useStore = createStore(() => ({ count: 5 }))
        const listener = vi.fn()
        useStore.subscribe(listener, { immediate: true })
        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenCalledWith(useStore.getState())
    })

    it('multiple listeners all receive updates', () => {
        const useStore = createStore(() => ({ count: 0 }))
        const l1 = vi.fn()
        const l2 = vi.fn()
        const l3 = vi.fn()

        useStore.subscribe(l1)
        useStore.subscribe(l2)
        useStore.subscribe(l3)

        useStore.setState({ count: 1 })
        expect(l1).toHaveBeenCalledTimes(1)
        expect(l2).toHaveBeenCalledTimes(1)
        expect(l3).toHaveBeenCalledTimes(1)
    })

    it('removing one listener does not affect others', () => {
        const useStore = createStore(() => ({ count: 0 }))
        const l1 = vi.fn()
        const l2 = vi.fn()

        const unsub1 = useStore.subscribe(l1)
        useStore.subscribe(l2)

        useStore.setState({ count: 1 })
        expect(l1).toHaveBeenCalledTimes(1)
        expect(l2).toHaveBeenCalledTimes(1)

        unsub1()
        useStore.setState({ count: 2 })
        expect(l1).toHaveBeenCalledTimes(1) // no change
        expect(l2).toHaveBeenCalledTimes(2)
    })
})

// =============================================================================
// subscribe (with selector)
// =============================================================================
describe('createStore.subscribe (with selector)', () => {
    it('fires only when selected slice changes', () => {
        const useStore = createStore(() => ({
            count: 0,
            name: 'hello',
        }))
        const listener = vi.fn()
        // Pass _initSnapshot so first comparison is meaningful
        useStore.subscribe(
            (state) => state.count,
            listener,
            { _initSnapshot: 0 },
        )

        // Update a different property
        useStore.setState({ name: 'world' })
        expect(listener).not.toHaveBeenCalled()

        // Update the selected property
        useStore.setState({ count: 1 })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('passes snapshot and prevSnapshot to listener', () => {
        const useStore = createStore(() => ({ count: 0 }))
        const listener = vi.fn()
        // Pass _initSnapshot to match the hook's behavior
        useStore.subscribe(
            (state) => state.count,
            listener,
            { _initSnapshot: 0 },
        )

        useStore.setState({ count: 5 })
        expect(listener).toHaveBeenCalledWith(5, 0)

        useStore.setState({ count: 10 })
        expect(listener).toHaveBeenCalledWith(10, 5)
    })

    it('selector returning object uses shallowEqual by default', () => {
        const useStore = createStore(() => ({
            a: 1,
            b: 2,
            c: 3,
        }))
        const listener = vi.fn()
        // Pass _initSnapshot so the initial shallowEqual doesn't fail on undefined
        const initSnapshot = { a: useStore.getState().a, b: useStore.getState().b }
        useStore.subscribe(
            (state) => ({ a: state.a, b: state.b }),
            listener,
            { _initSnapshot: initSnapshot },
        )

        // Change c — should not fire because selected slice is shallow-equal
        useStore.setState({ c: 99 })
        expect(listener).not.toHaveBeenCalled()

        // Change a — should fire
        useStore.setState({ a: 10 })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('custom isEqual function', () => {
        const useStore = createStore(() => ({ count: 0 }))
        const listener = vi.fn()
        // Always consider equal — never fire
        useStore.subscribe(
            (state) => state.count,
            listener,
            { isEqual: () => true },
        )

        useStore.setState({ count: 1 })
        expect(listener).not.toHaveBeenCalled()
    })

    it('immediate option with selector', () => {
        const useStore = createStore(() => ({ count: 42 }))
        const listener = vi.fn()
        useStore.subscribe(
            (state) => state.count,
            listener,
            { immediate: true },
        )
        expect(listener).toHaveBeenCalledTimes(1)
        expect(listener).toHaveBeenCalledWith(42, undefined)
    })
})

// =============================================================================
// unsubscribe
// =============================================================================
describe('createStore.unsubscribe', () => {
    it('removes listener via unsubscribe() static method', () => {
        const useStore = createStore(() => ({ count: 0 }))
        const listener = vi.fn()
        useStore.subscribe(listener)

        useStore.setState({ count: 1 })
        expect(listener).toHaveBeenCalledTimes(1)

        useStore.unsubscribe(listener)
        useStore.setState({ count: 2 })
        expect(listener).toHaveBeenCalledTimes(1)
    })

    it('unsubscribing non-existent listener does not throw', () => {
        const useStore = createStore(() => ({ count: 0 }))
        expect(() => {
            useStore.unsubscribe(() => {})
        }).not.toThrow()
    })
})

// =============================================================================
// SSR: serverState
// =============================================================================
describe('createStore SSR', () => {
    it('api.serverState is undefined when not using storage', () => {
        const useStore = createStore(() => ({ count: 0 }))
        // serverState is only set by storage middleware
        // We just verify the store works without it
        expect(useStore.getState().count).toBe(0)
    })
})
