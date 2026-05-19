import {AbortablePromise, StoreClass} from '../index'

/**
 * 得到所有属性的描述符，包括被继承的父类
 * @param o
 */
export function getAllPropertyDescriptors(o: any): { [p: PropertyKey]: PropertyDescriptor } {
    const {constructor, ...desc} = Object.getOwnPropertyDescriptors(o)
    const prototype = Object.getPrototypeOf(o)
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== Function.prototype) {
        return {
            ...getAllPropertyDescriptors(prototype),
            ...desc
        }
    }
    return desc
}

/**
 * 判断一个函数是否为Class
 * @param fn
 */
export function isClass(fn: Function | StoreClass): fn is StoreClass {
    if (fn.prototype?.constructor !== fn) {
        return false
    }
    return Function.prototype.toString.call(fn).startsWith('class')
}

/**
 * 浅比较，判断对象或数组是否“相等”
 * @param a
 * @param b
 */
export function shallowEqual(a: any, b: any) {
    if (a === b) {
        return true
    }
    if (typeof a !== 'object' || typeof b !== 'object') {
        return false
    }
    if (a === null) {
        return b === null
    }
    if (b === null) {
        return false
    }
    if (Array.isArray(a) !== Array.isArray(b)) {
        return false
    }
    const aKeys = Object.keys(a)
    if (aKeys.length !== Object.keys(b).length) {
        return false
    }
    let isEqual = true
    for (let i = 0, {length} = aKeys; i < length; i++) {
        const k: any = aKeys[i]
        if (!(k in b) || a[k] !== b[k]) {
            isEqual = false
            break
        }
    }
    return isEqual
}

/**
 * 下一个事件循环
 * @param callback
 * @param args
 */
export function nextTick<T>(callback?: (...args: T[]) => void, ...args: T[]): AbortablePromise<T> {
    let aborted = false
    const promise = new Promise(resolve => {
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(() => fn(...args))
            return
        }
        if (typeof process === 'object' && process.nextTick) {
            process.nextTick(fn, ...args)
            return
        }
        setTimeout(fn, 0, ...args)

        function fn(...a: any[]) {
            if (!aborted) {
                callback?.(...a)
                resolve(a[0])
            }
        }
    }) as AbortablePromise<T>
    promise.abort = () => {
        aborted = true
    }
    return promise
}

/**
 * 多次同步动作仅触发一次副作用
 * @param action
 * @param effect
 */
export function createBatchAction<T extends (this: any, ...a: any[]) => any>(action: T, effect: () => any): T {
    let prevPending: AbortablePromise<any>

    return function (...args) {
        try {
            action.apply(this, args)
        } finally {
            prevPending?.abort()
            prevPending = nextTick(effect)
        }
    } as T
}