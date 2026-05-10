import {
  access,
  isIOS,
  MaybeAccessor,
  MaybeArray,
  noop,
  Pausable,
  toArray,
  tryOnCleanup,
  ValueOf,
} from '@s-primitives/shared'
import { createEffect, createSignal } from 'solid-js'
import type { ConfigurableWindow } from '../_configurable'
import { defaultWindow } from '../_configurable'
import { makeEventListener } from '../event-listener'

export type KeyCombo = MaybeArray<string>

export interface MakeKeyboardOptions extends ConfigurableWindow {
  ignore?: (e: KeyboardEvent, target: Element | null, combo: string | null) => boolean
  sequenceTimeout?: number
}

export interface KeyboardBindingOptions {
  preventDefault?: boolean
  stopPropagation?: boolean
}

export interface CreateShortcutReturn extends Pausable {}

interface ParsedCombo {
  key: string | null
  modifiers: Modifier[]
}

interface BindingListener {
  token: number
  action: VoidFunction
  options: Required<KeyboardBindingOptions>
}

interface Binding {
  combos: ParsedCombo[]
  listeners: BindingListener[]
}

const PLUS_PLACEHOLDER = '__diagen_plus__'
const DEFAULT_SEQUENCE_TIMEOUT = 1000

const MODIFIER_ALIASES = {
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  os: 'meta',
} as const

const KEY_ALIASES = {
  return: 'enter',
  escape: 'esc',
  esc: 'esc',
  del: 'delete',
  delete: 'delete',
  ins: 'insert',
  insert: 'insert',
  ' ': 'space',
  space: 'space',
  spacebar: 'space',
  arrowleft: 'left',
  left: 'left',
  arrowright: 'right',
  right: 'right',
  arrowup: 'up',
  up: 'up',
  arrowdown: 'down',
  down: 'down',
  plus: '+',
} as const

const CODE_ALIASES = {
  backspace: 'backspace',
  tab: 'tab',
  enter: 'enter',
  escape: 'esc',
  space: 'space',
  delete: 'delete',
  insert: 'insert',
  home: 'home',
  end: 'end',
  pageup: 'pageup',
  pagedown: 'pagedown',
  arrowleft: 'left',
  arrowright: 'right',
  arrowup: 'up',
  arrowdown: 'down',
  metaleft: 'meta',
  metaright: 'meta',
  controlleft: 'ctrl',
  controlright: 'ctrl',
  shiftleft: 'shift',
  shiftright: 'shift',
  altleft: 'alt',
  altright: 'alt',
  minus: '-',
  equal: '=',
  bracketleft: '[',
  bracketright: ']',
  backslash: '\\',
  semicolon: ';',
  quote: "'",
  comma: ',',
  period: '.',
  slash: '/',
  backquote: '`',
} as const

const SHIFT_REQUIRED_KEYS = new Set([
  '~',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
  '_',
  '+',
  ':',
  '"',
  '<',
  '>',
  '?',
  '|',
])

type Modifier = ValueOf<typeof MODIFIER_ALIASES>

const MODIFIER_ORDER: Modifier[] = ['ctrl', 'alt', 'shift', 'meta']

const isModifier = (key: string): key is Modifier => MODIFIER_ORDER.includes(key as Modifier)

const sortModifiers = (modifiers: Modifier[]): Modifier[] =>
  [...modifiers].sort((left, right) => MODIFIER_ORDER.indexOf(left) - MODIFIER_ORDER.indexOf(right))

function normalizeKeyToken(key: string): string {
  const normalized = key.trim().toLowerCase()
  if (!normalized) return ''

  if (normalized === 'mod') {
    return isIOS ? 'meta' : 'ctrl'
  }

  if (normalized in MODIFIER_ALIASES) {
    return MODIFIER_ALIASES[normalized as keyof typeof MODIFIER_ALIASES]
  }

  if (normalized in KEY_ALIASES) {
    return KEY_ALIASES[normalized as keyof typeof KEY_ALIASES]
  }

  return normalized
}

function normalizeCode(code: string): string {
  if (!code) return ''

  if (code.startsWith('Key')) {
    return code.slice(3).toLowerCase()
  }

  if (code.startsWith('Digit')) {
    return code.slice(5)
  }

  if (/^Numpad[0-9]$/.test(code)) {
    return code.slice(6)
  }

  if (code.startsWith('Numpad')) {
    const value = code.slice(6).toLowerCase()
    if (value === 'add') return '+'
    if (value === 'subtract') return '-'
    if (value === 'multiply') return '*'
    if (value === 'divide') return '/'
    if (value === 'decimal') return '.'
    if (value === 'enter') return 'enter'
  }

  const normalized = code.toLowerCase()
  if (normalized in CODE_ALIASES) {
    return CODE_ALIASES[normalized as keyof typeof CODE_ALIASES]
  }

  return normalized
}

function normalizeEventKey(e: KeyboardEvent): string | null {
  if (e.key && e.key !== 'Unidentified') {
    const normalizedKey = normalizeKeyToken(e.key)
    if (normalizedKey) return normalizedKey
  }

  const normalizedCode = normalizeCode(e.code)
  return normalizedCode || null
}

function parseCombo(combo: string): ParsedCombo {
  const normalizedCombo = combo.trim().toLowerCase()
  if (!normalizedCombo) {
    return { key: null, modifiers: [] }
  }

  const tokens =
    normalizedCombo === '+'
      ? ['plus']
      : normalizedCombo
          .replace(/\+{2}/g, `+${PLUS_PLACEHOLDER}`)
          .split('+')
          .map(token => token.replace(PLUS_PLACEHOLDER, 'plus').trim())
          .filter(Boolean)

  const modifiers: Modifier[] = []
  let key: string | null = null

  for (const token of tokens) {
    const normalizedKey = normalizeKeyToken(token)
    if (!normalizedKey) continue

    if (isModifier(normalizedKey)) {
      if (!modifiers.includes(normalizedKey)) {
        modifiers.push(normalizedKey)
      }
      continue
    }

    key = normalizedKey
  }

  return {
    key,
    modifiers: sortModifiers(modifiers),
  }
}

function parseKeys(key: KeyCombo): ParsedCombo[][] {
  return toArray(key)
    .map(combo => combo.trim())
    .filter(Boolean)
    .map(combo =>
      combo
        .split(/\s+/)
        .map(part => parseCombo(part))
        .filter(parsed => parsed.key !== null || parsed.modifiers.length > 0),
    )
    .filter(combos => combos.length > 0)
}

function comboToId(combo: ParsedCombo): string {
  return [...combo.modifiers, ...(combo.key ? [combo.key] : [])].join('+')
}

function getBindingId(combos: ParsedCombo[]): string {
  return combos.map(comboToId).join(' ')
}

function getEventModifiers(e: KeyboardEvent): Modifier[] {
  const modifiers: Modifier[] = []

  if (e.ctrlKey) modifiers.push('ctrl')
  if (e.altKey) modifiers.push('alt')
  if (e.shiftKey) modifiers.push('shift')
  if (e.metaKey) modifiers.push('meta')

  return sortModifiers(modifiers)
}

function getEventCombo(e: KeyboardEvent): ParsedCombo {
  return {
    key: normalizeEventKey(e),
    modifiers: getEventModifiers(e),
  }
}

function matchCombo(eventCombo: ParsedCombo, combo: ParsedCombo): boolean {
  if (combo.key) {
    if (eventCombo.key !== combo.key) return false
  } else if (!eventCombo.key || !isModifier(eventCombo.key) || !combo.modifiers.includes(eventCombo.key as Modifier)) {
    return false
  }

  for (const modifier of combo.modifiers) {
    if (!eventCombo.modifiers.includes(modifier)) {
      return false
    }
  }

  const extraModifiers = eventCombo.modifiers.filter(modifier => !combo.modifiers.includes(modifier))
  if (extraModifiers.length === 0) {
    return true
  }

  return (
    combo.key !== null &&
    SHIFT_REQUIRED_KEYS.has(combo.key) &&
    !combo.modifiers.includes('shift') &&
    extraModifiers.length === 1 &&
    extraModifiers[0] === 'shift'
  )
}

function resolveElement(target: EventTarget | null): Element | null {
  if (!target) return null
  if (target instanceof Element) return target
  if (target instanceof Node) return target.parentElement
  return null
}

function getEventTargetElement(e: KeyboardEvent): Element | null {
  if (typeof e.composedPath === 'function') {
    const initialTarget = e.composedPath()[0]
    const resolved = resolveElement(initialTarget ?? null)
    if (resolved) {
      return resolved
    }
  }

  return resolveElement(e.target)
}

function defaultIgnoreCallback(_e: KeyboardEvent, target: Element | null): boolean {
  if (!target) return false

  const tagName = target.tagName
  return (
    (target as HTMLElement).isContentEditable || tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA'
  )
}

function createSequence(timeout: number) {
  let value: ParsedCombo[] = []
  let timer: ReturnType<typeof setTimeout> | null = null

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const reset = () => {
    value = []
    clear()
  }

  const push = (combo: ParsedCombo) => {
    clear()
    value = [...value, combo]
    timer = setTimeout(() => {
      value = []
      timer = null
    }, timeout)
  }

  const matches = (combos: ParsedCombo[]) => {
    if (value.length < combos.length) return false
    const recentSequence = value.slice(-combos.length)
    return recentSequence.every((combo, index) => matchCombo(combo, combos[index]))
  }

  return {
    get value() {
      return value
    },
    push,
    reset,
    matches,
  }
}

function runAction(action: VoidFunction, options: Required<KeyboardBindingOptions>, event?: KeyboardEvent) {
  if (event && options.preventDefault) {
    event.preventDefault()
  }

  if (event && options.stopPropagation) {
    event.stopPropagation()
  }

  action()
}

export function makeKeyboard(options: MakeKeyboardOptions = {}) {
  const {
    window: targetWindow = defaultWindow,
    ignore = defaultIgnoreCallback,
    sequenceTimeout = DEFAULT_SEQUENCE_TIMEOUT,
  } = options

  const bindings = new Map<string, Binding>()
  const lookup = new Map<string, Map<string, Binding>>()
  const sequence = createSequence(sequenceTimeout)
  let listenerToken = 0

  const getLookupKey = (combo: ParsedCombo) => (combo.key ? `key:${combo.key}` : `mods:${combo.modifiers.join('+')}`)

  const getEventLookupKeys = (combo: ParsedCombo) => {
    const lookupKeys: string[] = []

    if (combo.key) {
      lookupKeys.push(`key:${combo.key}`)
    }

    if (combo.modifiers.length > 0) {
      lookupKeys.push(`mods:${combo.modifiers.join('+')}`)
    }

    return lookupKeys
  }

  const removeBindingEntry = (id: string) => {
    const binding = bindings.get(id)
    if (!binding) return

    bindings.delete(id)
    const lastCombo = binding.combos[binding.combos.length - 1]
    const bucket = lookup.get(getLookupKey(lastCombo))
    if (!bucket) return

    bucket.delete(id)
    if (bucket.size === 0) {
      lookup.delete(getLookupKey(lastCombo))
    }
  }

  const removeListener = (id: string, token: number) => {
    const binding = bindings.get(id)
    if (!binding) return

    const index = binding.listeners.findIndex(listener => listener.token === token)
    if (index === -1) return

    binding.listeners.splice(index, 1)
    if (binding.listeners.length === 0) {
      removeBindingEntry(id)
    }
  }

  const ensureBinding = (combos: ParsedCombo[]): Binding => {
    const id = getBindingId(combos)
    const existing = bindings.get(id)
    if (existing) {
      return existing
    }

    const binding: Binding = {
      combos,
      listeners: [],
    }

    bindings.set(id, binding)

    const lookupKey = getLookupKey(combos[combos.length - 1])
    const bucket = lookup.get(lookupKey) ?? new Map<string, Binding>()
    bucket.set(id, binding)
    lookup.set(lookupKey, bucket)

    return binding
  }

  const getCandidates = (eventCombo: ParsedCombo): Binding[] => {
    const candidates = new Map<string, Binding>()

    for (const lookupKey of getEventLookupKeys(eventCombo)) {
      const bucket = lookup.get(lookupKey)
      if (!bucket) continue

      bucket.forEach((binding, id) => {
        candidates.set(id, binding)
      })
    }

    return Array.from(candidates.values())
  }

  const runBinding = (binding: Binding, event?: KeyboardEvent) => {
    for (let index = binding.listeners.length - 1; index >= 0; index -= 1) {
      const listener = binding.listeners[index]
      runAction(listener.action, listener.options, event)

      if (listener.options.stopPropagation) {
        break
      }
    }
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    const eventCombo = getEventCombo(e)
    const comboText = comboToId(eventCombo) || null
    const target = getEventTargetElement(e)

    if (ignore(e, target, comboText)) {
      return
    }

    sequence.push(eventCombo)

    for (const binding of getCandidates(eventCombo)) {
      const matched = binding.combos.length === 1 ? matchCombo(eventCombo, binding.combos[0]) : sequence.matches(binding.combos)
      if (!matched) continue

      runBinding(binding, e)
      sequence.reset()
      return
    }
  }

  const bind = (key: KeyCombo, action: VoidFunction, options: KeyboardBindingOptions = {}): VoidFunction => {
    const { preventDefault = true, stopPropagation = false } = options
    const ids = parseKeys(key).map(combos => {
      const binding = ensureBinding(combos)
      const token = listenerToken
      listenerToken += 1

      binding.listeners.push({
        token,
        action,
        options: {
          preventDefault,
          stopPropagation,
        },
      })

      return {
        id: getBindingId(combos),
        token,
      }
    })

    const off = () => {
      ids.forEach(({ id, token }) => removeListener(id, token))
    }

    tryOnCleanup(off)
    return off
  }

  const unbind = (key: KeyCombo): void => {
    parseKeys(key).forEach(combos => {
      removeBindingEntry(getBindingId(combos))
    })
  }

  const trigger = (key: KeyCombo): void => {
    parseKeys(key).forEach(combos => {
      const binding = bindings.get(getBindingId(combos))
      if (binding) {
        runBinding(binding)
      }
    })
  }

  const reset = (): void => {
    bindings.clear()
    lookup.clear()
    sequence.reset()
  }

  targetWindow && makeEventListener(targetWindow, 'keydown', handleKeyDown as EventListener)

  tryOnCleanup(reset)

  return { bind, unbind, trigger, reset }
}

export type MakeKeyboard = ReturnType<typeof makeKeyboard>

export interface CreateShortcutOptions extends MakeKeyboardOptions, KeyboardBindingOptions {
  immediate?: boolean
}

export function createShortcut(
  keyCombo: MaybeAccessor<KeyCombo | null | undefined>,
  action: VoidFunction,
  options: CreateShortcutOptions = {},
): CreateShortcutReturn {
  const {
    immediate = true,
    preventDefault = true,
    stopPropagation = false,
    window: targetWindow = defaultWindow,
    ignore = defaultIgnoreCallback,
    sequenceTimeout = DEFAULT_SEQUENCE_TIMEOUT,
  } = options

  const bindingOptions = {
    preventDefault,
    stopPropagation,
  }

  const [isActive, setIsActive] = createSignal(immediate)
  const sequence = createSequence(sequenceTimeout)
  let off: VoidFunction = noop

  createEffect(() => {
    const combo = access(keyCombo)
    const combos = combo ? parseKeys(combo) : []

    off()
    sequence.reset()

    if (!isActive() || !targetWindow || combos.length === 0) {
      off = noop
      return
    }

    off = makeEventListener(targetWindow, 'keydown', (e: KeyboardEvent) => {
      const eventCombo = getEventCombo(e)
      const comboText = comboToId(eventCombo) || null
      const target = getEventTargetElement(e)

      if (ignore(e, target, comboText)) {
        return
      }

      sequence.push(eventCombo)

      const matched = combos.some(parts => (parts.length === 1 ? matchCombo(eventCombo, parts[0]) : sequence.matches(parts)))
      if (!matched) return

      runAction(action, bindingOptions, e)
      sequence.reset()
    })
  })

  const pause = () => {
    off()
    sequence.reset()
    setIsActive(false)
  }

  const resume = () => {
    setIsActive(true)
  }

  tryOnCleanup(() => {
    off()
    sequence.reset()
  })

  return {
    isActive,
    pause,
    resume,
  }
}

export type CreateShortcut = ReturnType<typeof createShortcut>
