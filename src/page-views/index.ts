/**
 * A página vista: mede o tempo visível, a rolagem e o clique e manda um resumo só, uma vez por
 * página, quando ela fica oculta ou é fechada (`POST /api/tag/page-views`).
 */

import { sendBeacon } from '../core/beacon'
import { contentHash } from '../core/hash'
import { newId } from '../core/ids'
import type { Device, PublicAdTag } from '../core/types'
import { wordpressPostId } from '../ads/targeting'
import { sessionId, visitorId } from './visitor'

export { SESSION_KEY, SESSION_MS, sessionId, VISITOR_KEY, visitorId } from './visitor'

export interface PageViewBlock {
  type: string
  state: 'rendered' | 'empty'
}

export interface PageViewBody {
  key: string
  url: string
  page_view_id: string
  visitor_id: string
  session_id: string
  version: number
  device: Device
  language: string
  referrer: string | null
  visible_ms: number
  scroll_percent: number
  clicked: boolean
  adblock: boolean
  id_post: string | null
  content_hash: string
  blocks: PageViewBlock[]
}

export interface PageViewDeps {
  target: Window
  origin: string
  device: Device
  language: string
  adblock: () => boolean
  blocks: () => PageViewBlock[]
  now?: () => number
}

export interface PageViewRun {
  body: () => PageViewBody
  send: () => boolean
}

/** A rolagem da página em porcentagem (de 0 a 100). */
function scrollPercent(target: Window): number {
  const page = target.document.documentElement
  const height = Math.max(page.scrollHeight, target.document.body?.scrollHeight ?? 0)
  if (height <= 0) return 0
  const seen = target.scrollY + target.innerHeight
  return Math.min(100, Math.max(0, Math.round((seen / height) * 100)))
}

/** Começa a medir a página e marca o envio para quando ela ficar oculta. */
export function startPageViews(config: PublicAdTag, deps: PageViewDeps): PageViewRun {
  const { target } = deps
  const page = target.document
  const now = deps.now ?? (() => Date.now())
  const pageViewId = newId(target)
  const visitor = visitorId(target)
  const session = sessionId(target, now())
  let visibleMs = 0
  let visibleSince: number | null = page.visibilityState === 'visible' ? now() : null
  let maxScroll = scrollPercent(target)
  let clicked = false
  let sent = false

  /** O tempo visível até agora, contando o trecho aberto. */
  const visibleTotal = (): number => visibleMs + (visibleSince === null ? 0 : now() - visibleSince)

  /** O resumo da página no formato da API. */
  const body = (): PageViewBody => ({
    key: config.key,
    url: target.location.href,
    page_view_id: pageViewId,
    visitor_id: visitor,
    session_id: session,
    version: config.version,
    device: deps.device,
    language: deps.language,
    referrer: page.referrer || null,
    visible_ms: Math.round(visibleTotal()),
    scroll_percent: maxScroll,
    clicked,
    adblock: deps.adblock(),
    id_post: wordpressPostId(page),
    content_hash: contentHash(target.location.hostname, target.location.pathname),
    blocks: deps.blocks(),
  })

  /** Manda o resumo uma vez só; as chamadas seguintes não fazem nada. */
  const send = (): boolean => {
    if (sent) return false
    sent = true
    return sendBeacon(target, `${deps.origin}/api/tag/page-views`, body())
  }

  /** Para ou volta a contar o tempo quando a aba muda; na primeira saída, manda o resumo. */
  const onVisibility = (): void => {
    if (page.visibilityState === 'visible') {
      visibleSince ??= now()
      return
    }
    if (visibleSince !== null) visibleMs += now() - visibleSince
    visibleSince = null
    send()
  }

  /** Guarda a maior rolagem. */
  const onScroll = (): void => {
    maxScroll = Math.max(maxScroll, scrollPercent(target))
  }

  /** Marca o clique em link ou botão. */
  const onClick = (event: Event): void => {
    const element = event.target as Element | null
    if (element?.closest?.('a, button')) clicked = true
  }

  page.addEventListener('visibilitychange', onVisibility)
  target.addEventListener('scroll', onScroll, { passive: true })
  page.addEventListener('click', onClick, true)
  target.addEventListener('pagehide', () => send())
  return { body, send }
}
