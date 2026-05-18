'use client'

import {SetStateMethod, StoreApi} from '../../index'
import {createStore, storage} from '../../src'
import {useRef, useState, useSyncExternalStore} from 'react'
import {create} from 'zustand'
import {persist} from 'zustand/middleware'

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

// const useClsStore = createStore(ClsStore)

const useClsStore = createStore(
    storage(ClsStore, {name: 'test'})
)

export default function Page() {
    const store = useClsStore(({
        count,
        double,
        increase
    }) => ({
        count,
        double,
        increase
    }))
    console.log(43, store)
    return (
        <>
            <h1>Test SSR</h1>
            <button onClick={store.increase}>{store.count}</button>
            <h2>{store.double}</h2>
            <h2>{store.double}</h2>
            <h2>{store.double}</h2>
        </>
    )
}