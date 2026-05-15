import {createRoot} from 'react-dom/client'
import {StrictMode} from 'react'
import {createStore} from '../src'
import {Compute, SetStateMethod} from '../index'

const useFnStore = createStore<{
    count: number
    double: number
    increase: () => void
}>((set, get, compute) => ({
    count: 123,
    get double() {
        return compute(() => {
            console.log('compute', this)
            return get().count * 2
        }, [get().count])
    },
    increase() {
        set({count: this.count + 1})
    },
    decrease: () => {

    }
}))

class ClsStore {
    constructor(private set: SetStateMethod<ClsStore>, private compute: Compute) {
    }

    count = 123

    get double() {
        return this.compute(() => {
            console.log('compute')
            return this.count * 2
        }, [this.count])
    }

    increase() {
        this.set({count: this.count + 1})
    }
}

const useClsStore = createStore(ClsStore)

function App() {
    const fnStore = useFnStore(({
        count,
        double,
        increase
    }) => ({
        count,
        double,
        increase
    }))

    return (
        <>
            <button onClick={fnStore.increase}>{fnStore.count}</button>
            <h1>{fnStore.double}</h1>
            <h1>{fnStore.double}</h1>
            <h1>{fnStore.double}</h1>
            <h1>{fnStore.double}</h1>
        </>
    )
}

createRoot(document.getElementById('app')!).render(
    <StrictMode>
        <App/>
    </StrictMode>
)