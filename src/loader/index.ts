/**
 * O loader no site: trava a página, garante o GPT, detecta adblock e sai no primeiro anúncio
 * visível ou no tempo máximo, com fade. Qualquer erro finaliza; só o `block` com adblock trava.
 */

import type { PublicLoader } from '../core/types'
import { detectAdblock } from './adblock'
import { siteIconUrl } from './site-icon'
import { renderLoader, type LoaderMode } from './render'

export { detectAdblock } from './adblock'
export { BLUR_PIXELS, renderLoader, type LoaderMode, type RenderOptions } from './render'
export { siteIconUrl, siteName } from './site-icon'
export { ADBLOCK_TEXTS, adblockTexts, LOADER_LANGUAGES } from './translations'

const EXIT_MS = 400
const GPT_TIMEOUT_MS = 10_000
const LOCKED_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']

export interface LoaderDeps {
  target: Window
  domain: string
  language: string
  adblock?: Promise<boolean>
  gptReady: Promise<void>
  firstViewable: Promise<void>
}

export interface LoaderRun {
  adblock: Promise<boolean>
  finished: Promise<void>
}

/** Bloqueia rolagem e teclas de rolagem; devolve a função que libera. */
function lockPage(target: Window): () => void {
  const page = target.document
  /** Cancela a rolagem. */
  const stop = (event: Event): void => event.preventDefault()
  /** Cancela as teclas que rolam a página. */
  const stopKeys = (event: KeyboardEvent): void => {
    if (LOCKED_KEYS.includes(event.key)) event.preventDefault()
  }
  const overflow = page.documentElement.style.overflow
  target.addEventListener('wheel', stop, { passive: false })
  target.addEventListener('touchmove', stop, { passive: false })
  target.addEventListener('keydown', stopKeys, { passive: false })
  page.documentElement.style.overflow = 'hidden'
  page.body?.setAttribute('aria-busy', 'true')
  return () => {
    target.removeEventListener('wheel', stop)
    target.removeEventListener('touchmove', stop)
    target.removeEventListener('keydown', stopKeys)
    page.documentElement.style.overflow = overflow
    page.body?.removeAttribute('aria-busy')
  }
}

/** Espera o `<body>` existir. */
function bodyReady(target: Window): Promise<HTMLElement> {
  const page = target.document
  if (page.body) return Promise.resolve(page.body)
  return new Promise((resolve) => {
    page.addEventListener('DOMContentLoaded', () => resolve(page.body), { once: true })
  })
}

/** Uma promessa que termina depois do tempo. */
function delay(target: Window, milliseconds: number): Promise<void> {
  return new Promise((resolve) => target.setTimeout(resolve, milliseconds))
}

/** Tira a camada com fade de 400 ms (sem animação se o visitante pediu menos movimento). */
function fadeOut(target: Window, layer: HTMLElement): Promise<void> {
  const reduced = target.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  if (reduced) {
    layer.remove()
    return Promise.resolve()
  }
  layer.classList.add('avl-out')
  return delay(target, EXIT_MS).then(() => layer.remove())
}

/** Liga o loader na página e devolve o adblock detectado e quando ele saiu. */
export function startLoader(config: PublicLoader, deps: LoaderDeps): LoaderRun {
  const { target } = deps
  const adblock = (deps.adblock ?? detectAdblock(target)).catch(() => false)
  const finished = (async () => {
    const body = await bodyReady(target)
    const unlock = lockPage(target)
    const iconUrl = siteIconUrl(target.document)
    /** Desenha a camada no modo pedido. */
    const show = (mode: LoaderMode, handlers: { onContinue?: () => void; onSkip?: () => void } = {}): HTMLElement =>
      renderLoader(body, config, { mode, language: deps.language, domain: deps.domain, iconUrl, ...handlers })
    let layer: HTMLElement | null = null
    try {
      layer = show('loading')
      const gpt = Promise.race([deps.gptReady.catch(() => undefined), delay(target, GPT_TIMEOUT_MS)])
      if (config.adblock !== 'off' && (await adblock)) {
        layer.remove()
        await new Promise<void>((resolve) => {
          layer = show('adblock', { onContinue: () => target.location.reload(), onSkip: resolve })
        })
      } else {
        await gpt
        await Promise.race([deps.firstViewable.catch(() => undefined), delay(target, config.max_seconds * 1000)])
      }
    } finally {
      unlock()
      if (layer) await fadeOut(target, layer)
    }
  })().catch(() => undefined)
  return { adblock, finished }
}
