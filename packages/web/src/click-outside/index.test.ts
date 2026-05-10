import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { onClickOutside } from './index'

function withRoot(run: () => void | Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    createRoot(dispose => {
      Promise.resolve(run()).then(
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

const flush = () => Promise.resolve()

describe('onClickOutside', () => {
  it('点击目标外部时应触发处理器', async () => {
    await withRoot(async () => {
      const target = document.createElement('div')
      const outside = document.createElement('button')
      const handler = vi.fn()

      document.body.append(target, outside)
      onClickOutside(target, handler)
      await flush()

      outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(handler).toHaveBeenCalledTimes(1)

      target.remove()
      outside.remove()
    })
  })

  it('点击目标内部时不应触发处理器', async () => {
    await withRoot(async () => {
      const target = document.createElement('div')
      const inside = document.createElement('button')
      const handler = vi.fn()

      target.appendChild(inside)
      document.body.appendChild(target)
      onClickOutside(target, handler)
      await flush()

      inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      inside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(handler).not.toHaveBeenCalled()

      target.remove()
    })
  })

  it('点击 open shadow root 内部时不应触发处理器', async () => {
    await withRoot(async () => {
      const host = document.createElement('div')
      const shadow = host.attachShadow({ mode: 'open' })
      const inside = document.createElement('button')
      const handler = vi.fn()

      shadow.appendChild(inside)
      document.body.appendChild(host)
      onClickOutside(host, handler)
      await flush()

      inside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
      inside.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }))

      expect(handler).not.toHaveBeenCalled()

      host.remove()
    })
  })

  it('点击 shadow host 外部时应触发处理器', async () => {
    await withRoot(async () => {
      const host = document.createElement('div')
      const shadow = host.attachShadow({ mode: 'open' })
      const inside = document.createElement('button')
      const outside = document.createElement('button')
      const handler = vi.fn()

      shadow.appendChild(inside)
      document.body.append(host, outside)
      onClickOutside(host, handler)
      await flush()

      outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(handler).toHaveBeenCalledTimes(1)

      host.remove()
      outside.remove()
    })
  })

  it('ignore 选择器在 shadow 场景下仍应生效', async () => {
    await withRoot(async () => {
      const host = document.createElement('div')
      const shadow = host.attachShadow({ mode: 'open' })
      const inside = document.createElement('button')
      const ignored = document.createElement('button')
      const handler = vi.fn()

      ignored.className = 'ignored-outside'
      shadow.appendChild(inside)
      document.body.append(host, ignored)
      onClickOutside(host, handler, { ignore: ['.ignored-outside'] })
      await flush()

      ignored.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      ignored.dispatchEvent(new MouseEvent('click', { bubbles: true }))

      expect(handler).not.toHaveBeenCalled()

      host.remove()
      ignored.remove()
    })
  })
})

