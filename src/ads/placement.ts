/**
 * Onde cada bloco entra na página: conteúdo antes ou depois do seletor (ou no marcador
 * `[groone="content3"]` da g-tag), fixo em cima ou embaixo, e os rótulos em volta do anúncio.
 */

import type { PublicBlock } from '../core/types'
import { sponsoredLabel } from './labels'

const STYLE_ID = 'avant-ads-style'
const ADS_CSS =
  '.avt-block{text-align:center;clear:both}' +
  '.avt-fixed{position:fixed;left:50%;transform:translateX(-50%);z-index:9999}' +
  '.avt-label{display:flex;align-items:center;max-width:600px;min-height:20px;margin:4px auto;font:12px/1 system-ui,sans-serif;letter-spacing:1px;color:#555;white-space:nowrap}' +
  '.avt-label::before,.avt-label::after{content:"";flex:1;border-bottom:1px solid #d9d9d9}' +
  '.avt-label:not(:empty)::before{margin-right:8px}.avt-label:not(:empty)::after{margin-left:8px}'

/** O id do `div` do bloco na página. */
export function blockElementId(block: PublicBlock): string {
  return `avant-${block.unit_type.toLowerCase()}`
}

/** Põe o CSS dos blocos uma vez só. */
function ensureStyle(page: Document): void {
  if (page.getElementById(STYLE_ID)) return
  const style = page.createElement('style')
  style.id = STYLE_ID
  style.textContent = ADS_CSS
  page.head.append(style)
}

/** O elemento de referência do bloco de conteúdo: o seletor ou o marcador da g-tag. */
function reference(page: Document, block: PublicBlock): Element | null {
  try {
    const found = block.selector ? page.body.querySelector(block.selector) : null
    if (found) return found
  } catch {
    return null
  }
  return page.body.querySelector(`[groone="${block.unit_type.toLowerCase()}"]`)
}

/** Cria o contêiner e o `div` do anúncio e põe no lugar; sem lugar, nada. */
export function placeBlock(page: Document, block: PublicBlock): HTMLElement | null {
  ensureStyle(page)
  const container = page.createElement('div')
  container.className = 'avt-block'
  const slot = page.createElement('div')
  slot.id = blockElementId(block)
  container.append(slot)
  if (block.kind === 'content') {
    const anchor = reference(page, block)
    if (!anchor?.parentNode) return null
    if (anchor.getAttribute('groone')) anchor.replaceWith(container)
    else if (block.side === 'before') anchor.parentNode.insertBefore(container, anchor)
    else anchor.parentNode.insertBefore(container, anchor.nextSibling)
    return container
  }
  if (block.kind === 'fixed') {
    container.classList.add('avt-fixed')
    container.style[block.edge === 'top' ? 'top' : 'bottom'] = '0'
  }
  page.body.append(container)
  return container
}

/** Põe os rótulos "Anúncio Patrocinado" em cima e uma linha embaixo do anúncio de conteúdo. */
export function addLabels(page: Document, container: HTMLElement, language: string): void {
  const top = page.createElement('div')
  top.className = 'avt-label'
  top.textContent = sponsoredLabel(language)
  const bottom = page.createElement('div')
  bottom.className = 'avt-label'
  container.prepend(top)
  container.append(bottom)
}
