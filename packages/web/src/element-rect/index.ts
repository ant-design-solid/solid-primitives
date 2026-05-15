import { access, MaybeAccessor, MaybeElement } from '@solid-primitive/shared'
import { createEffect, createSignal } from 'solid-js'
import { untrack } from 'solid-js/web'
import { ConfigurableWindow, defaultWindow } from '../_configurable'
import { useEventListener } from '../event-listener'
import { createResizeObserver } from '../resize-observer'

export interface CreateElementRectOptions extends ConfigurableWindow {
  /**
   * @default true
   */
  reset?: boolean

  /**
   * @defualt true
   */
  windowResize?: boolean

  /**
   * @defualt true
   */
  windowScroll?: boolean

  /*
   * @default true
   */
  immediate?: boolean

  /*
   * @default true
   */
  sync?: boolean
}

const genInitialRect = () => ({ height: 0, width: 0, left: 0, right: 0, top: 0, bottom: 0, x: 0, y: 0 })

export type ElementRect = ReturnType<typeof genInitialRect>

export function createElementRect(target: MaybeAccessor<MaybeElement>, options: CreateElementRectOptions = {}) {
  const {
    window = defaultWindow,
    reset = true,
    windowResize = true,
    windowScroll = true,
    sync = true,
    immediate = true,
  } = options
  const [rect, setRect] = createSignal<ElementRect>(genInitialRect())

  function recalculate() {
    const el = access(target)
    if (!el) {
      if (reset) {
        setRect(genInitialRect())
      }
      return
    }
    const _rect = el.getBoundingClientRect()

    setRect({
      x: _rect.x,
      y: _rect.y,
      width: _rect.width,
      height: _rect.height,
      top: _rect.top,
      bottom: _rect.bottom,
      left: _rect.left,
      right: _rect.right,
    })
  }

  function update() {
    if (sync) {
      recalculate()
    } else {
      requestAnimationFrame(recalculate)
    }
  }

  createEffect(prev => {
    const el = access(target) ?? null

    if (prev === undefined ? immediate : el !== prev) {
      untrack(update)
    }

    return el
  })

  createResizeObserver(target, update)

  windowScroll && useEventListener(window, 'scroll', update, { capture: true, passive: true })

  windowResize && useEventListener(window, 'resize', update, { passive: true })

  return {
    rect,
    update,
  }
}
