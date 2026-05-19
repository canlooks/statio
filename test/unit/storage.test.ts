/**
 * Unit tests for storage.ts
 *
 * Coverage:
 * - Basic persistence with localStorage mock
 * - Custom adapter
 * - Default selector (excludes functions, includes data properties)
 * - Custom selector
 * - Batch writes (createBatchAction)
 * - Load persisted data on initialization
 * - serverState set correctly for SSR
 * - JSON parse error handling (graceful degradation)
 * - Class-based store with storage
 */
import { describe, it, expect, vi } from 'vitest'
import { storage } from '../../src/storage'
import type { SetStateMethod, StoreApi } from '../../index'

// Create a minimal mock storage adapter
function createMockStorage() {
    const store: Record<string, string> = {}
    return {
        store,
        getItem: vi.fn((key: string) => store[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value
        }),
    }
}

// Helper: create a mock set + api that properly tracks state.
// The key insight: the factory returns a new state object, and getState()
// must return that same object. We create the mockApi first, then after
// the factory runs, we wire up the returned state to mockApi.state.
function setupStoreWithStorage(factory: any, options: any) {
    const adapter = createMockStorage()
    const storageFactory = storage(factory, { ...options, adapter })

    const mockApi: any = {
        state: undefined as any,
        getState: function (this: any) { return this.state },
        serverState: undefined,
    }
    const mockSet: SetStateMethod<any> = (action: any, overwrite?: boolean) => {
        const s = mockApi.state
        const newState = typeof action === 'function' ? action(s) : action
        if (overwrite) {
            for (const k of Object.keys(s)) {
                if (!(k in newState)) delete s[k]
            }
        }
        Object.assign(s, newState)
    }
    const state = storageFactory(mockSet, mockApi)
    mockApi.state = state
    return { state, mockApi, adapter }
}

// Helper: factory function for settings
function createSettingsFactory() {
    return (set: SetStateMethod<any>, _api: StoreApi<any>) => ({
        theme: 'light' as string,
        fontSize: 14 as number,
        setTheme(theme: string) {
            set({ theme })
        },
        setFontSize(size: number) {
            set({ fontSize: size })
        },
    })
}

// Helper: class-based store
class SettingsStore {
    theme = 'light'
    fontSize = 14

    constructor(
        private set: SetStateMethod<SettingsStore>,
        private api: StoreApi<SettingsStore>,
    ) {}

    setTheme(theme: string) {
        this.set({ theme })
    }

    setFontSize(size: number) {
        this.set({ fontSize: size })
    }
}

// =============================================================================
// storage wrapper returns StoreFactory
// =============================================================================
describe('storage', () => {
    it('returns a StoreFactory function', () => {
        const factory = storage(createSettingsFactory(), {
            name: 'test',
            adapter: createMockStorage(),
        })
        expect(typeof factory).toBe('function')
    })

    it('invoked factory returns state with initial values', () => {
        const { state } = setupStoreWithStorage(createSettingsFactory(), {
            name: 'test-init',
        })
        expect(state.theme).toBe('light')
        expect(state.fontSize).toBe(14)
    })

    it('works with class-based store', () => {
        const { state } = setupStoreWithStorage(SettingsStore, {
            name: 'test-class',
        })
        expect(state.theme).toBe('light')
        expect(state.fontSize).toBe(14)
        expect(typeof state.setTheme).toBe('function')
    })
})

// =============================================================================
// Default selector behavior
// =============================================================================
describe('storage default selector', () => {
    it('persists non-function properties', async () => {
        const { state, adapter } = setupStoreWithStorage(createSettingsFactory(), {
            name: 'default-selector',
        })

        state.setTheme('dark')
        await new Promise(resolve => setTimeout(resolve, 50))

        expect(adapter.setItem).toHaveBeenCalled()
        const savedValue = JSON.parse(adapter.setItem.mock.calls[0]?.[1] ?? '{}')
        expect(savedValue).toHaveProperty('theme')
        expect(savedValue).toHaveProperty('fontSize')
        expect(savedValue).not.toHaveProperty('setTheme')
        expect(savedValue).not.toHaveProperty('setFontSize')
    })
})

// =============================================================================
// Load persisted data
// =============================================================================
describe('storage load persisted data', () => {
    it('merges persisted data into initial state', () => {
        const adapter = createMockStorage()
        adapter.store['persisted-store'] = JSON.stringify({
            theme: 'dark',
            fontSize: 20,
        })

        const storageFactory = storage(createSettingsFactory(), {
            name: 'persisted-store',
            adapter,
        })
        const mockApi: any = {
            state: undefined as any,
            getState: function (this: any) { return this.state },
            serverState: undefined,
        }
        const mockSet: SetStateMethod<any> = (action: any) => {
            const s = mockApi.state
            const newState = typeof action === 'function' ? action(s) : action
            Object.assign(s, newState)
        }
        const state = storageFactory(mockSet, mockApi)
        mockApi.state = state

        expect(state.theme).toBe('dark')
        expect(state.fontSize).toBe(20)
    })

    it('handles missing persisted data gracefully', () => {
        const { state } = setupStoreWithStorage(createSettingsFactory(), {
            name: 'new-store',
        })
        expect(state.theme).toBe('light')
        expect(state.fontSize).toBe(14)
    })

    it('handles invalid JSON gracefully', () => {
        const adapter = createMockStorage()
        adapter.store['broken-store'] = '{invalid json!!!'

        const storageFactory = storage(createSettingsFactory(), {
            name: 'broken-store',
            adapter,
        })
        const mockApi: any = {
            state: undefined as any,
            getState: function (this: any) { return this.state },
            serverState: undefined,
        }
        const mockSet: SetStateMethod<any> = (action: any) => {
            const s = mockApi.state
            Object.assign(s, typeof action === 'function' ? action(s) : action)
        }
        expect(() => {
            const state = storageFactory(mockSet, mockApi)
            mockApi.state = state
        }).not.toThrow()
    })
})

// =============================================================================
// Custom selector
// =============================================================================
describe('storage custom selector', () => {
    it('uses custom selector for persistence', async () => {
        const adapter = createMockStorage()
        const customFactory = (set: SetStateMethod<any>) => ({
            a: 1,
            b: 2,
            c: 3,
            updateA(v: number) {
                set({ a: v })
            },
        })
        const storageFactory = storage(customFactory, {
            name: 'custom-selector',
            adapter,
            selector: (state: any) => ({ a: state.a }),
        })

        const mockApi: any = {
            state: undefined as any,
            getState: function (this: any) { return this.state },
            serverState: undefined,
        }
        const mockSet: SetStateMethod<any> = (action: any) => {
            const s = mockApi.state
            const newState = typeof action === 'function' ? action(s) : action
            Object.assign(s, newState)
        }
        const state = storageFactory(mockSet, mockApi)
        mockApi.state = state

        state.updateA(99)
        await new Promise(resolve => setTimeout(resolve, 50))

        expect(adapter.setItem).toHaveBeenCalled()
        const savedValue = JSON.parse(adapter.setItem.mock.calls[0]?.[1] ?? '{}')
        expect(savedValue).toEqual({ a: 99 })
    })
})

// =============================================================================
// Batch writes
// =============================================================================
describe('storage batch writes', () => {
    it('batches multiple synchronous set calls into one write', async () => {
        const { state, adapter } = setupStoreWithStorage(createSettingsFactory(), {
            name: 'batch-test',
        })

        state.setTheme('dark')
        state.setFontSize(24)
        state.setTheme('light')

        await new Promise(resolve => setTimeout(resolve, 50))
        expect(adapter.setItem).toHaveBeenCalledTimes(1)

        const saved = JSON.parse(adapter.setItem.mock.calls[0]?.[1] ?? '{}')
        expect(saved.theme).toBe('light')
        expect(saved.fontSize).toBe(24)
    })

    it('separate ticks cause separate writes', async () => {
        const { state, adapter } = setupStoreWithStorage(createSettingsFactory(), {
            name: 'separate-ticks',
        })

        state.setTheme('dark')
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(adapter.setItem).toHaveBeenCalledTimes(1)

        state.setTheme('light')
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(adapter.setItem).toHaveBeenCalledTimes(2)
    })
})

// =============================================================================
// Custom adapter
// =============================================================================
describe('storage custom adapter', () => {
    it('uses custom adapter for get/set', async () => {
        const customGetItem = vi.fn(() => null)
        const customSetItem = vi.fn()

        const storageFactory = storage(createSettingsFactory(), {
            name: 'custom-adapter',
            adapter: { getItem: customGetItem, setItem: customSetItem },
        })

        const mockApi: any = {
            state: undefined as any,
            getState: function (this: any) { return this.state },
            serverState: undefined,
        }
        const mockSet: SetStateMethod<any> = (action: any) => {
            const s = mockApi.state
            Object.assign(s, typeof action === 'function' ? action(s) : action)
        }
        const state = storageFactory(mockSet, mockApi)
        mockApi.state = state

        expect(customGetItem).toHaveBeenCalledWith('custom-adapter')

        state.setTheme('dark')
        await new Promise(resolve => setTimeout(resolve, 50))
        expect(customSetItem).toHaveBeenCalled()
    })
})

// =============================================================================
// serverState (SSR)
// =============================================================================
describe('storage serverState', () => {
    it('sets serverState to initial state snapshot', () => {
        const { state, mockApi } = setupStoreWithStorage(createSettingsFactory(), {
            name: 'ssr-test',
        })

        expect(mockApi.serverState).toBeDefined()
        expect(mockApi.serverState.theme).toBe('light')
        expect(mockApi.serverState.fontSize).toBe(14)
        expect(mockApi.serverState).not.toBe(state)
    })

    it('serverState captures initial state before persisted data overrides it', () => {
        const adapter = createMockStorage()
        adapter.store['ssr-loaded'] = JSON.stringify({
            theme: 'dark',
            fontSize: 20,
        })

        const storageFactory = storage(createSettingsFactory(), {
            name: 'ssr-loaded',
            adapter,
        })
        const mockApi: any = {
            state: undefined as any,
            getState: function (this: any) { return this.state },
            serverState: undefined,
        }
        const mockSet: SetStateMethod<any> = (action: any) => {
            const s = mockApi.state
            Object.assign(s, typeof action === 'function' ? action(s) : action)
        }
        const state = storageFactory(mockSet, mockApi)
        mockApi.state = state

        expect(mockApi.serverState.theme).toBe('light')
        expect(mockApi.serverState.fontSize).toBe(14)
    })
})

// =============================================================================
// storage type option
// =============================================================================
describe('storage type option', () => {
    it('defaults to localStorage (via adapter in tests)', () => {
        const { state } = setupStoreWithStorage(createSettingsFactory(), {
            name: 'type-test',
        })
        expect(state).toBeDefined()
    })
})
