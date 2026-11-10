/**
 * Peças comuns da tag: configuração, script, aparelho, idioma, envio, regras e guarda.
 */

export { sendBeacon } from './beacon'
export { cachedConfig, loadConfig, localStore, matchesPage } from './config'
export { detectDevice } from './device'
export { normalizeDomain } from './domain'
export { claimPage, type PagePart } from './guard'
export { contentHash, pageHash } from './hash'
export { newId } from './ids'
export { domReady, safely } from './safely'
export { browserLanguage } from './language'
export { blockAllowed, matchesAny } from './paths'
export { findTagScript, scriptOrigin, type TagScript } from './script'
export type * from './types'
