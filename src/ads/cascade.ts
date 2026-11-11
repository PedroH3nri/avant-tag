/**
 * O laço de tentativas da Cascata (decisão 15 do avant-core): quando o slot volta vazio, a tag
 * pede o MESMO slot de novo com o próximo degrau da escada e `groone_try`, em até 4 tentativas
 * ou 3000 ms desde a 1ª.
 */

import { safely } from '../core/safely'
import type { BlockKind } from '../core/types'
import { CASCADE_MAX_MS, CASCADE_TRIES, PRICE_KEY, TRY_KEY } from '../price-rules'
import type { GoogleTag, GptSlot } from './gpt'

export const CASCADE_KINDS: readonly BlockKind[] = ['anchor', 'fixed']

export interface CascadeDeps {
  target: Window
  googletag: GoogleTag
  slot: GptSlot
  ladder: string[]
  onExpire?: () => void
}

export interface Cascade {
  onEmpty(): boolean
  done(): void
}

/** As keys da tentativa: o degrau e o número dela; a última tentativa sai sem preço. */
export function tryTargeting(ladder: string[], attempt: number): Record<string, string> {
  const price = attempt < CASCADE_TRIES ? ladder[attempt - 1] : undefined
  return price ? { [PRICE_KEY]: price, [TRY_KEY]: String(attempt) } : { [TRY_KEY]: String(attempt) }
}

/** Começa o laço do slot; `onEmpty` devolve se pediu de novo e `done` encerra o laço. */
export function startCascade(deps: CascadeDeps): Cascade {
  const { target, googletag, slot, ladder } = deps
  const startedAt = Date.now()
  let attempt = 1
  let finished = false
  let timer: number | null = null

  /** Encerra o laço e desliga o relógio do teto. */
  function finish(): void {
    finished = true
    if (timer !== null) target.clearTimeout(timer)
    timer = null
  }

  /** Pede o slot de novo com a próxima tentativa. */
  function rebid(): void {
    attempt += 1
    slot.setConfig({ targeting: tryTargeting(ladder, attempt) })
    googletag.pubads().refresh([slot])
  }

  return {
    onEmpty: () => {
      if (finished) return false
      const expired = Date.now() - startedAt > CASCADE_MAX_MS
      if (expired || attempt >= CASCADE_TRIES || safely(rebid) === null) {
        finish()
        return false
      }
      if (timer === null) {
        timer = target.setTimeout(() => {
          if (finished) return
          finish()
          deps.onExpire?.()
        }, Math.max(CASCADE_MAX_MS - (Date.now() - startedAt), 0))
      }
      return true
    },
    done: finish,
  }
}
