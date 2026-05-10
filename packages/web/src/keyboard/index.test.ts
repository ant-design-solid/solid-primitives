import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createShortcut, makeKeyboard, MakeKeyboardOptions } from './index'

function withKeyboard(
  options: MakeKeyboardOptions = {},
  run: (keyboard: ReturnType<typeof makeKeyboard>) => void | Promise<void>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    createRoot(dispose => {
      const keyboard = makeKeyboard({
        window,
        ...options,
      })

      Promise.resolve()
        .then(() => undefined)
        .then(() => run(keyboard))
        .then(
          () => {
            dispose()
            resolve()
          },
          error => {
            dispose()
            reject(error)
          },
        )
    })
  })
}

async function dispatchKeyDown(target: EventTarget, init: KeyboardEventInit = {}): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })

  target.dispatchEvent(event)
  await Promise.resolve()
  return event
}

function createKeyboardTarget(platform: string) {
  return Object.assign(new EventTarget(), {
    navigator: { platform },
  }) as Window
}

describe('useKeyboard', () => {
  it('mod 应按平台解析，并支持 command/cmd 别名', async () => {
    const macTarget = createKeyboardTarget('MacIntel')

    await withKeyboard({ window: macTarget }, async keyboard => {
      const modAction = vi.fn()
      const commandAction = vi.fn()
      const cmdAction = vi.fn()

      keyboard.bind('mod+a', modAction)
      keyboard.bind('command+b', commandAction)
      keyboard.bind('cmd+c', cmdAction)

      await dispatchKeyDown(macTarget, {
        key: 'a',
        code: 'KeyA',
        metaKey: true,
      })
      await dispatchKeyDown(macTarget, {
        key: 'b',
        code: 'KeyB',
        metaKey: true,
      })
      await dispatchKeyDown(macTarget, {
        key: 'c',
        code: 'KeyC',
        metaKey: true,
      })
      await dispatchKeyDown(macTarget, {
        key: 'a',
        code: 'KeyA',
        ctrlKey: true,
      })

      expect(modAction).toHaveBeenCalledTimes(1)
      expect(commandAction).toHaveBeenCalledTimes(1)
      expect(cmdAction).toHaveBeenCalledTimes(1)
    })

    const windowsTarget = createKeyboardTarget('Win32')

    await withKeyboard({ window: windowsTarget }, async keyboard => {
      const action = vi.fn()

      keyboard.bind('mod+d', action)

      await dispatchKeyDown(windowsTarget, {
        key: 'd',
        code: 'KeyD',
        ctrlKey: true,
      })
      await dispatchKeyDown(windowsTarget, {
        key: 'd',
        code: 'KeyD',
        metaKey: true,
      })

      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  it('数组形式绑定应作为多个独立快捷键处理', async () => {
    const target = createKeyboardTarget('Win32')

    await withKeyboard({ window: target }, async keyboard => {
      const action = vi.fn()

      keyboard.bind(['ctrl+a', 'meta+a'], action)

      await dispatchKeyDown(target, { key: 'a', code: 'KeyA', ctrlKey: true })
      await dispatchKeyDown(target, { key: 'a', code: 'KeyA', metaKey: true })

      expect(action).toHaveBeenCalledTimes(2)
    })
  })

  it('同一快捷键应允许多个处理器', async () => {
    const target = createKeyboardTarget('Win32')

    await withKeyboard({ window: target }, async keyboard => {
      const first = vi.fn()
      const second = vi.fn()

      keyboard.bind('ctrl+j', first)
      keyboard.bind('ctrl+j', second)

      await dispatchKeyDown(target, { key: 'j', code: 'KeyJ', ctrlKey: true })

      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
      expect(second.mock.invocationCallOrder[0]).toBeLessThan(first.mock.invocationCallOrder[0])
    })
  })

  it('unbind 后快捷键不应再触发', async () => {
    const target = createKeyboardTarget('Win32')

    await withKeyboard({ window: target }, async keyboard => {
      const action = vi.fn()

      const off = keyboard.bind('ctrl+k', action)

      await dispatchKeyDown(target, { key: 'k', code: 'KeyK', ctrlKey: true })
      expect(action).toHaveBeenCalledTimes(1)

      off()
      await dispatchKeyDown(target, { key: 'k', code: 'KeyK', ctrlKey: true })
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  it('trigger 与 reset 应分别执行触发与清空绑定', async () => {
    const target = createKeyboardTarget('Win32')

    await withKeyboard({ window: target }, async keyboard => {
      const action = vi.fn()

      keyboard.bind('ctrl+l', action)
      keyboard.trigger('ctrl+l')
      expect(action).toHaveBeenCalledTimes(1)

      keyboard.reset()
      keyboard.trigger('ctrl+l')
      await dispatchKeyDown(target, { key: 'l', code: 'KeyL', ctrlKey: true })
      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  it('输入元素默认不应触发快捷键', async () => {
    await withKeyboard({}, async keyboard => {
      const action = vi.fn()
      const input = document.createElement('input')

      document.body.appendChild(input)
      keyboard.bind('delete', action)

      try {
        await dispatchKeyDown(input, { key: 'Delete', code: 'Delete' })
        expect(action).not.toHaveBeenCalled()
      } finally {
        input.remove()
      }
    })
  })

  it('plus/++ 写法应匹配 shift 产生的加号键', async () => {
    const target = createKeyboardTarget('MacIntel')

    await withKeyboard({ window: target }, async keyboard => {
      const action = vi.fn()

      keyboard.bind('mod++', action)

      const event = await dispatchKeyDown(target, {
        key: '+',
        code: 'Equal',
        ctrlKey: true,
        shiftKey: true,
      })

      expect(action).toHaveBeenCalledTimes(1)
      expect(event.defaultPrevented).toBe(true)
    })
  })

  it('按键序列应保持可用', async () => {
    const target = createKeyboardTarget('Win32')

    await withKeyboard({ window: target }, async keyboard => {
      const action = vi.fn()

      keyboard.bind('g i', action)

      await dispatchKeyDown(target, { key: 'g', code: 'KeyG' })
      await dispatchKeyDown(target, { key: 'i', code: 'KeyI' })

      expect(action).toHaveBeenCalledTimes(1)
    })
  })

  it('非 shift 必需字符不应容忍额外修饰键', async () => {
    const target = createKeyboardTarget('Win32')

    await withKeyboard({ window: target }, async keyboard => {
      const action = vi.fn()

      keyboard.bind('ctrl+a', action)

      await dispatchKeyDown(target, {
        key: 'a',
        code: 'KeyA',
        ctrlKey: true,
        shiftKey: true,
      })
      expect(action).not.toHaveBeenCalled()

      await dispatchKeyDown(target, { key: 'a', code: 'KeyA', ctrlKey: true })
      expect(action).toHaveBeenCalledTimes(1)
    })
  })
})

describe('createShortcut', () => {
  it('应独立监听快捷键', async () => {
    const target = createKeyboardTarget('Win32')
    const action = vi.fn()

    await new Promise<void>((resolve, reject) => {
      createRoot(dispose => {
        createShortcut('ctrl+m', action, { window: target })

        Promise.resolve()
          .then(() => dispatchKeyDown(target, { key: 'm', code: 'KeyM', ctrlKey: true }))
          .then(
            () => {
              expect(action).toHaveBeenCalledTimes(1)
              dispose()
              resolve()
            },
            error => {
              dispose()
              reject(error)
            },
          )
      })
    })
  })

  it('pause 与 resume 应控制监听状态', async () => {
    const target = createKeyboardTarget('Win32')
    const action = vi.fn()

    await new Promise<void>((resolve, reject) => {
      createRoot(dispose => {
        const shortcut = createShortcut('ctrl+n', action, { window: target })

        Promise.resolve()
          .then(() => dispatchKeyDown(target, { key: 'n', code: 'KeyN', ctrlKey: true }))
          .then(() => {
            expect(action).toHaveBeenCalledTimes(1)
            expect(shortcut.isActive()).toBe(true)
            shortcut.pause()
            expect(shortcut.isActive()).toBe(false)
          })
          .then(() => dispatchKeyDown(target, { key: 'n', code: 'KeyN', ctrlKey: true }))
          .then(() => {
            expect(action).toHaveBeenCalledTimes(1)
            shortcut.resume()
            expect(shortcut.isActive()).toBe(true)
          })
          .then(() => Promise.resolve())
          .then(() => dispatchKeyDown(target, { key: 'n', code: 'KeyN', ctrlKey: true }))
          .then(
            () => {
              expect(action).toHaveBeenCalledTimes(2)
              dispose()
              resolve()
            },
            error => {
              dispose()
              reject(error)
            },
          )
      })
    })
  })

  it('preventDefault 可关闭', async () => {
    const target = createKeyboardTarget('Win32')
    const action = vi.fn()

    await new Promise<void>((resolve, reject) => {
      createRoot(dispose => {
        createShortcut('ctrl+o', action, { window: target, preventDefault: false })

        Promise.resolve()
          .then(() => dispatchKeyDown(target, { key: 'o', code: 'KeyO', ctrlKey: true }))
          .then(
            event => {
              expect(action).toHaveBeenCalledTimes(1)
              expect(event.defaultPrevented).toBe(false)
              dispose()
              resolve()
            },
            error => {
              dispose()
              reject(error)
            },
          )
      })
    })
  })

  it('应支持序列快捷键', async () => {
    const target = createKeyboardTarget('Win32')
    const action = vi.fn()

    await new Promise<void>((resolve, reject) => {
      createRoot(dispose => {
        createShortcut('g i', action, { window: target })

        Promise.resolve()
          .then(() => dispatchKeyDown(target, { key: 'g', code: 'KeyG' }))
          .then(() => dispatchKeyDown(target, { key: 'i', code: 'KeyI' }))
          .then(
            () => {
              expect(action).toHaveBeenCalledTimes(1)
              dispose()
              resolve()
            },
            error => {
              dispose()
              reject(error)
            },
          )
      })
    })
  })
})
