import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicAdTag } from '../../src/core/types'
import { SESSION_KEY, SESSION_MS, sessionId, startPageViews, visitorId } from '../../src/page-views'

const TAG = { key: 'tg_abcd1234', version: 3 } as PublicAdTag

let visibility: DocumentVisibilityState = 'visible'
let clock = 1_000_000

/** Muda a visibilidade da aba e avisa a página. */
function setVisibility(state: DocumentVisibilityState): void {
  visibility = state
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Liga as visitas com o relógio do teste. */
function start() {
  return startPageViews(TAG, {
    target: window,
    origin: 'https://avant.groone.com',
    device: 'mobile',
    language: 'pt',
    adblock: () => false,
    blocks: () => [{ type: 'Content1', state: 'rendered' }],
    now: () => clock,
  })
}

beforeEach(() => {
  visibility = 'visible'
  clock = 1_000_000
  localStorage.clear()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  vi.stubGlobal('navigator', { ...navigator, sendBeacon: vi.fn(() => true) })
  document.body.innerHTML = '<a id="link" href="#">Link</a>'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('startPageViews', () => {
  it('manda um resumo só, no formato do contrato, com o tempo só da aba aberta', async () => {
    const run = start()
    clock += 4000
    setVisibility('hidden')
    clock += 60_000
    setVisibility('visible')
    clock += 1000
    document.getElementById('link')?.click()
    window.dispatchEvent(new Event('pagehide'))
    setVisibility('hidden')
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)
    const [address, blob] = vi.mocked(navigator.sendBeacon).mock.calls[0] as [string, Blob]
    expect(address).toBe('https://avant.groone.com/api/tag/page-views')
    const body = JSON.parse(await blob.text())
    expect(body).toMatchObject({
      key: 'tg_abcd1234',
      version: 3,
      device: 'mobile',
      visible_ms: 4000,
      adblock: false,
      blocks: [{ type: 'Content1', state: 'rendered' }],
    })
    expect(Object.keys(body).sort()).toEqual(
      [
        'adblock', 'blocks', 'clicked', 'content_hash', 'device', 'id_post', 'key', 'language',
        'page_view_id', 'referrer', 'scroll_percent', 'session_id', 'url', 'version', 'visible_ms',
        'visitor_id',
      ].sort(),
    )
    expect(run.send()).toBe(false)
    expect(run.body().clicked).toBe(true)
  })

  it('guarda o visitante e renova a sessão depois de 10 minutos', () => {
    const visitor = visitorId(window)
    expect(visitorId(window)).toBe(visitor)
    const first = sessionId(window, 0)
    expect(sessionId(window, SESSION_MS - 1)).toBe(first)
    expect(sessionId(window, SESSION_MS * 3)).not.toBe(first)
    localStorage.setItem(SESSION_KEY, 'quebrado')
    expect(sessionId(window, 0)).toMatch(/^[0-9a-f-]{36}$/)
  })
})
