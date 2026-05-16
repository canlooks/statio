import {SetStateAction, StoreClass, StoreFactory} from '../index'
import {Computable} from './compute'
import {getAllPropertyDescriptors, isClass} from './util'

export class Api<S extends object> {
    serverState?: S
    state: S
    computable!: Computable<S>

    constructor(factory: StoreFactory<S> | StoreClass<S>, private onChange: (state: S) => void) {
        this.state = isClass(factory)
            ? new factory(this.setState, this)
            : (factory as StoreFactory<S>)(this.setState, this)

        this.bindContextAndInitComputable()
    }

    setState = (setStateAction: SetStateAction<S>, overwrite?: boolean) => {
        const newState = typeof setStateAction === 'function' ? setStateAction(this.state) : setStateAction
        if (overwrite) {
            this.state = newState as S
            this.bindContextAndInitComputable()
        } else {
            Object.assign(this.state, newState)
        }
        this.onChange(this.state)
    }

    getState = () => {
        return this.state
    }

    compute = <T>(factory: () => T, deps: any[]) => {
        return this.computable.get(factory, deps)
    }
    
    private bindContextAndInitComputable() {
        this.computable = new Computable(this.state)
        const properties = getAllPropertyDescriptors(this.state)
        for (const k in properties) {
            const {get, value} = properties[k]
            if (get) {
                Object.defineProperty(this.state, k, {
                    get: this.computable.createGetter(k, () => get.call(this.state))
                })
            } else if (typeof value === 'function') {
                this.state[k as keyof S] = value.bind(this.state)
            }
        }
    }
}