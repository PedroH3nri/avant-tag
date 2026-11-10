/**
 * Ids aleatórios no formato UUID v4, que a API guarda como `uuid`.
 */

/** Um UUID v4 novo, pelo `crypto` da janela. */
export function newId(target: Window): string {
  const generator = target.crypto
  if (typeof generator?.randomUUID === 'function') return generator.randomUUID()
  const bytes = new Uint8Array(16)
  generator.getRandomValues(bytes)
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
