/**
 * O anúncio premiado do Google Publisher Tag (GPT): carrega o gpt.js se o site não tiver, tenta os
 * ad units na ordem e avisa quando a pessoa ganhou o prêmio, fechou ou não houve anúncio.
 */

const GPT_SOURCE = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'
const READY_TIMEOUT_MS = 10_000

export interface RewardedSlot {
  addService(service: unknown): RewardedSlot
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
  pubads(): { addEventListener(name: string, listener: (event: SlotEvent) => void): void }
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
export function showRewardedAd(paths: string[], target: Window = window): Promise<AdOutcome> {
  return new Promise((resolve) => {
    if (paths.length === 0) return resolve('unavailable')
    loadGoogleTag(target)
    let finished = false
    let current: RewardedSlot | null = null
    let granted = false
    const timer = target.setTimeout(() => finish('unavailable'), READY_TIMEOUT_MS)

    /** Encerra uma vez só, limpa o slot e devolve o resultado. */
    function finish(outcome: AdOutcome): void {
      if (finished) return
      finished = true
      target.clearTimeout(timer)
      if (current) (target as RewardWindow).googletag?.destroySlots?.([current])
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
      googletag.display(current)
    }

    let pending: string[] = []
    const queue = (target as RewardWindow).googletag?.cmd
    queue?.push(() => {
      const googletag = (target as RewardWindow).googletag as GoogleTag
      const ads = googletag.pubads()
      ads.addEventListener('rewardedSlotReady', (event) => {
        if (event.slot !== current) return
        target.clearTimeout(timer)
        event.makeRewardedVisible?.()
      })
      ads.addEventListener('slotRenderEnded', (event) => {
        if (event.slot !== current || !event.isEmpty) return
        googletag.destroySlots([event.slot])
        current = null
        tryNext(googletag, pending)
      })
      ads.addEventListener('rewardedSlotGranted', (event) => {
        if (event.slot === current) granted = true
      })
      ads.addEventListener('rewardedSlotClosed', (event) => {
        if (event.slot === current) finish(granted ? 'granted' : 'closed')
      })
      googletag.enableServices()
      tryNext(googletag, paths)
    })
  })
}
