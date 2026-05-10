import { batch, createSignal, onMount } from 'solid-js'
import { createMutable, createStore } from 'solid-js/store'
import { type ConfigurableWindow, defaultWindow } from '../_configurable'
import { useEventListener } from '../event-listener'
import { access, MaybeAccessor, useDebounce } from '@s-primitives/shared'

export interface CreateScrollOptions extends ConfigurableWindow {
  /**
   * @default 0
   */
  throttle?: number

  /**
   * @defualt 200
   */
  idle?: number

  offset?: {
    left?: number
    right?: number
    top?: number
    bottom?: number
  }

  observe?:
    | boolean
    | {
        mutation?: boolean
      }

  onScroll?: (e: Event) => void

  onStop?: (e: Event) => void

  /**
   * @default { capture: false, passive: true }
   */
  eventListenerOptions?: EventListenerOptions

  /**
   * @default 'auto'
   */
  behavior?: MaybeAccessor<ScrollBehavior>

  onError?: (error: unknown) => void
}

type ScrollTarget = HTMLElement | SVGElement | Window | Document | null | undefined

const ARRIVED_STATE_THRESHOLD_PIXELS = 1

export function createScroll(element: MaybeAccessor<ScrollTarget>, options: CreateScrollOptions = {}) {
  const {
    throttle = 0,
    idle = 200,
    eventListenerOptions = { capture: false, passive: true },
    behavior = 'auto',
    window = defaultWindow,
    offset,
    onStop,
    onScroll,
    onError = e => {
      console.error(e)
    },
  } = options

  const [internalX, setInternalX] = createSignal(0)
  const [internalY, setInternalY] = createSignal(0)
  const position = createMutable({
    get x() {
      return internalX()
    },
    get y() {
      return internalY()
    },
  })

  const [isScrolling, setIsScrolling] = createSignal(false)
  const [arrivedState, setArrivedState] = createStore({
    left: false,
    right: false,
    top: false,
    bottom: false,
  })
  const [direction, setDirection] = createStore({
    left: false,
    right: false,
    top: false,
    bottom: false,
  })

  function scrollTo(_x: number | undefined, _y: number | undefined) {
    if (!window) return
    const el = access(element)
    ;(el instanceof Document ? window.document.body : el)?.scroll({
      top: _y ?? position.y,
      left: _x ?? position.x,
      behavior: access(behavior),
    })
    const scrollContainer =
      (el as Window)?.document?.documentElement || (el as Document)?.documentElement || (el as Element)

    batch(() => {
      setInternalX(scrollContainer.scrollLeft)
      setInternalY(scrollContainer.scrollTop)
    })
  }

  const onScrollEnd = (e: Event) => {
    if (!isScrolling()) return
    setIsScrolling(false)

    setDirection({ left: false, right: false, top: false, bottom: false })
    onStop?.(e)
  }

  const onScrollEndDebounced = useDebounce(onScrollEnd, throttle + idle)

  const updateArrivedState = (target: ScrollTarget) => {
    if (!window) return
    const el: Element =
      (target as Window)?.document?.documentElement || (target as Document)?.documentElement || (target as Element)
    const { display, flexDirection, direction } = window.getComputedStyle(el)
    const directionMultiple = direction === 'rtl' ? -1 : 1

    const scrollLeft = el.scrollLeft

    batch(() => {
      setDirection('left', scrollLeft < internalX())
      setDirection('right', scrollLeft > internalX())

      const left = Math.abs(scrollLeft * directionMultiple) <= (offset?.left || 0)
      const right =
        Math.abs(scrollLeft * directionMultiple) + el.clientWidth >=
        el.scrollWidth - (offset?.right || 0) - ARRIVED_STATE_THRESHOLD_PIXELS

      if (display === 'flex' && flexDirection === 'row-reverse') {
        setArrivedState('left', right)
        setArrivedState('right', left)
      } else {
        setArrivedState('left', left)
        setArrivedState('right', right)
      }
      setInternalX(scrollLeft)

      let scrollTop = el.scrollTop
      if (target === window.document && !scrollTop) {
        scrollTop = window.document.body.scrollTop
      }

      setDirection('top', scrollTop < internalY())
      setDirection('bottom', scrollTop > internalY())

      const top = Math.abs(scrollTop) <= (offset?.top || 0)
      const bottom =
        Math.abs(scrollTop) + el.clientHeight >=
        el.scrollHeight - (offset?.bottom || 0) - ARRIVED_STATE_THRESHOLD_PIXELS

      if (display === 'flex' && flexDirection === 'column-reverse') {
        setArrivedState('top', bottom)
        setArrivedState('bottom', top)
      } else {
        setArrivedState('top', top)
        setArrivedState('bottom', bottom)
      }

      setInternalY(scrollTop)
    })
  }

  const onScrollHandler = (e: Event) => {
    if (!window) return
    const eventTarget: HTMLElement = (e.target as Document).documentElement ?? e.target

    updateArrivedState(eventTarget)

    setIsScrolling(true)
    onScrollEndDebounced(e)
    onScroll?.(e)
  }

  useEventListener(element, 'scroll', onScrollHandler, eventListenerOptions)

  onMount(() => {
    try {
      measure()
    } catch (e) {
      onError(e)
    }
  })

  function measure() {
    const el = access(element)
    el && updateArrivedState(el)
  }

  return {
    position,
    isScrolling,
    arrivedState,
    direction,
    measure,

    scrollTo,
  }
}

export type CreateScroll = ReturnType<typeof createScroll>
