import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import { createScrollLock } from './index'

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

describe('createScrollLock', () => {
  it('locks and restores the original overflow', async () => {
    await withRoot(async () => {
      const element = document.createElement('div')
      element.style.overflow = 'scroll'

      const [isLocked, setLocked] = createScrollLock(element)

      expect(isLocked()).toBe(false)

      setLocked(true)
      await Promise.resolve()
      expect(isLocked()).toBe(true)
      expect(element.style.overflow).toBe('hidden')

      setLocked(false)
      await Promise.resolve()
      expect(isLocked()).toBe(false)
      expect(element.style.overflow).toBe('scroll')
    })
  })

  it('restores the previous target when the element accessor changes', async () => {
    await withRoot(async () => {
      const first = document.createElement('div')
      const second = document.createElement('div')
      first.style.overflow = 'auto'
      second.style.overflow = 'scroll'

      const [element, setElement] = createSignal<HTMLElement | null>(first)
      createScrollLock(element, true)
      await Promise.resolve()

      expect(first.style.overflow).toBe('hidden')
      expect(second.style.overflow).toBe('scroll')

      setElement(second)
      await Promise.resolve()

      expect(first.style.overflow).toBe('auto')
      expect(second.style.overflow).toBe('hidden')
    })
  })
})
