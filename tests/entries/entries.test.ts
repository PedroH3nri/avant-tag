import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicAdTag } from '../../src/core/types'
import { boot as bootReward } from '../../src/reward'
import { runTag } from '../../src/tag'

type FlaggedWindow = Window & { __avantTag?: boolean; __avantReward?: boolean; googletag?: unknown; dataLayer?: unknown }

/** A tag do blog de teste, sem loader e com o reward ligado. */
function sampleTag(changes: Partial<PublicAdTag> = {}): PublicAdTag {
  return {
    key: 'tg_abcd1234',
    version: 2,
    domain: 'localhost',
    lazy_load: false,
    analytics_id: 'G-TESTE',
    mgid: { tag_id: null, smart_widget: null, back_button: null, sidebar: null },
    reward: true,
    price_rules: false,
    loader: null,
    blocks: [],
    ...changes,
  }
}

/** Um fetch falso: a configuração da tag e nenhum reward na página. */
function fakeFetch(tag: PublicAdTag | null) {
  return vi.fn(async (address: string) => {
    if (address.includes('/api/tag/config')) return new Response(JSON.stringify({ tag }))
    if (address.includes('/api/reward/v2')) return new Response(JSON.stringify({ reward: null }))
    return new Response('{}', { status: 404 })
  })
}

beforeEach(() => {
  document.body.innerHTML = '<script data-tag="tg_abcd1234" src="https://avant.groone.com/tag.js"></script>'
  sessionStorage.setItem('avant-has-adblock', 'false')
})

afterEach(() => {
  vi.unstubAllGlobals()
  const flagged = window as FlaggedWindow
  delete flagged.__avantTag
  delete flagged.__avantReward
  delete flagged.googletag
  delete flagged.dataLayer
  document.head.innerHTML = ''
  localStorage.clear()
  sessionStorage.clear()
})

describe('tag.js', () => {
  it('roda uma vez, com a configuração da origem do script, e liga Analytics e reward', async () => {
    const fetcher = fakeFetch(sampleTag())
    vi.stubGlobal('fetch', fetcher)
    const run = await runTag(window)
    expect(run?.config.version).toBe(2)
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(/^https:\/\/avant\.groone\.com\/api\/tag\/config\?key=tg_abcd1234/)
    expect(document.querySelectorAll('script[src^="https://www.googletagmanager.com/gtag/js"]')).toHaveLength(1)
    expect(await runTag(window)).toBeNull()
    await vi.waitFor(() => expect(fetcher.mock.calls.some(([address]) => String(address).includes('/api/reward/v2'))).toBe(true), {
      timeout: 4000,
    })
    expect(await bootReward(window)).toBe(false)
  })

  it('não roda sem configuração para o domínio', async () => {
    vi.stubGlobal('fetch', fakeFetch(sampleTag({ domain: 'outro.com' })))
    expect(await runTag(window)).toBeNull()
    expect(document.querySelector('script[src*="gpt.js"]')).toBeNull()
  })

  it('com o reward.js primeiro, a tag não abre o reward de novo', async () => {
    const fetcher = fakeFetch(sampleTag())
    vi.stubGlobal('fetch', fetcher)
    expect(await bootReward(window)).toBe(true)
    await runTag(window)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(fetcher.mock.calls.filter(([address]) => String(address).includes('/api/reward/v2'))).toHaveLength(1)
  })
})
