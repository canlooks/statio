import {shallowEqual} from './util'
import {Compute} from '../index'
import {prefix} from './log'

export function createCompute(getContext?: () => object): Compute {
    let prevDeps: any[] = []
    let prevResult: any
    let hasRun = false

    return (factory, deps) => {
        if (hasRun && shallowEqual(prevDeps, deps)) {
            return prevResult
        }
        hasRun = true
        prevDeps = [...deps]
        return prevResult = factory.call(getContext?.())
    }
}

export class Computable {
    private static property_compute = new Map<string, Compute>()
    private static stack: string[] = []

    static createGetter<T>(key: string, get: () => T): () => T {
        return () => {
            try {
                this.stack.push(key)
                return get()
            } finally {
                this.stack.pop()
            }
        }
    }

    static get<T>(context: object, factory: () => T, deps: any[]): T {
        const key = this.stack[this.stack.length - 1]
        if (!key) {
            throw Error(`${prefix}"compute" method can only be used in getter properties.`)
        }
        let compute = this.property_compute.get(key)
        if (!compute) {
            compute = createCompute(() => context)
            this.property_compute.set(key, compute)
        }
        return compute(factory, deps)
    }
}