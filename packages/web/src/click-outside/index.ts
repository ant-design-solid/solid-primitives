import { access, isIOS, MaybeAccessor, MaybeElement, noop, toArray, tryOnCleanup } from '@solid-primitive/shared'
import { createMemo, createRoot } from 'solid-js'
import { ConfigurableWindow, defaultWindow } from '../_configurable'
import { useEventListener } from '../event-listener'

export interface OnClickOutsideOptions<Controls extends boolean = false> extends ConfigurableWindow {
  ignore?: MaybeAccessor<(MaybeAccessor<MaybeElement> | string)[]>

  /**
   * @default true
   */
  capture?: boolean

  /**
   * @default false
   */
  detectIframe?: boolean

  /**
   * @default false
   */
  controls?: Controls
}

export type OnClickOutsideHandler<T extends OnClickOutsideOptions<boolean> = OnClickOutsideOptions<boolean>> = (
  event:
    | (T['detectIframe'] extends true ? FocusEvent : never)
    | (T['controls'] extends true ? Event : never)
    | PointerEvent,
) => void

export type OnClickOutsideReturn<Controls extends boolean = false> = Controls extends false
  ? VoidFunction
  : {
      stop: VoidFunction
      cancel: VoidFunction
      trigger: (event: Event) => void
    }

let _iOSWorkaround = false

function isEventInsideNodes(event: Event, nodes: readonly Node[]): boolean {
  if (!nodes.length) return false

  const target = event.target
  const path = event.composedPath?.() ?? []

  return nodes.some(node => {
    if (node === target) return true
    if (path.includes(node)) return true
    return target instanceof Node && node.contains(target)
  })
}

function resolveListenerRoots(nodes: readonly Node[], window: Window): (Window | ShadowRoot)[] {
  const seen = new Set<Window | ShadowRoot>([window])

  for (const node of nodes) {
    const root = node.getRootNode?.()
    if (root instanceof ShadowRoot && !seen.has(root)) {
      seen.add(root)
    }
  }

  return [...seen]
}

function resolveIgnoreNodes(
  ignore: MaybeAccessor<(MaybeAccessor<MaybeElement> | string)[]>,
  roots: readonly (Window | ShadowRoot)[],
  window: Window,
): Node[] {
  const seen = new Set<Node>()

  const addNode = (node: Node | null | undefined) => {
    if (node && !seen.has(node)) {
      seen.add(node)
    }
  }

  for (const entry of access(ignore)) {
    if (typeof entry === 'string') {
      window.document.querySelectorAll(entry).forEach(addNode)

      for (const root of roots) {
        if (root instanceof ShadowRoot) {
          root.querySelectorAll(entry).forEach(addNode)
        }
      }
      continue
    }

    addNode(access(entry))
  }

  return [...seen]
}

export function onClickOutside<T extends OnClickOutsideOptions>(
  target: MaybeAccessor<MaybeElement>,
  handler: OnClickOutsideHandler<T>,
  options?: T,
): OnClickOutsideReturn<false>

export function onClickOutside<T extends OnClickOutsideOptions<true>>(
  target: MaybeAccessor<MaybeElement>,
  handler: OnClickOutsideHandler<T>,
  options: T,
): OnClickOutsideReturn<true>

export function onClickOutside(
  target: MaybeAccessor<MaybeElement>,
  handler: OnClickOutsideHandler,
  options: OnClickOutsideOptions<boolean> = {},
): OnClickOutsideReturn<boolean> {
  const { window = defaultWindow, ignore = [], capture = true, detectIframe = false, controls = false } = options

  if (!window) {
    return controls ? { stop: noop, cancel: noop, trigger: noop } : noop
  }

  if (isIOS && !_iOSWorkaround) {
    _iOSWorkaround = true
    const listenerOptions = { passive: true }
    Array.from(window.document.body.children).forEach(el => el.addEventListener('click', noop, listenerOptions))
    window.document.documentElement.addEventListener('click', noop, listenerOptions)
  }

  const getTargetNodes = createMemo(() => toArray(access(target)).filter(node => node instanceof Node))
  const getListenerRoots = createMemo(() => resolveListenerRoots(getTargetNodes(), window))

  let shouldListen = true
  const shouldIgnore = (event: Event) =>
    isEventInsideNodes(event, resolveIgnoreNodes(ignore, getListenerRoots(), window))

  const listener = (event: Event) => {
    const targetNodes = getTargetNodes()
    if (event.target == null || !targetNodes.length || isEventInsideNodes(event, targetNodes)) return

    if ('detail' in event && event.detail === 0) {
      shouldListen = !shouldIgnore(event)
    }

    if (!shouldListen) {
      shouldListen = true
      return
    }

    handler(event as any)
  }

  let isProcessingClick = false

  const stop = createRoot(dispose => {
    useEventListener(
      getListenerRoots,
      'click',
      event => {
        if (isProcessingClick) return
        isProcessingClick = true
        setTimeout(() => {
          isProcessingClick = false
        }, 0)
        listener(event)
      },
      { passive: true, capture },
    )

    useEventListener(
      getListenerRoots,
      'pointerdown',
      event => {
        const targetNodes = getTargetNodes()
        shouldListen = !shouldIgnore(event) && !!(targetNodes.length && !isEventInsideNodes(event, targetNodes))
      },
      { passive: true },
    )

    detectIframe &&
      useEventListener(
        window,
        'blur',
        event => {
          setTimeout(() => {
            const targetNodes = getTargetNodes()
            if (!targetNodes.length) return

            const activeElement = window.document.activeElement
            let activeEl: Element | null = activeElement
            while (activeEl?.shadowRoot) {
              activeEl = activeEl.shadowRoot.activeElement
            }

            if (activeEl?.tagName === 'IFRAME' && !targetNodes.some(node => node.contains(activeElement))) {
              handler(event as any)
            }
          }, 0)
        },
        { passive: true },
      )

    return dispose
  })

  tryOnCleanup(stop)

  if (controls) {
    return {
      stop,
      cancel: () => {
        shouldListen = false
      },
      trigger: (event: Event) => {
        shouldListen = true
        listener(event)
        shouldListen = false
      },
    }
  }

  return stop
}
