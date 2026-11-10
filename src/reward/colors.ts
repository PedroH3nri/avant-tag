/** Contas de cor da janela do reward, iguais às do protótipo (design/prototype). */

/** Os três canais (0 a 255) de uma cor #rrggbb. */
function channels(hex: string): number[] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) || 0)
}

/** Volta os canais para #rrggbb. */
function toHex(values: number[]): string {
  return `#${values.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`
}

/** Luminância relativa de uma cor #rrggbb (0 escuro, 1 claro). */
export function luminance(hex: string): number {
  const [red = 0, green = 0, blue = 0] = channels(hex)
    .map((value) => value / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** Clareia (positivo) ou escurece (negativo) a cor pela fração dada. */
export function shade(hex: string, amount: number): string {
  return toHex(
    channels(hex).map((value) => (amount >= 0 ? value + (255 - value) * amount : value * (1 + amount))),
  )
}

/** Mistura duas cores, com `weight` (0 a 1) da primeira. */
export function mix(first: string, second: string, weight: number): string {
  const right = channels(second)
  return toHex(channels(first).map((value, index) => value * weight + (right[index] ?? 0) * (1 - weight)))
}

/** Degradê da cor de destaque, do tom escuro ao claro. */
export function accentGradient(hex: string): string {
  return `linear-gradient(135deg, ${shade(hex, -0.55)} 0%, ${hex} 100%)`
}
