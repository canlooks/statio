import {shallowEqual} from './util'
import {Compute} from '../index'
import {prefix} from './log'

export function createCompute(): Compute {
    let prevDeps: any[] = []
    let prevResult: any
    let hasRun = false

    return function (this: any, factory, deps) {
        if (hasRun && shallowEqual(prevDeps, deps)) {
            return prevResult
        }
        hasRun = true
        prevDeps = [...deps]
        return prevResult = factory.call(this)
    }
}

export class Computable<S> {
    constructor(private state: S) {
    }

    private property_compute = new Map<string, Compute>()
    private stack: string[] = []

    createGetter<T>(key: string, get: () => T): () => T {
        return () => {
            try {
                this.stack.push(key)
                return get()
            } finally {
                this.stack.pop()
            }
        }
    }

    get<T>(factory: () => T, deps: any[]): T {
        const key = this.stack[this.stack.length - 1]
        if (!key) {
            throw Error(`${prefix}"compute" method can only be used in getter properties.`)
        }
        let compute = this.property_compute.get(key)
        if (!compute) {
            compute = createCompute()
            this.property_compute.set(key, compute)
        }
        return compute.call(this.state, factory, deps) as T
    }
}