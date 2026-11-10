/**
 * O `content_hash` da página, igual ao da g-tag: domínio sem `www` mais o caminho sem a barra do
 * fim, em minúsculas, com dois hashes de 32 bits (FNV-1a e um misturador) em 16 dígitos hex.
 */

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193
const MIX_SEED = 0x9e3779b9
const MIX_PRIME = 0x85ebca6b

/** Os 16 dígitos hex do texto. */
export function pageHash(text: string): string {
  let first = FNV_OFFSET
  let second = MIX_SEED
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    first ^= code
    first = Math.imul(first, FNV_PRIME)
    second = Math.imul(second ^ code, MIX_PRIME)
  }
  return (first >>> 0).toString(16).padStart(8, '0') + (second >>> 0).toString(16).padStart(8, '0')
}

/** O hash do conteúdo pelo host e o caminho da página. */
export function contentHash(hostname: string, pathname: string): string {
  const host = hostname.toLowerCase().replace(/^www\./, '')
  const path = pathname.toLowerCase().replace(/\/+$/, '')
  return pageHash(`${host}${path}`)
}
