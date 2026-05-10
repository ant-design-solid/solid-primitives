import { Accessor, createEffect, createMemo, createRoot, createSignal } from 'solid-js'
import { access, MaybeAccessor, MaybeElement, tryOnCleanup, toArray } from '@s-primitives/shared'
import { defaultWindow } from '../_configurable'
import { createResizeObserver, CreateResizeObserverControls, CreateResizeObserverOptions } from '../resize-observer'

type ElementSize = Record<'width' | 'height', number>

export interface CreateElementSizeOptions extends CreateResizeObserverOptions {
  initialSize?: ElementSize
}

type CreateElementSizeBaseReturn = {
  size: Accessor<ElementSize>
}

export interface CreateElementSizeControls extends CreateResizeObserverControls {}

export function createElementSize(
  target: MaybeAccessor<MaybeElement>,
  options: CreateElementSizeOptions & { controls: true },
): CreateElementSizeControls & CreateElementSizeBaseReturn
export function createElementSize(
  target: MaybeAccessor<MaybeElement>,
  options?: CreateElementSizeOptions,
): CreateElementSizeBaseReturn
export function createElementSize(
  target: MaybeAccessor<MaybeElement>,
  options: CreateElementSizeOptions = {},
): (CreateElementSizeControls & CreateElementSizeBaseReturn) | CreateElementSizeBaseReturn {
  const { initialSize = { width: 0, height: 0 }, ...resizeObserverOptions } = options
  const { window = defaultWindow, box = 'content-box' } = resizeObserverOptions
  const isSVG = createMemo(() => access(target)?.namespaceURI?.includes('svg'))
  const [size, _setSize] = createSignal({ ...initialSize })

  const setSize = (width: number, height: number) => _setSize({ width, height })

  const control = createResizeObserver(
    target,
    ([entry]) => {
      const boxSize =
        box === 'border-box'
          ? entry.borderBoxSize
          : box === 'content-box'
            ? entry.contentBoxSize
            : entry.devicePixelContentBoxSize

      if (window && isSVG()) {
        const el = access(target)
        if (el) {
          const rect = el.getBoundingClientRect()
          setSize(rect.width, rect.height)
        }
      }

      if (boxSize) {
        const formatBoxSize = toArray(boxSize)
        const width = formatBoxSize.reduce((acc, { inlineSize }) => acc + inlineSize, 0)
        const height = formatBoxSize.reduce((acc, { blockSize }) => acc + blockSize, 0)

        setSize(width, height)
      } else {
        setSize(entry.contentRect.width, entry.contentRect.height)
      }
    },
    resizeObserverOptions,
  ) as any

  const attach = () => {
    const el = access(target)
    if (el) {
      const width = 'offsetWidth' in el ? el.clientWidth : initialSize.width
      const height = 'offsetHeight' in el ? el.clientHeight : initialSize.height

      setSize(width, height)
    }
  }

  if (control) {
    const dispose = createRoot(dispose => {
      createEffect(attach)
      return dispose
    })

    const stop = () => {
      dispose()
      control.stop()
    }

    tryOnCleanup(dispose)

    return {
      ...control,
      stop,
      size,
    }
  }

  createEffect(attach)

  return {
    size,
  }
}

export type CreateElementSize = ReturnType<typeof createElementSize>
