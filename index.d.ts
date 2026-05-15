declare namespace Statio {
    type StoreClass<S = any> = new (set: SetStateMethod<S>, compute: Compute) => S

    type StoreFactory<S> = (set: SetStateMethod<S>, get: () => S, compute: Compute) => S

    type SetStateMethod<S> = (state: SetStateAction<S>, overwrite?: boolean) => void
    
    type SetStateAction<S> = Partial<S> | ((state: S) => Partial<S>)
    
    type Compute = <T>(factory: () => T, deps: any[]) => T

    type Listener<S> = (state: S) => void

    type IsEqual<T> = (snapshot: T, prevSnapshot: T) => any

    type SubscribeOptions<T = any> = {
        immediate?: boolean
        isEqual?: IsEqual<T>
    }
}

export = Statio