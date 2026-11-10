/**
 * Cores do loader: a cor do texto que dá leitura sobre o fundo e a cor com transparência do véu.
 */

/** Os três canais da cor `#rrggbb`. */
function channels(color: string): [number, number, number] {
  const hex = color.replace('#', '')
  /** Um canal pela posição no texto. */
  const read = (start: number): number => parseInt(hex.slice(start, start + 2), 16) || 0
  return [read(0), read(2), read(4)]
}

/** Preto ou branco, o que dá leitura sobre a cor. */
export function inkFor(background: string): string {
  const [red, green, blue] = channels(background)
  return red * 0.299 + green * 0.587 + blue * 0.114 > 150 ? '#171717' : '#ffffff'
}

/** A cor em `rgba` com a transparência pedida. */
export function tint(color: string, alpha: number): string {
  const [red, green, blue] = channels(color)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
