import { describe, expect, it, vi } from 'vitest'
import * as dynamicCSS from './dynamicCSS'
import { injectCSS, removeCSS } from './dynamicCSS'
import { getTargetScrollbarSize } from './scrollbar'

describe('injectCSS', () => {
  it('prepend queue 应写入 priority 属性并按优先级排序', () => {
    const first = injectCSS('.first {}', {
      prepend: 'queue',
      priority: 0,
      mark: 'dom-test',
    })
    const second = injectCSS('.second {}', {
      prepend: 'queue',
      priority: 1,
      mark: 'dom-test',
    })

    try {
      expect(first?.getAttribute('data-sp-priority')).toBe('0')
      expect(second?.getAttribute('data-sp-priority')).toBe('1')
      expect(document.head.firstChild).toBe(first)
      expect(first?.nextSibling).toBe(second)
    } finally {
      first?.remove()
      second?.remove()
      removeCSS('dom-test', { mark: 'dom-test' })
    }
  })
})

describe('getTargetScrollbarSize', () => {
  it('webkit 样式注入失败时应分别回退宽高', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)

    const updateCSSMock = vi.spyOn(dynamicCSS, 'updateCSS').mockImplementation(() => {
      throw new Error('inject failed')
    })
    const getComputedStyleMock = vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElt) => {
      if (pseudoElt === '::-webkit-scrollbar') {
        return {
          width: '11px',
          height: '7px',
        } as CSSStyleDeclaration
      }

      return {
        scrollbarColor: '',
        scrollbarWidth: '',
      } as CSSStyleDeclaration
    })

    try {
      expect(getTargetScrollbarSize(target)).toEqual({ width: 11, height: 7 })
    } finally {
      getComputedStyleMock.mockRestore()
      updateCSSMock.mockRestore()
      target.remove()
    }
  })
})
