/**
 * O anúncio premiado do Google Publisher Tag (GPT): carrega o gpt.js se o site não tiver, tenta os
 * ad units na ordem e avisa quando a pessoa ganhou o prêmio, fechou ou não houve anúncio.
 */

import { safely } from '../core/safely'
import { GROUP_KEY } from '../price-rules'
import { startCascade, tryTargeting, type Cascade } from '../ads/cascade'
import type { GptSlot } from '../ads/gpt'

const GPT_SOURCE = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
const READY_TIMEOUT_MS = 10_000

export type RewardedSlot = GptSlot

export type LadderOfPath = (path: string) => string[] | null

export interface RewardCascade {
  group: string
  ladderOfPath: LadderOfPath
}

interface SlotEvent {
  slot: RewardedSlot
  isEmpty?: boolean
  makeRewardedVisible?: () => void
}

export interface GoogleTag {
  cmd: Array<() => void> | { push(command: () => void): void }
  enums: { OutOfPageFormat: { REWARDED: number } }
  defineOutOfPageSlot(path: string, format: number): RewardedSlot | null
  pubads(): {
    addEventListener(name: string, listener: (event: SlotEvent) => void): void
    removeEventListener?(name: string, listener: (event: SlotEvent) => void): void
    refresh(slots: RewardedSlot[]): void
  }
  setConfig(config: Record<string, unknown>): void
  enableServices(): void
  display(slot: RewardedSlot): void
  destroySlots(slots?: RewardedSlot[]): boolean
}

export type AdOutcome = 'granted' | 'closed' | 'unavailable'

type RewardWindow = Window & { googletag?: Partial<GoogleTag> }

/** Garante a fila `googletag.cmd` e põe o gpt.js na página quando ainda não está. */
export function loadGoogleTag(target: Window = window): void {
  const page = target as RewardWindow
  page.googletag = page.googletag ?? {}
  page.googletag.cmd = page.googletag.cmd ?? []
  if (target.document.querySelector(`script[src="${GPT_SOURCE}"]`)) return
  const script = target.document.createElement('script')
  script.async = true
  script.src = GPT_SOURCE
  target.document.head.append(script)
}

/** Mostra o anúncio premiado de um dos caminhos e responde como terminou; sem anúncio, `unavailable`. */
export function showRewardedAd(paths: string[], target: Window = window, rewardCascade?: RewardCascade): Promise<AdOutcome> {
  return new Promise((resolve) => {
    if (paths.length === 0) return resolve('unavailable')
    loadGoogleTag(target)
    let finished = false
    let current: RewardedSlot | null = null
    let granted = false
    let cascade: Cascade | null = null
    const timer = target.setTimeout(() => finish('unavailable'), READY_TIMEOUT_MS)

    /** Encerra uma vez só, limpa o slot e devolve o resultado. */
    function finish(outcome: AdOutcome): void {
      if (finished) return
      finished = true
      target.clearTimeout(timer)
      cascade?.done()
      if (current) (target as RewardWindow).googletag?.destroySlots?.([current])
      unlisten()
      resolve(outcome)
    }

    /** Tenta o próximo caminho da lista; acabou a lista, não há anúncio. */
    function tryNext(googletag: GoogleTag, remaining: string[]): void {
      const [path, ...rest] = remaining
      if (path === undefined) return finish('unavailable')
      current = googletag.defineOutOfPageSlot(path, googletag.enums.OutOfPageFormat.REWARDED)
      if (!current) return tryNext(googletag, rest)
      current.addService(googletag.pubads())
      pending = rest
      cascade = null
      const ladder = rewardCascade?.ladderOfPath(path)
      const slot = current
      if (ladder && safely(() => slot.setConfig({ targeting: tryTargeting(ladder, 1) })) !== null) {
        cascade = startCascade({ target, googletag, slot, ladder, onStall: () => moveOn(googletag, slot) })
      }
      googletag.display(current)
    }

    /** Passa ao próximo caminho: o slot atual acabou a escada ou o tempo, não é um rebid. */
    function moveOn(googletag: GoogleTag, slot: RewardedSlot): void {
      if (finished || slot !== current) return
      googletag.destroySlots([slot])
      current = null
      tryNext(googletag, pending)
    }

    let pending: string[] = []
    const listeners: Array<[string, (event: SlotEvent) => void]> = []

    /** Tira os ouvintes deste anúncio do GPT, para o próximo anúncio da página não carregar os antigos. */
    function unlisten(): void {
      const ads = safely(() => ((target as RewardWindow).googletag as GoogleTag).pubads())
      for (const [name, listener] of listeners.splice(0)) safely(() => ads?.removeEventListener?.(name, listener))
    }

    const queue = (target as RewardWindow).googletag?.cmd
    queue?.push(() => {
      if (finished) return
      const googletag = (target as RewardWindow).googletag as GoogleTag
      const pubads = googletag.pubads()
      /** Liga o ouvinte no GPT e guarda para tirar no fim. */
      const listen = (name: string, listener: (event: SlotEvent) => void): void => {
        listeners.push([name, listener])
        pubads.addEventListener(name, listener)
      }
      listen('rewardedSlotReady', (event) => {
        if (event.slot !== current) return
        target.clearTimeout(timer)
        cascade?.done()
        event.makeRewardedVisible?.()
      })
      listen('slotRequested', (event) => {
        if (event.slot === current) cascade?.requested()
      })
      listen('slotRenderEnded', (event) => {
        if (event.slot !== current || !event.isEmpty) return
        if (cascade?.onEmpty()) return
        moveOn(googletag, event.slot)
      })
      listen('rewardedSlotGranted', (event) => {
        if (event.slot === current) granted = true
      })
      listen('rewardedSlotClosed', (event) => {
        if (event.slot === current) finish(granted ? 'granted' : 'closed')
      })
      if (rewardCascade) safely(() => googletag.setConfig({ targeting: { [GROUP_KEY]: rewardCascade.group } }))
      googletag.enableServices()
      tryNext(googletag, paths)
    })
  })
}
