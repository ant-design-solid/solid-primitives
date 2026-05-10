import { createRoot, createSignal } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createListMotion, createSwitchMotion, tween } from './index'

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

describe('tween', () => {
  it('结束帧前的插值不应超过目标值', async () => {
    const setSource = vi.fn()

    const dateNow = vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(150)

    try {
      await tween(setSource, 0, 100, {
        duration: 100,
      })
    } finally {
      dateNow.mockRestore()
    }

    expect(setSource.mock.calls.map(args => args[0])).toEqual([0, 100, 100])
  })
})

describe('createSwitchMotion', () => {
  it('out-in 模式应先退出再进入下一个元素', async () => {
    await withRoot(async () => {
      const [source, setSource] = createSignal<'a' | 'b'>('a')
      const onEnter = vi.fn()
      let finishExit: VoidFunction | undefined

      const motion = createSwitchMotion(source, {
        mode: 'out-in',
        onEnter,
        onExit: (_, done) => {
          finishExit = done
        },
      })

      expect(motion()).toEqual(['a'])

      setSource('b')
      await flush()

      expect(motion()).toEqual(['a'])
      expect(onEnter).not.toHaveBeenCalled()

      finishExit?.()
      await flush()

      expect(motion()).toEqual(['b'])
      expect(onEnter).toHaveBeenCalledTimes(1)
      expect(onEnter.mock.calls[0]?.[0]).toBe('b')
    })
  })
})

describe('createListMotion', () => {
  it('默认移除流程应先保留退出元素，完成后再真正删除', async () => {
    await withRoot(async () => {
      const a = { id: 'a' }
      const b = { id: 'b' }
      const [source, setSource] = createSignal([a, b])
      let finishRemoved: ((els: typeof source extends any ? never : never) => void) | undefined
      const onChange = vi.fn(payload => {
        finishRemoved = payload.finishRemoved
      })

      const motion = createListMotion(source, { onChange })

      expect(motion()).toEqual([a, b])

      setSource([b])
      await flush()

      expect(motion()).toEqual([b, a])
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0]?.[0].removed).toEqual([a])
      expect(onChange.mock.calls[0]?.[0].unchanged).toEqual([b])

      finishRemoved?.([a] as never)
      await flush()

      expect(motion()).toEqual([b])
      expect(onChange).toHaveBeenCalledTimes(2)
      expect(onChange.mock.calls[1]?.[0].removed).toEqual([])
      expect(onChange.mock.calls[1]?.[0].unchanged).toEqual([b])
    })
  })
})

