import {createRoot} from 'react-dom/client'
import {StrictMode, useEffect} from 'react'
import {createStore, storage} from '../src'
import {SetStateMethod, StoreApi} from '../index'

// const useFnStore = createStore<{
//     count: number
//     double: number
//     increase: () => void
//     decrease: () => void
// }>((set, {compute}) => ({
//     count: 123,
//     get double() {
//             console.log('compute', this)
//         return compute(() => {
//             return this.count * 2
//         }, [this.count])
//     },
//     increase() {
//         set({count: this.count + 1})
//     },
//     decrease: () => {
//
//     }
// }))

class ClsStore {
    constructor(private set: SetStateMethod<ClsStore>, private api: StoreApi<ClsStore>) {
    }

    count = 123

    get double() {
        return this.api.compute(() => {
            console.log('compute')
            return this.count * 2
        }, [this.count])
    }

    increase() {
        this.set({count: this.count + 1})
    }
}

const useClsStore = createStore(
    storage(ClsStore, {name: 'test'})
)

function App() {
    const store = useClsStore(({
        count,
        double,
        increase
    }) => ({
        count,
        double,
        increase
    }))

    // const store = useClsStore('count', 'double', 'increase')

    // useEffect(() => {
    //     (async () => {
    //         for (let i = 0; i < 10; i++) {
    //             console.log(fnStore.double)
    //             await new Promise(resolve => setTimeout(resolve, 1000))
    //         }
    //     })()
    // }, [])

    return (
        <>
            <button onClick={store.increase}>{store.count}</button>
            <h1>{store.double}</h1>
            <h1>{store.double}</h1>
            <h1>{store.double}</h1>
        </>
    )
}

createRoot(document.getElementById('app')!).render(
    <>
        <App/>
    </>
)