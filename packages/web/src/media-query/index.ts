import { access, isFunction, MaybeAccessor } from '@s-primitives/shared'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { ConfigurableWindow, defaultWindow } from '../_configurable'
import { useEventListener } from '../event-listener'

export function createMediaQuery(query: MaybeAccessor<string>, options: ConfigurableWindow = {}) {
  const { window = defaultWindow } = options
  const isSupported = createMemo(() => window && 'metachMedia' in window && isFunction(window.matchMedia))

  const [mediaQuery, setMediaQuery] = createSignal<MediaQueryList>()
  const [matches, setMatches] = createSignal(false)

  const handler = (event: MediaQueryListEvent) => {
    setMatches(event.matches)
  }

  createEffect(() => {
    if (!isSupported()) return
    const mediaQuery = window?.matchMedia(access(query))
    setMediaQuery(mediaQuery)
    setMatches(mediaQuery!.matches)
  })

  useEventListener(mediaQuery, 'change', handler, { passive: true })

  return matches
}
