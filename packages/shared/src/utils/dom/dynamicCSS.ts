import { canUseDom } from './env'

const APPEND_ORDER = 'data-sp-order'
const APPEND_PRIORITY = 'data-sp-priority'
const MARK_KEY = `sp-util-key`

const containerCache = new Map<ContainerType, Node & ParentNode>()

export type ContainerType = Element | ShadowRoot
export type Prepend = boolean | 'queue'
export type AppendType = 'prependQueue' | 'append' | 'prepend'

interface DynamicCSSOptions {
  attachTo?: ContainerType
  csp?: { nonce?: string }
  prepend?: Prepend
  /**
   * Config the `priority` of `prependQueue`. Default is `0`.
   * It's useful if you need to insert style before other style.
   */
  priority?: number
  mark?: string
}

function getMark({ mark }: DynamicCSSOptions) {
  if (mark) return mark.startsWith('data-') ? mark : `data-${mark}`

  return MARK_KEY
}

function getContainer(options: DynamicCSSOptions) {
  if (options.attachTo) return options.attachTo
  const head = document.querySelector('head')

  return head || document.body
}

function getOrder(prepend?: Prepend): AppendType {
  if (prepend === 'queue') return 'prependQueue'

  return prepend ? 'prepend' : 'append'
}

function findStyles(container: ContainerType) {
  return Array.from((containerCache.get(container) || container).children).filter(
    node => node.tagName === 'STYLE',
  ) as HTMLStyleElement[]
}

function findExistNode(key: string, options: DynamicCSSOptions) {
  const container = getContainer(options)
  return container.querySelector<HTMLStyleElement>(`style[${getMark(options)}="${key}"]`)
}

function syncRealContainer(container: ContainerType, options: DynamicCSSOptions) {
  const cached = containerCache.get(container)

  if (!cached || !document.contains(cached)) {
    const placeholderStyle = injectCSS('', options)!
    const { parentNode } = placeholderStyle
    containerCache.set(container, parentNode!)
    container.removeChild(placeholderStyle)
  }
}

export function injectCSS(css: string, options: DynamicCSSOptions = {}) {
  if (!canUseDom()) return null
  const { csp, prepend, priority = 0 } = options
  const mergedOrder = getOrder(prepend)
  const isPrependQueue = mergedOrder === 'prependQueue'

  const styleNode = document.createElement('style')
  styleNode.setAttribute(APPEND_ORDER, mergedOrder)

  if (isPrependQueue) {
    styleNode.setAttribute(APPEND_PRIORITY, `${priority}`)
  }

  csp?.nonce && (styleNode.nonce = csp.nonce)

  styleNode.innerHTML = css

  const container = getContainer(options)

  if (prepend) {
    if (isPrependQueue) {
      const existStyle = findStyles(container).filter(node => {
        if (!['prepend', 'prependQueue'].includes(node.getAttribute(APPEND_ORDER)!)) {
          return false
        }
        const nodePriority = +(node.getAttribute(APPEND_PRIORITY) || 0)
        return priority >= nodePriority
      })

      if (existStyle.length) {
        container.insertBefore(styleNode, existStyle[existStyle.length - 1].nextSibling)

        return styleNode
      }
    }
    container.insertBefore(styleNode, container.firstChild)
  } else {
    container.appendChild(styleNode)
  }
  return styleNode
}

export function updateCSS(css: string, key: string, option: DynamicCSSOptions = {}) {
  if (!canUseDom()) {
    return null
  }
  const container = getContainer(option)

  syncRealContainer(container, option)

  const existNode = findExistNode(key, option)

  if (existNode) {
    if (option.csp?.nonce && existNode.nonce !== option.csp?.nonce) existNode.nonce = option.csp?.nonce

    if (existNode.innerHTML !== css) existNode.innerHTML = css

    return existNode
  }

  const newNode: any = injectCSS(css, option)
  newNode.setAttribute(getMark(option), key)
  return newNode
}

export function removeCSS(key: string, options: DynamicCSSOptions = {}) {
  if (!canUseDom()) return
  const existNode = findExistNode(key, options)

  if (existNode) {
    const container = getContainer(options)
    container.removeChild(existNode)
  }
}
