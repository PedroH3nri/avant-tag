/**
 * As regras de preço da tag (decisão 14 do avant-core): busca os floors do `content_hash` da
 * página junto com o GPT, sorteia o visitante no grupo de controle e devolve o que vai nas keys
 * `groone_group` (página) e `groone_prices` (bloco). Sem resposta em 300 ms, os anúncios seguem
 * sem as keys.
 */

import { pageHash } from '../core/hash'
import type { PriceFloorsResponse } from '../core/types'

export const PRICE_KEY = 'groone_prices'
export const GROUP_KEY = 'groone_group'
export const RULE_GROUP = 'regra'
export const CONTROL_GROUP = 'controle'
export const FLOORS_TIMEOUT_MS = 300
export const TRY_KEY = 'groone_try'
export const CASCADE_TRIES = 4
export const CASCADE_MAX_MS = 3000

const BLOCK_NAME = /^[^_]+_(.+)_\d{8}$/

export interface PriceRulesRun {
  group: typeof RULE_GROUP | typeof CONTROL_GROUP
  floors: Record<string, string>
  cascades: Record<string, string[]>
}

/** O bloco da regra pelo caminho do ad unit: `/2100/blog.com/Blog_Content3_Mobile_20261028` vira `Content3_Mobile`. */
export function blockOfPath(path: string): string | null {
  const name = path.split('/').pop() ?? ''
  return BLOCK_NAME.exec(name)?.[1] ?? null
}

/** A faixa do visitante de 0 a 99, sempre a mesma para o mesmo id. */
export function visitorBucket(visitorId: string): number {
  return Number.parseInt(pageHash(visitorId).slice(0, 8), 16) % 100
}

/** O grupo do visitante: abaixo do percentual de controle fica sem floor. */
export function groupOf(visitorId: string, controlPercent: number): PriceRulesRun['group'] {
  return visitorBucket(visitorId) < controlPercent ? CONTROL_GROUP : RULE_GROUP
}

/** Busca os floors na API; nada quando a tag não leva regra, a API falha ou passa de 300 ms. */
export function fetchFloors(
  target: Window,
  origin: string,
  key: string,
  contentHash: string,
): Promise<PriceFloorsResponse | null> {
  const address = `${origin}/api/tag/prices?key=${encodeURIComponent(key)}&hash=${encodeURIComponent(contentHash)}`
  return new Promise((resolve) => {
    const timer = target.setTimeout(() => resolve(null), FLOORS_TIMEOUT_MS)
    target
      .fetch(address, { credentials: 'omit' })
      .then((response) => (response.ok ? (response.json() as Promise<PriceFloorsResponse>) : null))
      .catch(() => null)
      .then((body) => {
        target.clearTimeout(timer)
        resolve(body)
      })
  })
}

/** Começa a busca e devolve o grupo e os floors do visitante, ou nada sem regra na tag. */
export async function startPriceRules(
  target: Window,
  origin: string,
  key: string,
  contentHash: string,
  visitorId: string,
): Promise<PriceRulesRun | null> {
  const response = await fetchFloors(target, origin, key, contentHash)
  if (!response || response.control_percent === null) return null
  const group = groupOf(visitorId, response.control_percent)
  const isRule = group === RULE_GROUP
  return {
    group,
    floors: isRule ? response.floors : {},
    cascades: isRule ? (response.cascades ?? {}) : {},
  }
}

/** O valor de `groone_prices` do bloco no caminho, ou nada sem floor para ele. */
export function floorOfPath(run: PriceRulesRun | null, path: string): string | null {
  const block = blockOfPath(path)
  return run && block ? (run.floors[block] ?? null) : null
}

/** A escada de floors do bloco no caminho, ou nada sem escada (controle e blocos fora da Cascata). */
export function cascadeOfPath(run: PriceRulesRun | null, path: string): string[] | null {
  const block = blockOfPath(path)
  const ladder = run && block ? run.cascades[block] : undefined
  return ladder && ladder.length > 0 ? ladder : null
}

/** As keys da regra para os anúncios: o grupo na página, e em cada bloco o 1º degrau ou o floor. */
export function adTargeting(run: PriceRulesRun) {
  return {
    page: { [GROUP_KEY]: run.group },
    slot: (path: string): Record<string, string> => {
      const ladder = cascadeOfPath(run, path)
      if (ladder) return { [PRICE_KEY]: ladder[0] as string, [TRY_KEY]: '1' }
      const floor = floorOfPath(run, path)
      return floor ? { [PRICE_KEY]: floor } : {}
    },
    cascade: (path: string): string[] | null => cascadeOfPath(run, path),
  }
}
