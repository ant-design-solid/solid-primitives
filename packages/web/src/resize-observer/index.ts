import { Accessor, createEffect, createMemo, createRoot, onCleanup } from 'solid-js'
import { access, MaybeAccessor, MaybeElement, toArray, tryOnCleanup } from '@s-primitives/shared'
import { ConfigurableWindow, defaultWindow } from '../_configurable'

export interface CreateResizeObserverOptions extends ResizeObserverOptions, ConfigurableWindow {
  controls?: boolean
}

export interface CreateResizeObserverControls {
  stop: VoidFunction
  isSupported: Accessor<boolean>
}

export function createResizeObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: ResizeObserverCallback,
  options: CreateResizeObserverOptions & { controls: true },
): CreateResizeObserverControls

// 3. 重载签名 B：默认情况，返回 undefined
export function createResizeObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: ResizeObserverCallback,
  options?: CreateResizeObserverOptions,
): undefined

// 4. 实现签名：必须包含所有可能的返回类型，使用联合类型
export function createResizeObserver(
  target: MaybeAccessor<MaybeElement> | MaybeAccessor<MaybeElement[]>,
  callback: ResizeObserverCallback,
  options: CreateResizeObserverOptions = {},
): CreateResizeObserverControls | undefined {
  const { window = defaultWindow, controls = false, ...observerOptions } = options ?? {}

  const isSupported = createMemo(() => !!window && 'ResizeObserver' in window)

  const targets = createMemo(() => {
    const t = toArray(access(target))
    return t.map(v => access(v)).filter(v => v != null)
  })

  const attach = () => {
    if (!isSupported()) return
    const observer = new ResizeObserver(callback)
    targets().forEach(v => observer.observe(v, observerOptions))
    onCleanup(() => {
      observer.disconnect()
    })
  }

  if (controls) {
    const dispose = createRoot(dispose => {
      createEffect(attach)
      return dispose
    })

    tryOnCleanup(dispose)

    return {
      isSupported,
      stop: dispose,
    }
  }

  createEffect(attach)
}
