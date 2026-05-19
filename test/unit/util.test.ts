/**
 * Unit tests for util.ts
 *
 * Coverage:
 * - getAllPropertyDescriptors: own props, inherited props, edge cases (null, primitives, built-in prototypes)
 * - isClass: class, function, arrow function, edge cases
 * - shallowEqual: primitives, objects, arrays, null, edge cases
 * - nextTick: callback execution, args passing, abort, microtask ordering
 * - createBatchAction: batching within same tick, separate ticks, abort on re-entry
 */
import { describe, it, expect, vi } from 'vitest'
import {
    getAllPropertyDescriptors,
    isClass,
    shallowEqual,
    nextTick,
    createBatchAction,
} from '../../src/util'

// =============================================================================
// getAllPropertyDescriptors
// =============================================================================
describe('getAllPropertyDescriptors', () => {
    it('returns own property descriptors for a plain object', () => {
        const obj = { a: 1, b: 2 }
        const desc = getAllPropertyDescriptors(obj)
        expect(desc).toHaveProperty('a')
        expect(desc).toHaveProperty('b')
        expect(desc.a.value).toBe(1)
        expect(desc.b.value).toBe(2)
    })

    it('excludes constructor from the result', () => {
        class Foo {
            a = 1
        }
        const foo = new Foo()
        const desc = getAllPropertyDescriptors(foo)
        expect(desc).not.toHaveProperty('constructor')
        expect(desc).toHaveProperty('a')
    })

    it('includes inherited properties from parent class', () => {
        class Base {
            baseProp = 'base'
        }
        class Child extends Base {
            childProp = 'child'
        }
        const child = new Child()
        const desc = getAllPropertyDescriptors(child)
        expect(desc).toHaveProperty('baseProp')
        expect(desc).toHaveProperty('childProp')
        expect(desc).not.toHaveProperty('constructor')
    })

    it('stops at Object.prototype', () => {
        // Use a plain object whose prototype is Object.prototype
        const obj = { a: 1 }
        const desc = getAllPropertyDescriptors(obj)
        // Check own keys only — desc itself inherits toString from Object.prototype
        const ownKeys = Object.keys(desc)
        expect(ownKeys).toContain('a')
        expect(ownKeys).not.toContain('toString')
        expect(ownKeys).not.toContain('hasOwnProperty')
        expect(desc.a.value).toBe(1)
    })

    it('stops at Array.prototype', () => {
        const arr = [1, 2, 3]
        const desc = getAllPropertyDescriptors(arr)
        // Should not include Array.prototype methods like push
        expect(desc).not.toHaveProperty('push')
        expect(desc).not.toHaveProperty('map')
        expect(desc).toHaveProperty('0')
        expect(desc).toHaveProperty('length')
    })

    it('includes getter descriptors', () => {
        const obj = {
            _x: 1,
            get x() { return this._x },
        }
        const desc = getAllPropertyDescriptors(obj)
        expect(desc.x).toBeDefined()
        expect(desc.x.get).toBeInstanceOf(Function)
        expect(desc.x.get!.call(obj)).toBe(1)
    })

    it('handles empty object', () => {
        const desc = getAllPropertyDescriptors({})
        expect(Object.keys(desc).length).toBe(0)
    })

    it('child props override parent props of same name', () => {
        class Base {
            value = 'base'
        }
        class Child extends Base {
            value = 'child'
        }
        const child = new Child()
        const desc = getAllPropertyDescriptors(child)
        expect(desc.value.value).toBe('child')
    })
})

// =============================================================================
// isClass
// =============================================================================
describe('isClass', () => {
    it('returns true for ES6 class', () => {
        class Foo {}
        expect(isClass(Foo)).toBe(true)
    })

    it('returns false for regular function', () => {
        function foo() {}
        expect(isClass(foo)).toBe(false)
    })

    it('returns false for arrow function', () => {
        const foo = () => {}
        expect(isClass(foo)).toBe(false)
    })

    it('returns false for async function', () => {
        async function foo() {}
        expect(isClass(foo)).toBe(false)
    })

    it('returns false for generator function', () => {
        function* foo() {}
        expect(isClass(foo)).toBe(false)
    })

    it('returns false for plain object', () => {
        expect(isClass({} as any)).toBe(false)
    })

    it('throws for null / undefined (no prototype to check)', () => {
        // isClass accesses fn.prototype, which throws on null/undefined
        expect(() => isClass(null as any)).toThrow()
        expect(() => isClass(undefined as any)).toThrow()
    })

    it('returns true for class extending another class', () => {
        class Base {}
        class Child extends Base {}
        expect(isClass(Child)).toBe(true)
    })

    it('returns true for anonymous class', () => {
        const C = class {};
        expect(isClass(C)).toBe(true)
    })
})

// =============================================================================
// shallowEqual
// =============================================================================
describe('shallowEqual', () => {
    describe('primitives', () => {
        it('returns true for identical primitives', () => {
            expect(shallowEqual(1, 1)).toBe(true)
            expect(shallowEqual('hello', 'hello')).toBe(true)
            expect(shallowEqual(true, true)).toBe(true)
        })

        it('returns false for different primitives', () => {
            expect(shallowEqual(1, 2)).toBe(false)
            expect(shallowEqual('a', 'b')).toBe(false)
            expect(shallowEqual(true, false)).toBe(false)
        })

        it('returns false for primitive vs object', () => {
            expect(shallowEqual(1, {})).toBe(false)
            expect(shallowEqual('a', [])).toBe(false)
        })
    })

    describe('null / undefined', () => {
        it('returns true for both null', () => {
            expect(shallowEqual(null, null)).toBe(true)
        })

        it('returns true for both undefined (same ref)', () => {
            expect(shallowEqual(undefined, undefined)).toBe(true)
        })

        it('returns false for null vs undefined', () => {
            expect(shallowEqual(null, undefined)).toBe(false)
        })

        it('returns false for null vs non-null object', () => {
            // shallowEqual(null, obj) works: a===null → return b===null → false
            expect(shallowEqual(null, {})).toBe(false)
            // shallowEqual(obj, null) throws: Object.keys(null)
            // This is a known edge case in the current implementation
            expect(shallowEqual({}, null)).toBe(false)
        })
    })

    describe('objects', () => {
        it('returns true for reference-equal objects', () => {
            const obj = { a: 1 }
            expect(shallowEqual(obj, obj)).toBe(true)
        })

        it('returns true for shallow-equal objects', () => {
            expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
        })

        it('returns false for objects with different values', () => {
            expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false)
        })

        it('returns false for objects with different key counts', () => {
            expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
            expect(shallowEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
        })

        it('returns false for objects with different keys', () => {
            expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false)
        })

        it('returns false for deep inequality (nested objects)', () => {
            expect(shallowEqual({ a: { nested: 1 } }, { a: { nested: 1 } })).toBe(false)
        })

        it('returns true for objects with same keys and primitive values', () => {
            expect(shallowEqual(
                { a: 1, b: 'hello', c: true },
                { a: 1, b: 'hello', c: true },
            )).toBe(true)
        })
    })

    describe('arrays', () => {
        it('returns true for reference-equal arrays', () => {
            const arr = [1, 2, 3]
            expect(shallowEqual(arr, arr)).toBe(true)
        })

        it('returns true for shallow-equal arrays', () => {
            expect(shallowEqual([1, 2, 3], [1, 2, 3])).toBe(true)
        })

        it('returns false for arrays with different values', () => {
            expect(shallowEqual([1, 2], [1, 3])).toBe(false)
        })

        it('returns false for arrays of different lengths', () => {
            expect(shallowEqual([1, 2], [1, 2, 3])).toBe(false)
        })

        it('returns false for array vs object', () => {
            expect(shallowEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
        })

        it('returns false for arrays with nested objects/arrays', () => {
            expect(shallowEqual([[1]], [[1]])).toBe(false)
        })
    })
})

// =============================================================================
// nextTick
// =============================================================================
describe('nextTick', () => {
    it('executes callback in the next microtask', async () => {
        const fn = vi.fn()
        const order: string[] = []

        nextTick(() => {
            fn()
            order.push('tick')
        })
        order.push('sync')

        await new Promise(resolve => setTimeout(resolve, 10))
        expect(fn).toHaveBeenCalledTimes(1)
        expect(order).toEqual(['sync', 'tick'])
    })

    it('passes arguments to callback', async () => {
        const fn = vi.fn()
        nextTick(fn as any, 'arg1', 42 as any)
        await new Promise<void>(resolve => setTimeout(resolve, 50))
        expect(fn).toHaveBeenCalledWith('arg1', 42)
    })

    it('resolves with the first argument', async () => {
        const p = nextTick((x: any) => x, 'result')
        await new Promise<void>(resolve => setTimeout(resolve, 50))
        const value = await p
        expect(value).toBe('result')
    })

    it('abort() prevents callback execution', async () => {
        const fn = vi.fn()
        const p = nextTick(fn)
        p.abort()
        await new Promise(resolve => setTimeout(resolve, 10))
        expect(fn).not.toHaveBeenCalled()
    })

    it('works without callback (just resolves)', async () => {
        const p = nextTick()
        const value = await p
        expect(value).toBeUndefined()
    })

    it('returns AbortablePromise with abort method', () => {
        const p = nextTick(() => {})
        expect(typeof p.abort).toBe('function')
    })
})

// =============================================================================
// createBatchAction
// =============================================================================
describe('createBatchAction', () => {
    it('calls effect once for multiple synchronous action calls', async () => {
        const action = vi.fn()
        const effect = vi.fn()
        const batched = createBatchAction(action, effect)

        batched()
        batched()
        batched()

        expect(action).toHaveBeenCalledTimes(3)
        // effect should not have been called yet (it's in nextTick)
        expect(effect).not.toHaveBeenCalled()

        await new Promise(resolve => setTimeout(resolve, 10))
        expect(effect).toHaveBeenCalledTimes(1)
    })

    it('calls effect once per tick for asynchronous action calls', async () => {
        const effect = vi.fn()
        const batched = createBatchAction(() => {}, effect)

        batched()
        await new Promise(resolve => setTimeout(resolve, 10))
        expect(effect).toHaveBeenCalledTimes(1)

        batched()
        await new Promise(resolve => setTimeout(resolve, 10))
        expect(effect).toHaveBeenCalledTimes(2)
    })

    it('cancels previous pending effect on new call', async () => {
        const effect = vi.fn()
        const batched = createBatchAction(() => {}, effect)

        batched()
        // Second call immediately — should cancel the first pending effect
        batched()

        await new Promise(resolve => setTimeout(resolve, 10))
        expect(effect).toHaveBeenCalledTimes(1)
    })

    it('passes arguments to action', () => {
        const action = vi.fn()
        const batched = createBatchAction(action, () => {})
        batched('a', 'b', 3)
        expect(action).toHaveBeenCalledWith('a', 'b', 3)
    })

    it('preserves this context', () => {
        const ctx = { value: 42 }
        const action = vi.fn(function (this: any) {
            return this.value
        })
        const batched = createBatchAction(action, () => {})
        batched.call(ctx)
        expect(action.mock.results[0]?.value).toBe(42)
    })
})
