import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startAds, type GoogleTag, type GptSlot } from '../../src/ads'
import { CASCADE_KINDS, startCascade, tryTargeting } from '../../src/ads/cascade'
import type { PublicAdTag, PublicBlock } from '../../src/core/types'
import { adTargeting, startPriceRules, type PriceRulesRun } from '../../src/price-rules'

type Listener = (event: { slot: GptSlot; isEmpty?: boolean }) => void
type FakeSlot = GptSlot & { targeting: Record<string, string>; configs: Array<Record<string, unknown>> }

const LADDER = ['1.22', '1.13', '1.05']
const ANCHOR_PATH = '/2100/blog.com/Blog_Anchor_Desktop_20261028'

/** Um googletag falso que roda os comandos na hora e guarda refresh e destroySlots. */
function fakeGoogletag() {
  const listeners: Record<string, Listener[]> = {}
  const slots: FakeSlot[] = []
  const refresh = vi.fn()
  const destroySlots = vi.fn(() => true)
  const pubads = {
    addEventListener: (name: string, listener: Listener) => (listeners[name] ??= []).push(listener),
    removeEventListener: () => undefined,
    refresh,
  }
  /** Cria um slot falso que junta o targeting por key, como o GPT: null apaga a key. */
  const slot = (): FakeSlot => {
    const created: FakeSlot = {
      targeting: {},
      configs: [],
      addService: () => created,
      setConfig: (config: Record<string, unknown>) => {
        created.configs.push(config)
        if (config.targeting === null) created.targeting = {}
        else if (config.targeting) {
          const merged: Record<string, string> = { ...created.targeting }
          for (const [key, value] of Object.entries(config.targeting as Record<string, string | null>)) {
            if (value === null) delete merged[key]
            else merged[key] = value
          }
          created.targeting = merged
        }
      },
      getSlotElementId: () => '',
    }
    slots.push(created)
    return created
  }
  const googletag: GoogleTag = {
    cmd: { push: (command: () => void) => command() },
    enums: { OutOfPageFormat: { TOP_ANCHOR: 2, BOTTOM_ANCHOR: 3, INTERSTITIAL: 5 } },
    defineSlot: () => slot(),
    defineOutOfPageSlot: () => slot(),
    pubads: () => pubads,
    setConfig: () => undefined,
    enableServices: () => undefined,
    display: () => undefined,
    destroySlots,
  }
  /** Dispara um evento do GPT para os ouvintes. */
  const emit = (name: string, event: { slot: GptSlot; isEmpty?: boolean }) =>
    (listeners[name] ?? []).forEach((listener) => listener(event))
  return { googletag, slots, refresh, destroySlots, emit }
}

/** Um bloco da âncora, ou do que for pedido. */
function block(changes: Partial<PublicBlock>): PublicBlock {
  return {
    kind: 'anchor',
    unit_type: 'Anchor',
    desktop: ANCHOR_PATH,
    mobile: ANCHOR_PATH,
    edge: 'bottom',
    selector: null,
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
    lazy_load: false,
    analytics_id: null,
    mgid: { tag_id: null, smart_widget: null, back_button: null, sidebar: null },
    reward: false,
    price_rules: true,
    loader: null,
    blocks,
  }
}

/** Liga os anúncios com as regras de preço da escada, e devolve o falso e a corrida. */
async function setup(blocks: PublicBlock[], group: 'regra' | 'controle' = 'regra') {
  const fake = fakeGoogletag()
  ;(window as Window & { googletag?: GoogleTag }).googletag = fake.googletag
  const run: PriceRulesRun = {
    group,
    floors: {},
    cascades: group === 'regra' ? { Anchor_Desktop: LADDER, Fixed_Desktop: LADDER, Content1_Desktop: LADDER } : {},
  }
  const onEmpty = vi.fn()
  const ads = startAds(tagWith(blocks), {
    target: window,
    origin: 'https://avant.groone.com',
    device: 'desktop',
    language: 'pt',
    onEmpty,
    targeting: Promise.resolve(adTargeting(run)),
  })
  await vi.advanceTimersByTimeAsync(500)
  return { fake, ads, onEmpty }
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

describe('tryTargeting', () => {
  it('leva o degrau e a tentativa, e a 4ª sai sem groone_prices', () => {
    expect(tryTargeting(LADDER, 1)).toEqual({ groone_prices: '1.22', groone_try: '1' })
    expect(tryTargeting(LADDER, 3)).toEqual({ groone_prices: '1.05', groone_try: '3' })
    expect(tryTargeting(LADDER, 4)).toEqual({ groone_prices: null, groone_try: '4' })
    expect(tryTargeting(['1.22'], 2)).toEqual({ groone_prices: null, groone_try: '2' })
    expect(CASCADE_KINDS).toEqual(['anchor', 'fixed'])
  })
})

describe('startCascade', () => {
  it('devolve false quando o erro do GPT acontece, sem quebrar a página', () => {
    const fake = fakeGoogletag()
    fake.refresh.mockImplementation(() => {
      throw new Error('GPT')
    })
    const slot = fake.googletag.defineOutOfPageSlot(ANCHOR_PATH, 3) as GptSlot
    const cascade = startCascade({ target: window, googletag: fake.googletag, slot, ladder: LADDER })
    expect(cascade.onEmpty()).toBe(false)
  })
})

describe('laço da Cascata', () => {
  it('pede de novo com o próximo degrau e groone_try ao vir vazio', async () => {
    const { fake, onEmpty } = await setup([block({})])
    const slot = fake.slots[0] as FakeSlot
    expect(slot.targeting).toEqual({ groone_prices: '1.22', groone_try: '1' })
    fake.emit('slotRenderEnded', { slot, isEmpty: true })
    expect(slot.targeting).toEqual({ groone_prices: '1.13', groone_try: '2' })
    expect(fake.refresh).toHaveBeenCalledWith([slot])
    expect(fake.destroySlots).not.toHaveBeenCalled()
    expect(onEmpty).not.toHaveBeenCalled()
  })

  it('a 4ª tentativa sai sem groone_prices', async () => {
    const { fake } = await setup([block({})])
    const slot = fake.slots[0] as FakeSlot
    for (let count = 0; count < 3; count += 1) fake.emit('slotRenderEnded', { slot, isEmpty: true })
    expect(slot.targeting).toEqual({ groone_try: '4' })
    expect(slot.configs[slot.configs.length - 1]).toEqual({ targeting: { groone_prices: null, groone_try: '4' } })
    expect(fake.refresh).toHaveBeenCalledTimes(3)
  })

  it('para depois de 4 tentativas e grava empty uma vez', async () => {
    const { fake, ads, onEmpty } = await setup([block({})])
    const slot = fake.slots[0] as FakeSlot
    for (let count = 0; count < 4; count += 1) fake.emit('slotRenderEnded', { slot, isEmpty: true })
    expect(fake.refresh).toHaveBeenCalledTimes(3)
    expect(ads.results()).toEqual([{ type: 'Anchor', state: 'empty' }])
    expect(onEmpty).toHaveBeenCalledTimes(1)
  })

  it('não grava o resultado enquanto ainda pede de novo', async () => {
    const { fake, ads } = await setup([block({})])
    fake.emit('slotRenderEnded', { slot: fake.slots[0] as GptSlot, isEmpty: true })
    expect(ads.results()).toEqual([])
  })

  it('para no teto de 3000 ms', async () => {
    const { fake, ads, onEmpty } = await setup([block({})])
    await vi.advanceTimersByTimeAsync(3001)
    fake.emit('slotRenderEnded', { slot: fake.slots[0] as GptSlot, isEmpty: true })
    expect(fake.refresh).not.toHaveBeenCalled()
    expect(ads.results()).toEqual([{ type: 'Anchor', state: 'empty' }])
    expect(onEmpty).toHaveBeenCalledTimes(1)
  })

  it('o GPT que nunca avisa: o teto encerra o laço e grava empty uma vez só', async () => {
    const { fake, ads, onEmpty } = await setup([block({})])
    const slot = fake.slots[0] as GptSlot
    fake.emit('slotRenderEnded', { slot, isEmpty: true })
    await vi.advanceTimersByTimeAsync(3000)
    expect(ads.results()).toEqual([{ type: 'Anchor', state: 'empty' }])
    expect(onEmpty).toHaveBeenCalledTimes(1)
    fake.emit('slotRenderEnded', { slot, isEmpty: true })
    expect(onEmpty).toHaveBeenCalledTimes(1)
    expect(fake.refresh).toHaveBeenCalledTimes(1)
  })

  it('o teto não grava nada quando a tentativa encheu', async () => {
    const { fake, ads } = await setup([block({})])
    const slot = fake.slots[0] as GptSlot
    fake.emit('slotRenderEnded', { slot, isEmpty: true })
    fake.emit('slotRenderEnded', { slot, isEmpty: false })
    await vi.advanceTimersByTimeAsync(5000)
    expect(ads.results()).toEqual([{ type: 'Anchor', state: 'rendered' }])
  })

  it('controle: sem groone_try e sem refresh por vazio', async () => {
    const { fake, ads, onEmpty } = await setup([block({})], 'controle')
    const slot = fake.slots[0] as FakeSlot
    expect(slot.configs).toEqual([])
    fake.emit('slotRenderEnded', { slot, isEmpty: true })
    expect(fake.refresh).not.toHaveBeenCalled()
    expect(ads.results()).toEqual([{ type: 'Anchor', state: 'empty' }])
    expect(onEmpty).toHaveBeenCalledTimes(1)
  })

  it('o fixo também refaz o pedido', async () => {
    const path = '/2100/blog.com/Blog_Fixed_Desktop_20261028'
    const { fake } = await setup([block({ kind: 'fixed', unit_type: 'Fixed', desktop: path })])
    const slot = fake.slots[0] as FakeSlot
    fake.emit('slotRenderEnded', { slot, isEmpty: true })
    expect(slot.targeting).toEqual({ groone_prices: '1.13', groone_try: '2' })
    expect(fake.refresh).toHaveBeenCalledWith([slot])
  })

  it('conteúdo nunca entra no laço', async () => {
    const path = '/2100/blog.com/Blog_Content1_Desktop_20261028'
    const { fake, ads, onEmpty } = await setup([
      block({ kind: 'content', unit_type: 'Content1', desktop: path, selector: 'article p' }),
    ])
    const slot = fake.slots[0] as FakeSlot
    expect(slot.targeting).toEqual({})
    fake.emit('slotRenderEnded', { slot, isEmpty: true })
    expect(fake.refresh).not.toHaveBeenCalled()
    expect(ads.results()).toEqual([{ type: 'Content1', state: 'empty' }])
    expect(onEmpty).toHaveBeenCalledTimes(1)
  })

  it('intersticial ainda não entra no laço', async () => {
    const path = '/2100/blog.com/Blog_Interstitial_Desktop_20261028'
    const fake = fakeGoogletag()
    ;(window as Window & { googletag?: GoogleTag }).googletag = fake.googletag
    const ads = startAds(tagWith([block({ kind: 'interstitial', unit_type: 'Interstitial', desktop: path })]), {
      target: window,
      origin: 'https://avant.groone.com',
      device: 'desktop',
      language: 'pt',
      targeting: Promise.resolve({
        page: {},
        slot: () => ({}),
        cascade: () => LADDER,
      }),
    })
    await vi.advanceTimersByTimeAsync(500)
    fake.emit('slotRenderEnded', { slot: fake.slots[0] as GptSlot, isEmpty: true })
    expect(fake.refresh).not.toHaveBeenCalled()
    expect(ads.results()).toEqual([{ type: 'Interstitial', state: 'empty' }])
  })

  it('âncora que encheu na 2ª: o refresh por tempo só começa depois e volta ao 1º degrau', async () => {
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
    const { fake, ads } = await setup([block({ refresh_seconds: 30 })])
    const slot = fake.slots[0] as FakeSlot
    fake.emit('slotRenderEnded', { slot, isEmpty: true })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(fake.refresh).toHaveBeenCalledTimes(1)
    fake.emit('slotRenderEnded', { slot, isEmpty: false })
    expect(slot.targeting).toEqual({ groone_prices: '1.13', groone_try: '2' })
    report([{ isIntersecting: true, intersectionRatio: 0.6 }])
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fake.refresh).toHaveBeenCalledTimes(2)
    expect(slot.targeting).toEqual({ groone_prices: '1.22', groone_try: '1' })
    expect(ads.results()).toEqual([{ type: 'Anchor', state: 'rendered' }])
  })
})

describe('regras de preço com escada', () => {
  it('lê a escada da resposta e a põe no 1º degrau; o controle fica sem escada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ control_percent: 0, floors: {}, cascades: { Anchor_Desktop: LADDER } }),
        } as Response),
      ),
    )
    const run = await startPriceRules(window, 'https://x', 'tg_abcd1234', 'hash', 'visitante')
    expect(run?.cascades).toEqual({ Anchor_Desktop: LADDER })
    const keys = adTargeting(run as NonNullable<typeof run>)
    expect(keys.slot(ANCHOR_PATH)).toEqual({ groone_prices: '1.22', groone_try: '1' })
    expect(keys.cascade(ANCHOR_PATH)).toEqual(LADDER)
    expect(keys.cascade('/2100/blog.com/Blog_Fixed_Desktop_20261028')).toBeNull()
  })
})
