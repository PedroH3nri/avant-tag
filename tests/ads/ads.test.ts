import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  networkOfPath,
  pageBlocks,
  pageKeyValues,
  startAds,
  startRefresh,
  type GoogleTag,
  type GptSlot,
} from '../../src/ads'
import type { PublicAdTag, PublicBlock } from '../../src/core/types'

type Listener = (event: { slot: GptSlot; isEmpty?: boolean }) => void

/** Um googletag falso que roda os comandos na hora e guarda o que a tag pediu. */
function fakeGoogletag() {
  const listeners: Record<string, Listener[]> = {}
  const slots: Array<GptSlot & { path: string; format?: number; elementId?: string }> = []
  const refreshed: GptSlot[] = []
  const displayed: Array<GptSlot | string> = []
  const configs: Array<Record<string, unknown>> = []
  const pubads = {
    addEventListener: (name: string, listener: Listener) => (listeners[name] ??= []).push(listener),
    removeEventListener: () => undefined,
    refresh: (list: GptSlot[]) => refreshed.push(...list),
  }
  /** Cria um slot falso. */
  const slot = (path: string, extra: { format?: number; elementId?: string }) => {
    const created = {
      path,
      ...extra,
      addService: () => created,
      setConfig: () => undefined,
      getSlotElementId: () => extra.elementId ?? '',
    }
    slots.push(created)
    return created
  }
  const googletag: GoogleTag = {
    cmd: { push: (command: () => void) => command() },
    enums: { OutOfPageFormat: { TOP_ANCHOR: 2, BOTTOM_ANCHOR: 3, INTERSTITIAL: 5 } },
    defineSlot: (path, _sizes, elementId) => slot(path, { elementId }),
    defineOutOfPageSlot: (path, format) => slot(path, { format }),
    pubads: () => pubads,
    setConfig: (config) => configs.push(config),
    enableServices: () => undefined,
    display: (target) => displayed.push(target),
    destroySlots: () => true,
  }
  /** Dispara um evento do GPT para os ouvintes. */
  const emit = (name: string, event: { slot: GptSlot; isEmpty?: boolean }) =>
    (listeners[name] ?? []).forEach((listener) => listener(event))
  return { googletag, slots, refreshed, displayed, configs, emit }
}

/** Um bloco com o padrão do conteúdo. */
function block(changes: Partial<PublicBlock>): PublicBlock {
  return {
    kind: 'content',
    unit_type: 'Content1',
    desktop: '/2100/blog.com/Blog_Content1_Desktop_20261028',
    mobile: '/2100/blog.com/Blog_Content1_Mobile_20261028',
    edge: null,
    selector: 'article p',
    side: 'after',
    refresh_seconds: null,
    mgid_article: null,
    rule_mode: 'all',
    paths: [],
    ...changes,
  }
}

/** A tag com os blocos pedidos. */
function tagWith(blocks: PublicBlock[]): PublicAdTag {
  return {
    key: 'tg_abcd1234',
    version: 1,
    domain: 'localhost',
    lazy_load: true,
    analytics_id: null,
    mgid: { tag_id: null, smart_widget: null, back_button: null, sidebar: null },
    reward: false,
    price_rules: false,
    loader: null,
    blocks,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = '<article><p id="first">Texto</p></article>'
  vi.stubGlobal('navigator', { ...navigator, sendBeacon: vi.fn(() => true) })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete (window as Window & { googletag?: unknown }).googletag
  document.head.innerHTML = ''
})

describe('pageBlocks', () => {
  it('respeita o aparelho e a regra de caminho, na ordem da tag', () => {
    const blocks = [
      block({ unit_type: 'Anchor', kind: 'anchor', desktop: null, edge: 'bottom' }),
      block({ rule_mode: 'include', paths: ['/receitas/*'] }),
      block({ unit_type: 'Content2', rule_mode: 'exclude', paths: ['/receitas/*'] }),
    ]
    expect(pageBlocks(tagWith(blocks), 'desktop', '/receitas/bolo').map((item) => item.unit_type)).toEqual(['Content1'])
    expect(pageBlocks(tagWith(blocks), 'mobile', '/sobre').map((item) => item.unit_type)).toEqual(['Anchor', 'Content2'])
  })
})

describe('startAds', () => {
  it('monta os blocos, os key-values e conta como cada um terminou', async () => {
    const fake = fakeGoogletag()
    ;(window as Window & { googletag?: GoogleTag }).googletag = fake.googletag
    const empty = vi.fn()
    const run = startAds(
      tagWith([
        block({}),
        block({ unit_type: 'Content2', selector: '#nada' }),
        block({ unit_type: 'Anchor', kind: 'anchor', edge: 'top', selector: null }),
        block({ unit_type: 'Fixed', kind: 'fixed', edge: 'bottom', selector: null }),
      ]),
      { target: window, origin: 'https://avant.groone.com', device: 'desktop', language: 'pt', onEmpty: empty },
    )
    await vi.advanceTimersByTimeAsync(500)
    expect(fake.slots.map((slot) => slot.path.split('/').pop())).toEqual([
      'Blog_Content1_Desktop_20261028',
      'Blog_Content1_Desktop_20261028',
      'Blog_Content1_Desktop_20261028',
    ])
    expect(fake.slots[1]?.format).toBe(2)
    expect(document.querySelector('#first + .avt-block #avant-content1')).not.toBeNull()
    expect(document.querySelector('.avt-fixed')?.getAttribute('style')).toContain('bottom: 0')
    expect(fake.configs[0]?.lazyLoad).toBeDefined()
    expect(fake.configs[0]?.targeting).toMatchObject({ land_uri: '/' })
    expect(navigator.sendBeacon).toHaveBeenCalledWith('https://avant.groone.com/api/admanager/keyvalue', expect.any(Blob))
    fake.emit('slotRenderEnded', { slot: fake.slots[0] as GptSlot, isEmpty: false })
    fake.emit('slotRenderEnded', { slot: fake.slots[1] as GptSlot, isEmpty: true })
    expect(document.querySelector('.avt-label')?.textContent).toBe('Anúncio Patrocinado')
    expect(empty).toHaveBeenCalledTimes(1)
    expect(run.results()).toEqual([
      { type: 'Content1', state: 'rendered' },
      { type: 'Anchor', state: 'empty' },
    ])
    fake.emit('impressionViewable', { slot: fake.slots[0] as GptSlot })
    await expect(run.firstViewable).resolves.toBeUndefined()
  })
})

describe('startRefresh', () => {
  it('só conta com o bloco visível e para em 5', () => {
    const fake = fakeGoogletag()
    let report: (entries: Array<Partial<IntersectionObserverEntry>>) => void = () => undefined
    class FakeObserver {
      /** Guarda quem avisa a visibilidade. */
      constructor(callback: typeof report) {
        report = callback
      }
      /** Não faz nada no teste. */
      observe(): void {}
      /** Não faz nada no teste. */
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', FakeObserver)
    const slot = { addService: () => slot, setConfig: () => undefined, getSlotElementId: () => 'x' } as GptSlot
    startRefresh(window, fake.googletag, slot, document.body, 30)
    vi.advanceTimersByTime(60_000)
    expect(fake.refreshed).toHaveLength(0)
    report([{ isIntersecting: true, intersectionRatio: 0.6 }])
    vi.advanceTimersByTime(30_000 * 7)
    expect(fake.refreshed).toHaveLength(5)
  })
})

describe('key-values', () => {
  it('pega o post do shortlink, as UTMs e a network do caminho', () => {
    document.head.innerHTML = '<link rel="shortlink" href="https://blog.com/?p=42">'
    window.history.pushState({}, '', '/receitas/bolo?utm_source=google&utm_medium=cpc')
    expect(pageKeyValues(window)).toMatchObject({
      id_post_wp: '42',
      land_uri: '/receitas/bolo',
      utm_source: 'google',
      utm_medium: 'cpc',
    })
    window.history.pushState({}, '', '/')
    expect(networkOfPath('/22893970961,2100/blog.com/Blog_Anchor')).toBe('22893970961')
    expect(networkOfPath('/2100/blog.com/Blog_Anchor')).toBe('2100')
  })
})
