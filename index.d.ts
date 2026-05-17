import {Computable} from './src'

declare namespace Statio {
    type StoreClass<S = any> = new (set: SetStateMethod<S>, api: StoreApi<S>) => S

    type StoreFactory<S> = (set: SetStateMethod<S>, api: StoreApi<S>) => S

    type SetStateMethod<S> = (state: SetStateAction<S>, overwrite?: boolean) => void

    type SetStateAction<S> = Partial<S> | ((state: S) => Partial<S>)

    class StoreApi<S> {
        state: S
        serverState?: S
        setState: SetStateMethod<S>
        getState(): S
        compute: Compute
        computable: Computable<S>
    }

    type Compute = <T>(factory: () => T, deps: any[]) => T

    type Listener<S> = (state: S) => void

    type IsEqual<T> = (snapshot: T, prevSnapshot: T) => any

    type SubscribeOptions<T = any> = {
        immediate?: boolean
        isEqual?: IsEqual<T>
        /** @private */
        _initSnapshot?: any
    }

    /**
     * ---------------------------------------------------------------------------------------
     * createStore
     */

    function createStore<S extends object = any>(factory: StoreFactory<S> | StoreClass<S>): S

    /**
     * ---------------------------------------------------------------------------------------
     * Storage
     */

    type StorageOptions<S> = {
        name: string
        /** Default to `localStorage` */
        type?: 'localStorage' | 'sessionStorage'
        selector?<T = S>(state: S): T
        adapter?: {
            getItem(key: string): string | null
            setItem(key: string, value: string): void
        }
    }

    function storage<S extends object>(factory: StoreFactory<S> | StoreClass<S>, options: StorageOptions<S>): StoreFactory<S>

    /**
     * ---------------------------------------------------------------------------------------
     * Util
     */

    function getAllPropertyDescriptors(o: any): { [p: PropertyKey]: PropertyDescriptor }

    function isClass(fn: Function | StoreClass): fn is StoreClass

    function shallowEqual(a: any, b: any): boolean

    interface AbortablePromise<T> extends Promise<T> {
        abort(): void
    }

    function nextTick<T>(callback?: (...args: T[]) => void, ...args: T[]): AbortablePromise<T>

    function createBatchAction<T extends (this: any, ...a: any[]) => any>(action: T, effect: () => any): T
}

export = Statio