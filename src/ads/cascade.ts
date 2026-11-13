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

export const CASCADE_STALL_MS = 10_000

export interface CascadeDeps {
  target: Window
  googletag: { pubads(): { refresh(slots: GptSlot[]): void } }
  slot: GptSlot
  ladder: string[]
  onStall?: () => void
}

export interface Cascade {
  onEmpty(): boolean
  requested(): void
  restart(): boolean
  done(): void
}

/** As keys da tentativa: o degrau e o número dela; sem preço, `groone_prices` é null para o GPT apagar a key. */
export function tryTargeting(ladder: string[], attempt: number): Record<string, string | null> {
  const price = attempt < CASCADE_TRIES ? ladder[attempt - 1] : undefined
  return { [PRICE_KEY]: price ?? null, [TRY_KEY]: String(attempt) }
}

/**
 * Começa o laço do slot; o teto conta do 1º `slotRequested` (sem ele, da montagem) e só impede um
 * novo pedido. Se o GPT não responder a um rebid em 10 s, o laço desiste e avisa `onStall`.
 */
export function startCascade(deps: CascadeDeps): Cascade {
  const { target, googletag, slot, ladder } = deps
  let startedAt = Date.now()
  let requestSeen = false
  let attempt = 1
  let finished = false
  let stallTimer: number | null = null

  /** Desliga o relógio da tentativa no ar. */
  function clearStall(): void {
    if (stallTimer !== null) target.clearTimeout(stallTimer)
    stallTimer = null
  }

  /** Encerra o laço. */
  function finish(): void {
    finished = true
    clearStall()
  }

  /** Pede o slot de novo com a próxima tentativa e liga o relógio de quem nunca responde. */
  function rebid(): void {
    slot.setConfig({ targeting: tryTargeting(ladder, attempt + 1) })
    attempt += 1
    googletag.pubads().refresh([slot])
    stallTimer = target.setTimeout(() => {
      if (finished) return
      finish()
      deps.onStall?.()
    }, CASCADE_STALL_MS)
  }

  return {
    onEmpty: () => {
      clearStall()
      if (finished) return false
      const expired = Date.now() - startedAt > CASCADE_MAX_MS
      if (expired || attempt >= CASCADE_TRIES || safely(rebid) === null) {
        finish()
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
      if (!finished || safely(() => slot.setConfig({ targeting: tryTargeting(ladder, 1) })) === null) return false
      attempt = 1
      finished = false
      requestSeen = false
      startedAt = Date.now()
      return true
    },
    done: finish,
  }
}
