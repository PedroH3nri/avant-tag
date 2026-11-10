/**
 * O ícone do site, lido da página como a g-tag faz (`icon`, `shortcut icon` e `apple-touch-icon`,
 * nessa ordem); sem ícone, o nome do site (a primeira parte do domínio).
 */

const ICON_SELECTORS = ['link[rel="icon"]', 'link[rel="shortcut icon"]', 'link[rel="apple-touch-icon"]']

/** O endereço do ícone da página, ou nada. */
export function siteIconUrl(page: Document): string | null {
  for (const selector of ICON_SELECTORS) {
    const link = page.querySelector<HTMLLinkElement>(selector)
    if (link?.href) return link.href
  }
  return null
}

/** O nome do site para quando não há ícone: `receitas.com.br` vira `receitas`. */
export function siteName(domain: string): string {
  return domain.replace(/^www\./, '').split('.')[0] ?? domain
}
