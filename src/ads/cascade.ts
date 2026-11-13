/**
 * O laço de tentativas da Cascata (decisão 15 do avant-core): quando o slot volta vazio, a tag
 * pede o MESMO slot de novo com o próximo degrau da escada e `groone_try`, em até 4 tentativas
 * ou 3000 ms desde o 1º pedido.
 */

import { safely } from '../core/safely'
import type { BlockKind } from '../core/types'
import { CASCADE_MAX_MS, CASCADE_TRIES, PRICE_KEY, TRY_KEY } from '../price-rules'
import type { GptSlot } from './gpt'

export const CASCADE_KINDS: readonly BlockKind[] = ['anchor', 'fixed', 'content']

export const REWARD_CASCADE_ENABLED = false

export interface CascadeDeps {
  googletag: { pubads(): { refresh(slots: GptSlot[]): void } }
  slot: GptSlot
  ladder: string[]
}

export interface Cascade {
  onEmpty(): boolean
  requested(): void
  restart(): void
  done(): void
}

/** As keys da tentativa: o degrau e o número dela; sem preço, `groone_prices` é null para o GPT apagar a key. */
export function tryTargeting(ladder: string[], attempt: number): Record<string, string | null> {
  const price = attempt < CASCADE_TRIES ? ladder[attempt - 1] : undefined
  return { [PRICE_KEY]: price ?? null, [TRY_KEY]: String(attempt) }
}

/**
 * Começa o laço do slot; o teto conta do 1º `slotRequested` (sem ele, da montagem) e só impede um
 * novo pedido: a tentativa no ar termina, e só o vazio dela encerra o bloco.
 */
export function startCascade(deps: CascadeDeps): Cascade {
  const { googletag, slot, ladder } = deps
  let startedAt = Date.now()
  let requestSeen = false
  let attempt = 1
  let finished = false

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
        finished = true
        return false
      }
      return true
    },
    requested: () => {
      if (requestSeen || finished) return
      requestSeen = true
      startedAt = Date.now()
    },
    restart: () => {
      attempt = 1
      finished = false
      requestSeen = false
      startedAt = Date.now()
      slot.setConfig({ targeting: tryTargeting(ladder, 1) })
    },
    done: () => {
      finished = true
    },
  }
}
