import { createSignal } from 'solid-js'
import { isServer } from 'solid-js/web'
import { access, AnyFunction, MaybeAccessor, tryOnCleanup } from '../utils'

export interface TimeoutOptions {
  /**
   * @default true
   */
  immediate?: boolean

  /**
   * @default false
   */
  immediateCallback?: boolean
}

export function createTimeout<Callback extends AnyFunction>(
  cb: Callback,
  interval: MaybeAccessor<number>,
  options: TimeoutOptions = {},
) {
  const { immediate = true, immediateCallback } = options

  const [isPending, setIsPending] = createSignal(false)

  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    if (timer) {
      clearTimeout(timer)
    }
  }

  function stop() {
    setIsPending(false)
    clear()
  }

  function start(...args: Parameters<Callback> | []) {
    immediateCallback && cb()

    clear()
    setIsPending(true)
    timer = setTimeout(() => {
      setIsPending(false)
      timer = undefined

      cb(...args)
    }, access(interval))
  }

  if (immediate) {
    setIsPending(true)

    isServer || start()
  }

  tryOnCleanup(stop)

  return {
    isPending,
    start,
    stop,
  }
}
