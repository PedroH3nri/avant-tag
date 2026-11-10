import { afterEach, describe, expect, it, vi } from 'vitest'

import { insertArticle, startMgid } from '../../src/mgid'

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  delete (window as Window & { _mgq?: unknown })._mgq
  vi.useRealTimers()
})

describe('MGID', () => {
  it('só liga com o ID e não repete o script', () => {
    expect(startMgid(window, { tag_id: null, smart_widget: '1', back_button: null, sidebar: null })).toBe(false)
    expect(document.querySelectorAll('[data-type="_mgwidget"]')).toHaveLength(0)
    const mgid = { tag_id: 'blog.com.1', smart_widget: '10', back_button: '20', sidebar: null }
    expect(startMgid(window, mgid)).toBe(true)
    startMgid(window, { ...mgid, smart_widget: null, back_button: null })
    expect(document.querySelectorAll('script[src*="jsc.mgid.com"]')).toHaveLength(1)
    expect([...document.querySelectorAll<HTMLElement>('[data-type="_mgwidget"]')].map((item) => item.dataset.widgetId)).toEqual(['10', '20'])
  })

  it('esconde o bloco quando o artigo não chega', () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    document.body.append(container)
    insertArticle(window, '99', container)
    expect(container.querySelector('[data-widget-id="99"]')).not.toBeNull()
    vi.advanceTimersByTime(3000)
    expect(container.style.display).toBe('none')
  })
})
