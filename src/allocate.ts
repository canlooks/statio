import {getAllPropertyDescriptors} from './util'
import {Computable} from './compute'

export function allocateProperties(state: any) {
    const properties = getAllPropertyDescriptors(state)
    for (const k in properties) {
        const {get, value} = properties[k]
        if (get) {
            Object.defineProperty(state, k, {
                get: Computable.createGetter(k, () => get.call(state))
            })
        } else if (typeof value === 'function') {
            state[k] = value.bind(state)
        }
    }
}