import {SetStateMethod, StorageOptions, StoreApi, StoreClass, StoreFactory} from '../index'
import {createBatchAction, getAllPropertyDescriptors, isClass} from './util'
import {Api} from './api'

export function storage<S extends object>(factory: StoreFactory<S> | StoreClass<S>, options: StorageOptions<S>): StoreFactory<S> {
    return (set: SetStateMethod<S>, api: StoreApi<S>) => {
        const {
            name,
            type = 'localStorage',
            selector = state => {
                const selected: Partial<S> = {}
                const descriptors = getAllPropertyDescriptors(state)

                for (const k in descriptors) {
                    const {value} = descriptors[k]
                    if (typeof value !== 'function' && !(value instanceof Api)) {
                        selected[k as keyof S] = value
                    }
                }

                return selected
            },
            adapter
        } = options

        const storageFactory = adapter || (typeof window !== 'undefined' ? window[type] : void 0)

        const batchSet = createBatchAction(set, () => {
            if (storageFactory) {
                const state = api.getState()
                const value = selector ? selector(state) : state
                storageFactory.setItem(name, JSON.stringify(value))
            }
        })

        const state = isClass(factory)
            ? new factory(batchSet, api)
            : (factory as StoreFactory<S>)(batchSet, api)

        api.serverState = {...state}

        if (storageFactory) {
            const value = storageFactory.getItem(name)
            if (value !== null) {
                try {
                    const cached = JSON.parse(value)
                    Object.assign(state, cached)
                } catch (e) {
                }
            }
        }

        return state
    }
}