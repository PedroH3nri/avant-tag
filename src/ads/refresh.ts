/**
 * Refresh do bloco: conta o tempo só com o bloco pelo menos 50% visível e a aba aberta, e
 * atualiza a cada `seconds` segundos, no máximo 5 vezes.
 */

import type { GoogleTag, GptSlot } from './gpt'

export const MAX_REFRESHES = 5
const MIN_RATIO = 0.5
const TICK_MS = 1000

/** Liga o refresh do slot observando o elemento; `beforeRefresh` falso pula a vez. Devolve a função que desliga. */
export function startRefresh(
  target: Window,
  googletag: GoogleTag,
  slot: GptSlot,
  element: Element,
  seconds: number,
  beforeRefresh?: () => boolean,
): () => void {
  let visible = false
  let elapsed = 0
  let count = 0
  const Observer = (target as Window & { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver
  if (!Observer) return () => undefined
  const observer = new Observer(
    (entries: IntersectionObserverEntry[]) => {
      const entry = entries[entries.length - 1]
      visible = !!entry && entry.isIntersecting && entry.intersectionRatio >= MIN_RATIO
    },
    { threshold: [0, MIN_RATIO, 1] },
  )
  observer.observe(element)
  const timer = target.setInterval(() => {
    if (!visible || target.document.visibilityState !== 'visible') return
    elapsed += TICK_MS
    if (elapsed < seconds * 1000) return
    elapsed = 0
    count += 1
    googletag.cmd.push(() => {
      if (beforeRefresh && !beforeRefresh()) return
      googletag.pubads().refresh([slot])
    })
    if (count >= MAX_REFRESHES) stop()
  }, TICK_MS)

  /** Para o relógio e o observador. */
  function stop(): void {
    target.clearInterval(timer)
    observer.disconnect()
  }
  return stop
}
