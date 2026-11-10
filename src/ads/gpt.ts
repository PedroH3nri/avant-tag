/**
 * O Google Publisher Tag (GPT): só o que a tag usa, carregado uma vez por página.
 */

export const GPT_SOURCE = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'

export interface GptSlot {
  addService(service: GptPubAds): GptSlot
  setConfig(config: Record<string, unknown>): void
  getSlotElementId(): string
}

export interface GptSlotEvent {
  slot: GptSlot
  isEmpty?: boolean
}

export interface GptPubAds {
  addEventListener(name: string, listener: (event: GptSlotEvent) => void): void
  removeEventListener(name: string, listener: (event: GptSlotEvent) => void): void
  refresh(slots: GptSlot[]): void
}

export interface GoogleTag {
  apiReady?: boolean
  cmd: { push(command: () => void): unknown }
  enums: { OutOfPageFormat: { TOP_ANCHOR: number; BOTTOM_ANCHOR: number; INTERSTITIAL: number } }
  defineSlot(path: string, sizes: unknown, elementId: string): GptSlot | null
  defineOutOfPageSlot(path: string, format: number): GptSlot | null
  pubads(): GptPubAds
  setConfig(config: Record<string, unknown>): void
  enableServices(): void
  display(slotOrId: GptSlot | string): void
  destroySlots(slots?: GptSlot[]): boolean
}

type GptWindow = Window & { googletag?: Partial<GoogleTag> }

/** A fila do `googletag` da página (criada se faltar) e o `gpt.js` uma vez só. */
export function ensureGpt(target: Window): GoogleTag {
  const page = target as GptWindow
  page.googletag = page.googletag ?? {}
  page.googletag.cmd = page.googletag.cmd ?? []
  if (!target.document.querySelector(`script[src^="${GPT_SOURCE}"]`)) {
    const script = target.document.createElement('script')
    script.async = true
    script.src = GPT_SOURCE
    script.crossOrigin = 'anonymous'
    target.document.head.append(script)
  }
  return page.googletag as GoogleTag
}

/** Termina quando o GPT roda a fila de comandos (a API está pronta). */
export function gptReady(googletag: GoogleTag): Promise<void> {
  return new Promise((resolve) => {
    googletag.cmd.push(() => resolve())
  })
}
