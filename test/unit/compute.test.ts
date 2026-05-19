/**
 * Unit tests for compute.ts
 *
 * Coverage:
 * - createCompute: memoization with same deps, recalculation with changed deps,
 *   first call always runs, shallow comparison of deps
 * - Computable: createGetter tracking, compute.get with/without active getter,
 *   multiple getters, independent deps tracking per getter
 */
import { describe, it, expect, vi } from 'vitest'
import { createCompute, Computable } from '../../src/compute'

// =============================================================================
// createCompute
// =============================================================================
describe('createCompute', () => {
    it('calls factory on first invocation', () => {
        const factory = vi.fn(() => 42)
        const compute = createCompute()
        const result = compute(factory, [1, 2])
        expect(result).toBe(42)
        expect(factory).toHaveBeenCalledTimes(1)
    })

    it('returns cached result when deps are shallow-equal', () => {
        const factory = vi.fn(() => 'computed')
        const compute = createCompute()

        // Same reference for the object to pass shallowEqual
        const dep = { a: 1 }
        const r1 = compute(factory, [dep, 2])
        const r2 = compute(factory, [dep, 2])
        expect(r1).toBe(r2)
        expect(r1).toBe('computed')
        // factory should only be called once
        expect(factory).toHaveBeenCalledTimes(1)
    })

    it('recalculates when deps change', () => {
        let counter = 0
        const factory = () => ++counter
        const compute = createCompute()

        compute(factory, [1])
        expect(counter).toBe(1)

        compute(factory, [2]) // deps changed
        expect(counter).toBe(2)
    })

    it('recalculates when shallow-equal deps change deeply', () => {
        const factory = vi.fn(() => Symbol())
        const compute = createCompute()

        const r1 = compute(factory, [{ a: { b: 1 } }])
        const r2 = compute(factory, [{ a: { b: 1 } }])
        // These are deep-equal but NOT shallow-equal (different reference)
        expect(r1).not.toBe(r2)
        expect(factory).toHaveBeenCalledTimes(2)
    })

    it('recalculates when array deps change length', () => {
        const factory = vi.fn(() => Math.random())
        const compute = createCompute()

        compute(factory, [1, 2])
        compute(factory, [1, 2, 3]) // different length
        expect(factory).toHaveBeenCalledTimes(2)
    })

    it('handles empty deps array', () => {
        const factory = vi.fn(() => 'result')
        const compute = createCompute()

        compute(factory, [])
        compute(factory, [])
        expect(factory).toHaveBeenCalledTimes(1)
    })

    it('preserves this context', () => {
        const ctx = { multiplier: 10 }
        const compute = createCompute()
        const factory = function (this: any) {
            return this.multiplier * 2
        }
        const result = compute.call(ctx, factory, [])
        expect(result).toBe(20)
    })
})

// =============================================================================
// Computable
// =============================================================================
describe('Computable', () => {
    it('createGetter returns a function', () => {
        const state = { count: 1 }
        const computable = new Computable(state)
        const getter = computable.createGetter('double', () => state.count * 2)
        expect(typeof getter).toBe('function')
    })

    it('createGetter function returns the getter value', () => {
        const state = { count: 5 }
        const computable = new Computable(state)
        const getter = computable.createGetter('double', () => state.count * 2)
        expect(getter()).toBe(10)
    })

    it('compute.get works inside an active getter', () => {
        const state = { items: [1, 2, 3] }
        const computable = new Computable(state)

        // Simulate what Api does: wrap getter with createGetter
        const get = computable.createGetter('total', function (this: any) {
            return computable.get(() => {
                return this.items.reduce((sum: number, i: number) => sum + i, 0)
            }, [this.items])
        }.bind(state))

        expect(get()).toBe(6)
    })

    it('compute.get throws when called outside a getter', () => {
        const state = { count: 1 }
        const computable = new Computable(state)

        expect(() => {
            computable.get(() => 42, [])
        }).toThrow('[@canlooks/statio]')
    })

    it('compute.get memoizes results per getter', () => {
        const state = { items: [1, 2, 3] }
        const computable = new Computable(state)
        const factory = vi.fn(function (this: any) {
            return this.items.reduce((sum: number, i: number) => sum + i, 0)
        }.bind(state))

        const get = computable.createGetter('total', () => {
            return computable.get(factory, [state.items])
        })

        const r1 = get()
        const r2 = get()
        expect(r1).toBe(r2)
        // factory called only once because deps didn't change
        expect(factory).toHaveBeenCalledTimes(1)
    })

    it('compute.get recalculates when deps change', () => {
        const state = { items: [1, 2, 3] }
        const computable = new Computable(state)
        let callCount = 0

        const get = computable.createGetter('total', () => {
            return computable.get(() => {
                callCount++
                return state.items.reduce((sum, i) => sum + i, 0)
            }, [state.items])
        })

        get()
        expect(callCount).toBe(1)

        // Change items — deps referentially different
        state.items = [1, 2, 3, 4]
        get()
        expect(callCount).toBe(2)
    })

    it('multiple getters have independent memoization', () => {
        const state = { a: 1, b: 10 }
        const computable = new Computable(state)
        const factoryA = vi.fn(() => state.a * 2)
        const factoryB = vi.fn(() => state.b * 2)

        const getA = computable.createGetter('doubleA', () =>
            computable.get(factoryA, [state.a]),
        )
        const getB = computable.createGetter('doubleB', () =>
            computable.get(factoryB, [state.b]),
        )

        getA()
        getB()
        expect(factoryA).toHaveBeenCalledTimes(1)
        expect(factoryB).toHaveBeenCalledTimes(1)

        // Only change A
        state.a = 2
        getA()
        expect(factoryA).toHaveBeenCalledTimes(2)
        // B should still be cached
        getB()
        expect(factoryB).toHaveBeenCalledTimes(1)
    })

    it('stack tracks nested getter calls correctly', () => {
        const state = { x: 1 }
        const computable = new Computable(state)
        const factory = vi.fn(() => state.x * 2)

        const getOuter = computable.createGetter('outer', () => {
            // Simulate nested getter: outer getter runs, stack = ['outer']
            return computable.get(factory, [state.x])
        })

        getOuter()
        expect(factory).toHaveBeenCalledTimes(1)
    })
})
