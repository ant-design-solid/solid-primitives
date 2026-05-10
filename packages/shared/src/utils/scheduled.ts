import { AnyFunction } from './type'

export interface DebounceOptions {
  maxWait?: number
  rejectOnCancel?: boolean
}

export function debounce<T extends AnyFunction>(callback: T, wait: number = 200, options: DebounceOptions = {}) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let maxTimer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  let lastThis: ThisParameterType<T> | undefined

  let resolves: Array<(value: Awaited<ReturnType<T>>) => void> = []
  let rejects: Array<(reason?: any) => void> = []

  const clear = (reason?: Error) => {
    if (timer) clearTimeout(timer)
    if (maxTimer) clearTimeout(maxTimer)
    timer = maxTimer = undefined
    lastArgs = undefined
    lastThis = undefined

    if (reason && options.rejectOnCancel) {
      rejects.forEach(reject => reject(reason))
    }
    resolves = []
    rejects = []
  }

  function wrapper(this: ThisParameterType<T>, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
    if (wait <= 0) {
      return Promise.resolve(callback.apply(this, args))
    }

    lastArgs = args
    lastThis = this

    return new Promise((resolve, reject) => {
      resolves.push(resolve)
      rejects.push(reject)

      const invoke = () => {
        const currentResolves = resolves
        const currentRejects = rejects
        const currentArgs = lastArgs!
        const currentThis = lastThis
        clear()

        try {
          const result = callback.apply(currentThis, currentArgs)
          Promise.resolve(result)
            .then(res => currentResolves.forEach(r => r(res)))
            .catch(err => currentRejects.forEach(r => r(err)))
        } catch (error) {
          currentRejects.forEach(r => r(error))
        }
      }

      if (timer) clearTimeout(timer)
      timer = setTimeout(invoke, wait)

      if (options.maxWait && !maxTimer) {
        maxTimer = setTimeout(invoke, options.maxWait)
      }
    })
  }

  return Object.assign(wrapper, { clear: () => clear(new Error('Debounce cancelled')) })
}
