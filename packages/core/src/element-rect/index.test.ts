import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { createElementRect } from './index'

function withRoot<T>(run: () => T | Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    createRoot(dispose => {
      let result: T | Promise<T>

      try {
        result = run()
      } catch (error) {
        dispose()
        reject(error)
        return
      }

      Promise.resolve(result).then(
        value => {
          dispose()
          resolve(value)
        },
        error => {
          dispose()
          reject(error)
        },
      )
    })
  })
}

function mockRect(element: HTMLElement, rect: Partial<DOMRect>) {
  element.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      toJSON() {
        return this
      },
      ...rect,
    }) as DOMRect
}

describe('createElementRect', () => {
  it('切换目标元素后应立即刷新最新矩形', async () => {
    await withRoot(async () => {
      const first = document.createElement('div')
      const second = document.createElement('div')

      mockRect(first, { width: 100, height: 50, left: 10, top: 20, right: 110, bottom: 70, x: 10, y: 20 })
      mockRect(second, { width: 200, height: 80, left: 30, top: 40, right: 230, bottom: 120, x: 30, y: 40 })

      const [element, setElement] = createSignal<HTMLElement | null>(first)
      const { rect } = createElementRect(element)

      await Promise.resolve()

      expect(rect()).toMatchObject({
        width: 100,
        height: 50,
        left: 10,
        top: 20,
        right: 110,
        bottom: 70,
        x: 10,
        y: 20,
      })

      setElement(second)
      await Promise.resolve()

      expect(rect()).toMatchObject({
        width: 200,
        height: 80,
        left: 30,
        top: 40,
        right: 230,
        bottom: 120,
        x: 30,
        y: 40,
      })
    })
  })
})
