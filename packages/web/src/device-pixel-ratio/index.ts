import { createEffect, createMemo, createSignal } from 'solid-js'
import { ConfigurableWindow, defaultWindow } from '../_configurable'
import { createMediaQuery } from '../media-query'

interface CreateDevicePixelRatioOptions extends ConfigurableWindow {}

export function createDevicePixelRatio(options: CreateDevicePixelRatioOptions = {}): () => number {
  const { window = defaultWindow } = options

  const [pixelRatio, setPixelRatio] = createSignal(1)

  const query = createMediaQuery(
    createMemo(() => `(resolution: ${pixelRatio()}dppx)`),
    options,
  )

  if (window) {
    createEffect(() => {
      query()
      setPixelRatio(window.devicePixelRatio)
    })
  }

  return pixelRatio
}
