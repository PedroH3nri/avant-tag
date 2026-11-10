/**
 * O desenho do loader e do aviso de adblock, o mesmo no site e na prévia do painel. Modelos
 * `groone` (véu com blur e arco girando em volta do ícone) e `solid` (tela cheia com animação).
 */

import type { PublicLoader } from '../core/types'
import { inkFor, tint } from './colors'
import { siteName } from './site-icon'
import { ensureStyle } from './style'
import { adblockTexts } from './translations'

export const BLUR_PIXELS = [0, 4, 8, 14]
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

export type LoaderMode = 'loading' | 'adblock'

export interface RenderOptions {
  mode: LoaderMode
  language: string
  domain: string
  iconUrl: string | null
  inline?: boolean
  onContinue?: () => void
  onSkip?: () => void
}

/** Cria um elemento com classe e estilo. */
function element<Tag extends keyof HTMLElementTagNameMap>(
  page: Document,
  tag: Tag,
  className: string,
  style: Partial<CSSStyleDeclaration> = {},
): HTMLElementTagNameMap[Tag] {
  const created = page.createElement(tag)
  created.className = className
  Object.assign(created.style, style)
  return created
}

/** O ícone do site (a imagem do favicon) ou o nome dele em texto. */
function siteIcon(page: Document, options: RenderOptions, size: number, ink: string): HTMLElement {
  if (options.iconUrl) {
    const image = element(page, 'img', 'avl-icon', { width: `${size}px`, height: `${size}px` })
    image.src = options.iconUrl
    image.alt = ''
    return image
  }
  const name = element(page, 'span', 'avl-name', { color: ink })
  name.textContent = siteName(options.domain)
  return name
}

/** O fundo da camada: véu translúcido com blur no `groone`, cor cheia no `solid`. */
function layerBackground(config: PublicLoader, mode: LoaderMode): Partial<CSSStyleDeclaration> {
  const blur = `blur(${BLUR_PIXELS[config.blur] ?? 0}px)`
  if (config.template === 'groone') {
    return { background: tint(config.background, 0.58), backdropFilter: blur, webkitBackdropFilter: blur } as Partial<CSSStyleDeclaration>
  }
  if (mode === 'adblock' && config.adblock !== 'block') return { background: 'rgba(23,23,23,0.5)' }
  return { background: config.background, color: inkFor(config.background) }
}

/** O arco girando com o brilho na cor de destaque, em volta do ícone. */
function grooneRing(page: Document, config: PublicLoader, options: RenderOptions): HTMLElement {
  const ring = element(page, 'div', 'avl-ring')
  ring.append(element(page, 'span', 'avl-glow', { boxShadow: `0 0 28px 2px ${tint(config.accent, 0.35)}` }))
  const svg = page.createElementNS(SVG_NAMESPACE, 'svg')
  svg.setAttribute('viewBox', '0 0 72 72')
  svg.setAttribute('class', 'avl-arc')
  svg.setAttribute('aria-hidden', 'true')
  for (const stroke of ['rgba(255,255,255,.12)', config.accent]) {
    const circle = page.createElementNS(SVG_NAMESPACE, 'circle')
    for (const [name, value] of [['cx', '36'], ['cy', '36'], ['r', '33'], ['fill', 'none'], ['stroke', stroke], ['stroke-width', '2.5'], ['stroke-linecap', 'round']]) {
      circle.setAttribute(name as string, value as string)
    }
    svg.append(circle)
  }
  ring.append(svg, siteIcon(page, options, 30, '#ffffff'))
  return ring
}

/** A animação do modelo `solid`: barra, círculo ou pontos. */
function solidAnimation(page: Document, config: PublicLoader, ink: string): HTMLElement {
  const faded = `${ink}22`
  if (config.style === 'bar') {
    const bar = element(page, 'span', 'avl-bar', { background: faded })
    bar.append(element(page, 'span', '', { background: config.accent }))
    return bar
  }
  if (config.style === 'spinner') {
    return element(page, 'span', 'avl-spinner', { borderColor: faded, borderTopColor: config.accent })
  }
  const dots = element(page, 'span', 'avl-dots')
  for (const position of [0, 1, 2]) {
    dots.append(element(page, 'span', '', { background: config.accent, animationDelay: `${position * 0.15}s` }))
  }
  return dots
}

/** O cartão de adblock: ícone, título, texto, observação, botão, "continuar assim" e GROONE®. */
function adblockCard(page: Document, config: PublicLoader, options: RenderOptions): HTMLElement {
  const copy = adblockTexts(options.language)
  const card = element(page, 'div', 'avl-card')
  const title = element(page, 'p', 'avl-title')
  title.textContent = copy.title
  const body = element(page, 'p', 'avl-body')
  const strong = page.createElement('strong')
  strong.textContent = copy.strong
  body.append(`${copy.text} ${copy.detail}`, strong, copy.detailEnd)
  const hint = element(page, 'p', 'avl-hint')
  hint.textContent = copy.hint
  const button = element(page, 'button', 'avl-button', { background: config.accent, color: inkFor(config.accent) })
  button.type = 'button'
  button.textContent = copy.button
  button.addEventListener('click', () => options.onContinue?.())
  card.append(siteIcon(page, options, 40, '#262626'), title, body, hint, button)
  if (config.adblock === 'warn') {
    const skip = element(page, 'button', 'avl-skip')
    skip.type = 'button'
    skip.textContent = copy.skip
    skip.addEventListener('click', () => options.onSkip?.())
    card.append(skip)
  }
  const brand = element(page, 'p', 'avl-brand')
  brand.textContent = 'GROONE®'
  card.append(brand)
  return card
}

/** Desenha o loader (ou o aviso) dentro do alvo e devolve a camada; `inline` fica no alvo, não na tela. */
export function renderLoader(target: HTMLElement, config: PublicLoader, options: RenderOptions): HTMLElement {
  const page = target.ownerDocument
  ensureStyle(page)
  const layer = element(page, 'div', options.inline ? 'avl-layer avl-inline' : 'avl-layer', layerBackground(config, options.mode))
  if (options.mode === 'adblock') {
    layer.setAttribute('role', 'dialog')
    layer.append(adblockCard(page, config, options))
  } else if (config.template === 'groone') {
    layer.setAttribute('role', 'status')
    layer.append(grooneRing(page, config, options))
  } else {
    layer.setAttribute('role', 'status')
    const ink = inkFor(config.background)
    const stack = element(page, 'div', 'avl-stack')
    stack.append(siteIcon(page, options, 48, ink), solidAnimation(page, config, ink))
    if (config.text) {
      const text = element(page, 'span', 'avl-text')
      text.textContent = config.text
      stack.append(text)
    }
    layer.append(stack)
  }
  target.append(layer)
  return layer
}
