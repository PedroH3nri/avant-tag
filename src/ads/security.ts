/**
 * Proteção da g-tag: não monta anúncios se um overlay fixo cobre a tela (92% ou mais, z-index
 * alto, em 3 dos 5 pontos), para não pôr anúncio por baixo de uma tela que o visitante não vê.
 */

const POINTS = [
  [0.5, 0.5],
  [0.1, 0.1],
  [0.9, 0.1],
  [0.1, 0.9],
  [0.9, 0.9],
] as const
const MIN_HITS = 3
const MIN_COVER = 0.92
const MIN_Z_INDEX = 999
const MAX_DEPTH = 8

/** O ancestral fixo (ou sticky) mais perto do elemento, até 8 níveis. */
function fixedAncestor(target: Window, node: Element): HTMLElement | null {
  let current: Element | null = node
  for (let depth = 0; depth < MAX_DEPTH && current; depth += 1) {
    if (current === target.document.body || current === target.document.documentElement) return null
    const position = target.getComputedStyle(current).position
    if (current instanceof HTMLElement && (position === 'fixed' || position === 'sticky')) return current
    current = current.parentElement
  }
  return null
}

/** Diz se algum elemento fixo do site (não o loader do Avant) cobre a tela. */
export function overlayCovers(target: Window): boolean {
  const width = target.innerWidth
  const height = target.innerHeight
  const hits = new Map<HTMLElement, number>()
  for (const [left, top] of POINTS) {
    const stack = target.document.elementsFromPoint?.(Math.floor(width * left), Math.floor(height * top)) ?? []
    for (const node of stack) {
      if (node.closest('.avl-layer')) continue
      const found = fixedAncestor(target, node)
      if (found) hits.set(found, (hits.get(found) ?? 0) + 1)
    }
  }
  for (const [element, count] of hits) {
    if (count < MIN_HITS) continue
    const style = target.getComputedStyle(element)
    const box = element.getBoundingClientRect()
    const covers = box.width / width >= MIN_COVER && box.height / height >= MIN_COVER
    const shown = style.display !== 'none' && style.visibility !== 'hidden'
    if (covers && shown && parseInt(style.zIndex || '0', 10) >= MIN_Z_INDEX) return true
  }
  return false
}
