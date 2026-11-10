/** As 8 fontes da janela (as mesmas de FONTS no avant-core), com a pilha CSS e o link do Google Fonts. */

const FONT_STACKS: Record<string, string> = {
  Geist: "'Geist', system-ui, sans-serif",
  Inter: "'Inter', system-ui, sans-serif",
  Roboto: "'Roboto', system-ui, sans-serif",
  Montserrat: "'Montserrat', system-ui, sans-serif",
  Poppins: "'Poppins', system-ui, sans-serif",
  Lora: "'Lora', Georgia, serif",
  Merriweather: "'Merriweather', Georgia, serif",
  'Playfair Display': "'Playfair Display', Georgia, serif",
}

/** A pilha CSS da fonte escolhida (Geist se o nome não for conhecido). */
export function fontStack(name: string): string {
  return FONT_STACKS[name] ?? FONT_STACKS.Geist ?? 'system-ui, sans-serif'
}

/** O endereço da folha do Google Fonts com a fonte, nos pesos que a janela usa. */
export function fontStylesheet(name: string): string {
  const family = (name in FONT_STACKS ? name : 'Geist').replace(/ /g, '+')
  return `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`
}
