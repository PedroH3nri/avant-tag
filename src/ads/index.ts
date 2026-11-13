/**
 * Os anúncios do GAM na página: GPT, key-values, lazy load e os blocos da tag na ordem, cada um
 * no aparelho e nas páginas da regra dele. Conta como cada bloco terminou para as visitas.
 */

import { sendBeacon } from '../core/beacon'
import { blockAllowed } from '../core/paths'
import { safely } from '../core/safely'
import type { Device, PublicAdTag, PublicBlock } from '../core/types'
import { CASCADE_KINDS, startCascade, type Cascade } from './cascade'
import { ensureGpt, gptReady, type GoogleTag, type GptSlot, type GptSlotEvent } from './gpt'
import { addLabels, blockElementId, placeBlock } from './placement'
import { startRefresh } from './refresh'
import { overlayCovers } from './security'
import { networkOfPath, pageKeyValues } from './targeting'

export { ensureGpt, GPT_SOURCE, gptReady, type GoogleTag, type GptSlot } from './gpt'
export { sponsoredLabel } from './labels'
export { addLabels, blockElementId, placeBlock } from './placement'
export { CASCADE_KINDS, startCascade, tryTargeting, type Cascade } from './cascade'
export { MAX_REFRESHES, startRefresh } from './refresh'
export { overlayCovers } from './security'
export { networkOfPath, pageKeyValues, wordpressPostId } from './targeting'

export type BlockState = 'rendered' | 'empty'

export interface BlockResult {
  type: string
  state: BlockState
}

export interface AdTargeting {
  page: Record<string, string>
  slot: (path: string, cascading?: boolean) => Record<string, string>
  cascade?: (path: string) => string[] | null
}

export interface AdsDeps {
  target: Window
  origin: string
  device: Device
  language: string
  onEmpty?: (block: PublicBlock, container: HTMLElement | null) => void
  targeting?: Promise<AdTargeting | null>
}

export interface AdsRun {
  gptReady: Promise<void>
  firstViewable: Promise<void>
  results: () => BlockResult[]
}

const CONTENT_SIZES = [[250, 250], [300, 250], [336, 250], [336, 280], [1, 1], 'fluid']
const SECURITY_DELAY_MS = 500
const LAZY_LOAD = { fetchMarginPercent: 0.5, renderMarginPercent: 0.5, mobileScaling: 1.2 }

interface Defined {
  block: PublicBlock
  slot: GptSlot
  container: HTMLElement | null
}

/** O caminho do bloco no aparelho, ou nada quando ele não roda nele. */
export function blockPath(block: PublicBlock, device: Device): string | null {
  return device === 'mobile' ? block.mobile : block.desktop
}

/** Os blocos que rodam nesta página e aparelho, na ordem da tag. */
export function pageBlocks(config: PublicAdTag, device: Device, path: string): PublicBlock[] {
  return config.blocks.filter(
    (block) => blockPath(block, device) !== null && blockAllowed(path, block.rule_mode, block.paths),
  )
}

/** Define o slot do bloco no GPT; âncora e intersticial são formatos fora da página. */
function defineSlot(googletag: GoogleTag, block: PublicBlock, path: string, device: Device): GptSlot | null {
  const formats = googletag.enums.OutOfPageFormat
  if (block.kind === 'anchor') {
    return googletag.defineOutOfPageSlot(path, block.edge === 'top' ? formats.TOP_ANCHOR : formats.BOTTOM_ANCHOR)
  }
  if (block.kind === 'interstitial') return googletag.defineOutOfPageSlot(path, formats.INTERSTITIAL)
  const sizes = block.kind === 'fixed' ? (device === 'mobile' ? [[320, 50]] : [[728, 90]]) : CONTENT_SIZES
  const slot = googletag.defineSlot(path, sizes, blockElementId(block))
  slot?.setConfig({ collapseDiv: 'ON_NO_FILL' })
  return slot
}

/** Manda os key-values da página para o Avant, como a g-tag (`/api/admanager/keyvalue`). */
function reportKeyValues(deps: AdsDeps, values: Record<string, string>, network: string | null): void {
  if (!network) return
  const items = Object.entries(values).map(([name, value]) => ({ name, value, network }))
  sendBeacon(deps.target, `${deps.origin}/api/admanager/keyvalue`, items, 'application/json')
}

/** Liga os anúncios da tag na página. */
export function startAds(config: PublicAdTag, deps: AdsDeps): AdsRun {
  const { target } = deps
  const page = target.document
  const googletag = ensureGpt(target)
  const ready = gptReady(googletag)
  const results = new Map<string, BlockState>()
  /** Avisa que o primeiro anúncio ficou visível (trocada pela promessa abaixo). */
  let markViewable = (): void => undefined
  const firstViewable = new Promise<void>((resolve) => {
    markViewable = resolve
  })
  const blocks = pageBlocks(config, deps.device, target.location.pathname)
  target.setTimeout(() => {
    if (blocks.length === 0 || overlayCovers(target)) return
    void (deps.targeting ?? Promise.resolve(null)).catch(() => null).then((extra) => showBlocks(extra))
  }, SECURITY_DELAY_MS)
  /** Põe os blocos na página com os key-values e as keys das regras de preço, quando há. */
  const showBlocks = (extra: AdTargeting | null): void => {
    const values = pageKeyValues(target)
    const firstPath = blockPath(blocks[0] as PublicBlock, deps.device) ?? ''
    reportKeyValues(deps, values, networkOfPath(firstPath))
    const placed = blocks.map((block) => ({ block, container: placeBlock(page, block) }))
    googletag.cmd.push(() => {
      const targeting = { ...values, ...(extra?.page ?? {}) }
      googletag.setConfig({ targeting, ...(config.lazy_load ? { lazyLoad: LAZY_LOAD } : {}) })
      const defined: Defined[] = []
      const refreshing = new Set<GptSlot>()
      const cascades = new Map<GptSlot, Cascade>()
      const emptied = new Set<GptSlot>()
      for (const { block, container } of placed) {
        if (block.kind === 'content' && !container) continue
        const path = blockPath(block, deps.device) as string
        const slot = defineSlot(googletag, block, path, deps.device)
        if (!slot) continue
        const slotTargeting = extra?.slot(path, CASCADE_KINDS.includes(block.kind)) ?? {}
        if (Object.keys(slotTargeting).length > 0) slot.setConfig({ targeting: slotTargeting })
        slot.addService(googletag.pubads())
        const found = { block, slot, container }
        defined.push(found)
        const ladder = CASCADE_KINDS.includes(block.kind) ? extra?.cascade?.(path) : null
        if (ladder) {
          cascades.set(slot, startCascade({ googletag, slot, ladder }))
        }
      }
      /** Grava o bloco como vazio e avisa uma vez só, mesmo que o fim venha por dois caminhos. */
      const settleEmpty = (item: Defined): void => {
        if (emptied.has(item.slot)) return
        emptied.add(item.slot)
        results.set(item.block.unit_type, 'empty')
        deps.onEmpty?.(item.block, item.container)
      }
      /** Guarda como o bloco terminou, põe rótulos, refresh ou o artigo MGID. */
      const onRendered = (event: GptSlotEvent): void => {
        const found = defined.find((item) => item.slot === event.slot)
        if (!found) return
        const cascade = cascades.get(found.slot)
        if (event.isEmpty) {
          if (cascade?.onEmpty()) return
          settleEmpty(found)
          return
        }
        cascade?.done()
        emptied.delete(found.slot)
        results.set(found.block.unit_type, 'rendered')
        if (found.block.kind === 'content' && found.container && !found.container.querySelector('.avt-label')) {
          addLabels(page, found.container, deps.language)
        }
        const element = page.getElementById(blockElementId(found.block))
        if (found.block.refresh_seconds && element && !refreshing.has(found.slot)) {
          refreshing.add(found.slot)
          const beforeRefresh = cascade ? () => safely(() => cascade.restart()) : undefined
          startRefresh(target, googletag, found.slot, element, found.block.refresh_seconds, beforeRefresh)
        }
      }
      googletag.pubads().addEventListener('slotRequested', (event) => cascades.get(event.slot)?.requested())
      googletag.pubads().addEventListener('slotRenderEnded', onRendered)
      googletag.pubads().addEventListener('impressionViewable', () => markViewable())
      googletag.enableServices()
      for (const { block, slot } of defined) {
        googletag.display(block.kind === 'content' || block.kind === 'fixed' ? blockElementId(block) : slot)
      }
    })
  }
  return {
    gptReady: ready,
    firstViewable,
    results: () => [...results].map(([type, state]) => ({ type, state })),
  }
}
