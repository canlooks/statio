import {IsEqual, Listener, StoreClass, StoreFactory, SubscribeOptions} from '../index'
import {Api} from './api'
import {shallowEqual} from './util'
import {useRef, useSyncExternalStore} from 'react'

export function createStore<S extends object = any>(factory: StoreFactory<S> | StoreClass<S>) {
    const api = new Api(factory, state => {
        for (const fire of listeners) {
            fire(state)
        }
    })

    function useStore(): S
    function useStore<K extends keyof S>(...keys: K[]): Pick<S, K>
    function useStore<T = S>(selector: (state: S) => T, isEqual?: IsEqual<T>): T
    function useStore(a?: any, b?: any, ...rest: any[]) {
        let selector: ((state: S) => any) | undefined
        let isEqual: IsEqual<any> | undefined

        if (typeof a !== 'undefined') {
            if (typeof a === 'function') {
                selector = a
                isEqual = b
            } else {
                const keys = [a, b, ...rest]
                selector = (state: S) => {
                    const select: Partial<S> = {}
                    keys.forEach((key: keyof S) => {
                        if (key in state) {
                            select[key] = state[key]
                        }
                    })
                    return select
                }
            }
        }

        const symbolHelper = useRef(Symbol())

        const cachedSnapshot = useRef<any>(void 0)
        if (selector) {
            cachedSnapshot.current ||= selector(api.state)
        }

        const result = useSyncExternalStore(
            onStoreChange => {
                const listener = (snapshot: any) => {
                    if (selector) {
                        cachedSnapshot.current = snapshot
                    } else {
                        symbolHelper.current = Symbol()
                    }
                    onStoreChange()
                }
                return selector
                    ? subscribe(selector, listener, {isEqual, _initSnapshot: cachedSnapshot.current})
                    : subscribe(listener)
            },
            () => selector ? cachedSnapshot.current : symbolHelper.current,
            () => api.serverState
        )

        return typeof result === 'symbol' ? api.state : result
    }

    const listeners = new Set<Listener<S>>()
    const originListener_callback = new WeakMap<Function, Function>()

    function subscribe(listener: Listener<S>, options?: Omit<SubscribeOptions, 'isEqual'>): () => void
    function subscribe<T = S>(selector: (state: S) => T, listener: (snapshot: T, prevSnapshot?: T) => void, options?: SubscribeOptions<T>): () => void
    function subscribe(a: any, b?: any, c?: any) {
        const bIsFunction = typeof b === 'function'
        const listener = bIsFunction ? b : a
        const selector = bIsFunction ? a : void 0
        const options = bIsFunction ? c : b

        let prevSnapshot = options?._initSnapshot

        const callback = () => {
            if (!selector) {
                listener(api.state)
                return
            }
            const snapShot = selector(api.state)
            if (options?.isEqual) {
                if (options.isEqual(snapShot, prevSnapshot)) {
                    return
                }
            } else if (typeof snapShot === 'object' && snapShot !== null) {
                if (shallowEqual(snapShot, prevSnapshot)) {
                    return
                }
            } else if (prevSnapshot === snapShot) {
                return
            }
            listener(snapShot, prevSnapshot)
            prevSnapshot = snapShot
        }
        options?.immediate && callback()

        listeners.add(callback)
        originListener_callback.set(listener, callback)

        return () => {
            unsubscribe(listener)
        }
    }

    function unsubscribe(listener: Function) {
        const callback = originListener_callback.get(listener)
        if (callback) {
            listeners.delete(callback as any)
            originListener_callback.delete(listener)
        }
    }

    useStore.getState = () => api.state
    useStore.setState = api.setState
    useStore.subscribe = subscribe
    useStore.unsubscribe = unsubscribe

    return useStore
}