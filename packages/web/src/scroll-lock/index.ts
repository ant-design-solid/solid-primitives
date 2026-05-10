import { access, isIOS, MaybeAccessor, tryOnCleanup } from '@s-primitives/shared'
import { Accessor, createEffect, createSignal, onCleanup } from 'solid-js'
import { makeEventListener } from '../event-listener'

const HIDDEN = 'hidden'
const SCROLL = 'scroll'
const AUTO = 'auto'

type ScrollLockElement = HTMLElement | SVGElement

type MaybeElement = ScrollLockElement | null | undefined

function checkOverflowScroll(element: Element): boolean {
  const style = window.getComputedStyle(element)

  if (
    style.overflowX === SCROLL ||
    style.overflowY === SCROLL ||
    (style.overflowX === AUTO && element.clientWidth < element.scrollWidth) ||
    (style.overflowY === AUTO && element.clientHeight < element.scrollHeight)
  ) {
    return true
  }

  const parent = element.parentElement
  if (!parent || parent.tagName === 'BODY') {
    return false
  }

  return checkOverflowScroll(parent)
}

function preventTouchMove(event: TouchEvent): void {
  const target = event.target as Element | null
  if (!target || checkOverflowScroll(target) || event.touches.length > 1) return
  event.preventDefault()
}

const initialOverflowByElement = new WeakMap<ScrollLockElement, CSSStyleDeclaration['overflow']>()

function resolveElement(el: MaybeElement | Window | Document) {
  if (typeof Window !== 'undefined' && el instanceof Window) {
    return el.document.documentElement
  }
  if (typeof Document !== 'undefined' && el instanceof Document) {
    return el.documentElement
  }
  return el as MaybeElement
}

export function createScrollLock(
  element: MaybeAccessor<ScrollLockElement | Window | Document | null | undefined>,
  initialState = false,
): [get: Accessor<boolean>, set: (value: boolean) => void] {
  const [isLocked, setIsLocked] = createSignal(initialState)

  createEffect(() => {
    const el = resolveElement(access(element))
    if (!el) return

    if (!initialOverflowByElement.has(el)) {
      initialOverflowByElement.set(el, el.style.overflow)
    }

    if (el.style.overflow === HIDDEN && !isLocked()) {
      setIsLocked(true)
      return
    }

    if (!isLocked()) return

    const initialOverflow = initialOverflowByElement.get(el) ?? ''
    const stopTouchMoveListener =
      isIOS && el
        ? makeEventListener(el, 'touchmove', preventTouchMove, {
            passive: false,
          })
        : null

    el.style.overflow = HIDDEN

    onCleanup(() => {
      stopTouchMoveListener?.()
      el.style.overflow = initialOverflow
      initialOverflowByElement.delete(el)
    })
  })

  const lock = () => {
    if (isLocked()) return
    if (!resolveElement(access(element))) return
    setIsLocked(true)
  }

  const unlock = () => {
    if (!isLocked()) return
    setIsLocked(false)
  }

  tryOnCleanup(unlock)

  return [isLocked, value => (value ? lock() : unlock())]
}
