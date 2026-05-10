import { describe, expect, it, vi } from 'vitest'
import { debounce } from './scheduled'

describe('debounce', () => {
  it('应使用最后一次调用的 this 与参数执行', async () => {
    vi.useFakeTimers()

    try {
      const callback = vi.fn(function (this: { prefix: string }, value: string) {
        return `${this.prefix}:${value}`
      })

      const debounced = debounce(callback, 10)
      const first = { prefix: 'first' }
      const second = { prefix: 'second' }

      const firstPromise = debounced.call(first, 'a')
      const secondPromise = debounced.call(second, 'b')

      await vi.advanceTimersByTimeAsync(10)

      await expect(firstPromise).resolves.toBe('second:b')
      await expect(secondPromise).resolves.toBe('second:b')
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback.mock.calls[0]).toEqual(['b'])
      expect(callback.mock.contexts[0]).toBe(second)
    } finally {
      vi.useRealTimers()
    }
  })
})
