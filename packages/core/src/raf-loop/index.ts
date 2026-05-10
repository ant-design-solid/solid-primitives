import { createSignal } from 'solid-js'
import { ConfigurableWindow, defaultWindow } from '../_configurable'
import { access, MaybeAccessor, tryOnCleanup } from '@s-primitives/shared'

export interface CreateRafLoopOptions extends ConfigurableWindow {
  /**
   * @default true
   */
  immediate?: boolean

  /**
   * @default null
   */
  fpsLimit?: MaybeAccessor<number | null>

  /**
   * @default false
   */
  once?: boolean
}

export function createRafLoop(
  fn: (arg: { timestamp: DOMHighResTimeStamp; delta: number }) => void | boolean,
  options: CreateRafLoopOptions = {},
) {
  const { window = defaultWindow, fpsLimit = null, once = false, immediate = true } = options

  const [isActive, setIsActive] = createSignal(false)
  const intervalLimit = () => {
    const limit = access(fpsLimit)
    return limit ? 1000 / limit : null
  }
  let preFrameTimestamp = 0
  let rafId: number | null = null

  function loop(timestamp: DOMHighResTimeStamp) {
    if (!isActive() || !window) return
    if (!preFrameTimestamp) preFrameTimestamp = timestamp

    const delta = timestamp - preFrameTimestamp

    if (intervalLimit() && delta < intervalLimit()!) {
      rafId = window.requestAnimationFrame(loop)
      return
    }

    preFrameTimestamp = timestamp
    const shouldContinue = fn({ timestamp, delta })
    if (once || shouldContinue === false) {
      setIsActive(false)
      rafId = null
      return
    }
    rafId = window.requestAnimationFrame(loop)
  }

  function resume() {
    if (isActive() || !window) return
    setIsActive(true)
    preFrameTimestamp = 0
    rafId = window.requestAnimationFrame(loop)
  }

  function pause() {
    setIsActive(false)
    if (rafId != null && window) {
      window.cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  immediate && resume()

  tryOnCleanup(pause)

  return {
    isActive,
    resume,
    pause,
  }
}
