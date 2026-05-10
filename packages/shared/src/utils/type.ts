import { Accessor } from 'solid-js'

export type AnyFunction = (...args: any[]) => any

export type Nullable<T> = T | null | undefined

export type MaybeArray<T> = T | T[]

export type MaybePromise<T> = T | Promise<T>

export type MaybeElement = Nullable<HTMLElement | SVGElement>

export type Awaited<T> = T extends null | undefined
  ? T
  : T extends object & { then: (onfulfilled: infer F, ...args: infer _) => any }
    ? F extends (value: infer V, ...args: infer _) => any
      ? Awaited<V>
      : never
    : T

export type Promisify<T> = Promise<Awaited<T>>

export type PromisifyFunction<T extends AnyFunction> = (...args: Parameters<T>) => Promisify<ReturnType<T>>

export type KeyOf<T> = number extends keyof T
  ? 0 extends 1 & T
    ? keyof T
    : [T] extends [never]
      ? never
      : [T] extends [readonly unknown[]]
        ? number
        : keyof T
  : keyof T

export type ValueOf<T> = T[KeyOf<T>]

export type Mutable<T> = {
  -readonly [K in keyof T]: T[K]
}

export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>

export type Assign<T, U> = Omit<T, keyof U> & U

export interface Pausable {
  isActive: Accessor<boolean>

  pause: VoidFunction

  resume: VoidFunction
}
