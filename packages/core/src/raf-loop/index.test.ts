import { createRoot } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createRafLoop, type CreateRafLoopOptions } from './index'

function createFrameScheduler() {
  let nextId = 1
  const callbacks = new Map<number, FrameRequestCallback>()

  return {
    request: vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++
      callbacks.set(id, callback)
      return id
    }),
    cancel: vi.fn((id: number) => {
      callbacks.delete(id)
    }),
    pending: () => callbacks.size,
    runNext: (time: number) => {
      const next = callbacks.entries().next()
      if (next.done) return false

      const [id, callback] = next.value
      callbacks.delete(id)
      callback(time)
      return true
    },
  }
}

function withRafLoop(
  options: CreateRafLoopOptions,
  run: (context: {
    raf: ReturnType<typeof createRafLoop>
    scheduler: ReturnType<typeof createFrameScheduler>
    callback: ReturnType<typeof vi.fn>
  }) => void | Promise<void>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    createRoot(dispose => {
      const scheduler = createFrameScheduler()
      const callback = vi.fn()
      const target = {
        requestAnimationFrame: scheduler.request,
        cancelAnimationFrame: scheduler.cancel,
      } as unknown as Window

      const raf = createRafLoop(callback, {
        window: target,
        ...options,
      })

      Promise.resolve(run({ raf, scheduler, callback })).then(
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

describe('createRafLoop', () => {
  it('默认应立即启动并在每帧执行回调', () => {
    return withRafLoop({}, ({ raf, scheduler, callback }) => {
      expect(raf.isActive()).toBe(true)
      expect(scheduler.request).toHaveBeenCalledTimes(1)
      expect(scheduler.pending()).toBe(1)

      scheduler.runNext(16)
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenLastCalledWith({
        timestamp: 16,
        delta: 0,
      })
      expect(scheduler.pending()).toBe(1)

      scheduler.runNext(32)
      expect(callback).toHaveBeenCalledTimes(2)
      expect(callback).toHaveBeenLastCalledWith({
        timestamp: 32,
        delta: 16,
      })
    })
  })

  it('pause 与 resume 应分别取消和恢复帧循环', () => {
    return withRafLoop({ immediate: false }, ({ raf, scheduler, callback }) => {
      expect(raf.isActive()).toBe(false)
      expect(scheduler.pending()).toBe(0)

      raf.resume()
      expect(raf.isActive()).toBe(true)
      expect(scheduler.pending()).toBe(1)

      raf.pause()
      expect(raf.isActive()).toBe(false)
      expect(scheduler.cancel).toHaveBeenCalledTimes(1)
      expect(scheduler.pending()).toBe(0)

      raf.resume()
      scheduler.runNext(20)
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  it('once 模式应只执行一帧后自动停止', () => {
    return withRafLoop({ once: true }, ({ raf, scheduler, callback }) => {
      scheduler.runNext(16)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(raf.isActive()).toBe(false)
      expect(scheduler.pending()).toBe(0)
    })
  })

  it('fpsLimit 应跳过过快的帧直到达到间隔阈值', () => {
    return withRafLoop({ fpsLimit: 10 }, ({ scheduler, callback }) => {
      scheduler.runNext(10)
      expect(callback).not.toHaveBeenCalled()
      expect(scheduler.pending()).toBe(1)

      scheduler.runNext(50)
      expect(callback).not.toHaveBeenCalled()
      expect(scheduler.pending()).toBe(1)

      scheduler.runNext(120)
      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenLastCalledWith({
        timestamp: 120,
        delta: 110,
      })
    })
  })

  it('回调返回 false 时应停止续帧', () => {
    return new Promise((resolve, reject) => {
      createRoot(dispose => {
        const scheduler = createFrameScheduler()
        const callback = vi.fn(() => false)
        const target = {
          requestAnimationFrame: scheduler.request,
          cancelAnimationFrame: scheduler.cancel,
        } as unknown as Window

        const raf = createRafLoop(callback, {
          window: target,
        })

        Promise.resolve()
          .then(() => {
            scheduler.runNext(16)

            expect(callback).toHaveBeenCalledTimes(1)
            expect(raf.isActive()).toBe(false)
            expect(scheduler.pending()).toBe(0)
          })
          .then(
            () => {
              dispose()
              resolve(undefined)
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
