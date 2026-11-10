/**
 * O idioma do visitante pelo navegador, só a língua (`pt-BR` vira `pt`).
 */

/** A língua do navegador entre as conhecidas, ou o padrão. */
export function browserLanguage(target: Window, known: readonly string[], fallback: string): string {
  const candidates = [...(target.navigator.languages ?? []), target.navigator.language]
  for (const candidate of candidates) {
    const language = (candidate ?? '').toLowerCase().split('-')[0] ?? ''
    if (known.includes(language)) return language
  }
  return fallback
}
