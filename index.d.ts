declare namespace Statio {
    type StoreClass<S = any> = new (set: SetStateMethod<S>, api: StoreApi<S>) => S

    type StoreFactory<S> = (set: SetStateMethod<S>, api: StoreApi<S>) => S

    type SetStateMethod<S> = (state: SetStateAction<S>, overwrite?: boolean) => void

    type SetStateAction<S> = Partial<S> | ((state: S) => Partial<S>)

    type StoreApi<S> = {
        state: S
        serverState?: S
        setState: SetStateMethod<S>
        getState(): S
        compute: Compute
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

    /**
     * ---------------------------------------------------------------------------------------
     * Util
     */

    interface AbortablePromise<T> extends Promise<T> {
        abort(): void
    }
}

export = Statio