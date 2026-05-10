import { isServer } from 'solid-js/web'

export interface ConfigurableWindow {
  /*
   * Specify a custom `window` instance, e.g. working with iframes or in testing environments.
   */
  window?: Window
}

export const defaultWindow = isServer ? undefined : window
