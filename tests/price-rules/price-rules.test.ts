import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  adTargeting,
  blockOfPath,
  fetchFloors,
  groupOf,
  startPriceRules,
  visitorBucket,
} from '../../src/price-rules'

const ORIGIN = 'https://avant.groone.com'
const HASH = '0a1b2c3d4e5f6071'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** Uma resposta da API com o corpo pedido. */
function answer(body: unknown, ok = true) {
  return vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response))
}

describe('nomes e grupos', () => {
  it('tira o apelido e a data do nome do bloco, como o core', () => {
    expect(blockOfPath('/2100/blog.com/Blog_Content3_Mobile_20261028')).toBe('Content3_Mobile')
    expect(blockOfPath('/2100/blog.com/Blog_Anchor_20261028')).toBe('Anchor')
    expect(blockOfPath('/2100/blog.com/sem-padrao')).toBeNull()
  })

  it('sorteia sempre o mesmo grupo para o mesmo visitante', () => {
    const visitor = '7d3f6c2a-1b2c-4d5e-8f90-123456789abc'
    const bucket = visitorBucket(visitor)
    expect(bucket).toBeGreaterThanOrEqual(0)
    expect(bucket).toBeLessThan(100)
    expect(groupOf(visitor, bucket + 1)).toBe('controle')
    expect(groupOf(visitor, bucket)).toBe('regra')
    expect(groupOf(visitor, 0)).toBe('regra')
  })
})

describe('fetchFloors', () => {
  it('busca pela chave e pelo hash, sem credenciais', async () => {
    const fetcher = answer({ control_percent: 10, floors: { Content3_Mobile: '1.01' } })
    vi.stubGlobal('fetch', fetcher)
    const found = await fetchFloors(window, ORIGIN, 'tg_abcd1234', HASH)
    expect(found?.floors).toEqual({ Content3_Mobile: '1.01' })
    expect(fetcher).toHaveBeenCalledWith(`${ORIGIN}/api/tag/prices?key=tg_abcd1234&hash=${HASH}`, {
      credentials: 'omit',
    })
  })

  it('desiste em 300 ms e quando a API falha', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)))
    const slow = fetchFloors(window, ORIGIN, 'tg_abcd1234', HASH)
    await vi.advanceTimersByTimeAsync(300)
    await expect(slow).resolves.toBeNull()
    vi.useRealTimers()
    vi.stubGlobal('fetch', answer({}, false))
    await expect(fetchFloors(window, ORIGIN, 'tg_abcd1234', HASH)).resolves.toBeNull()
  })
})

describe('startPriceRules', () => {
  it('dá os floors ao grupo da regra e nada ao controle', async () => {
    vi.stubGlobal('fetch', answer({ control_percent: 0, floors: { Content3_Mobile: '1.01' } }))
    const run = await startPriceRules(window, ORIGIN, 'tg_abcd1234', HASH, 'visitante')
    expect(run).toEqual({ group: 'regra', floors: { Content3_Mobile: '1.01' } })
    const keys = adTargeting(run as NonNullable<typeof run>)
    expect(keys.page).toEqual({ groone_group: 'regra' })
    expect(keys.slot('/2100/blog.com/Blog_Content3_Mobile_20261028')).toEqual({ groone_prices: '1.01' })
    expect(keys.slot('/2100/blog.com/Blog_Anchor_Mobile_20261028')).toEqual({})

    vi.stubGlobal('fetch', answer({ control_percent: 100, floors: { Content3_Mobile: '1.01' } }))
    const control = await startPriceRules(window, ORIGIN, 'tg_abcd1234', HASH, 'visitante')
    expect(control).toEqual({ group: 'controle', floors: {} })

    vi.stubGlobal('fetch', answer({ control_percent: null, floors: {} }))
    await expect(startPriceRules(window, ORIGIN, 'tg_abcd1234', HASH, 'visitante')).resolves.toBeNull()
  })
})
