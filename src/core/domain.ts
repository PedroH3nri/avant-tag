/**
 * O domínio da página como o Avant guarda: minúsculo e sem `www.`.
 */

/** `WWW.Blog.com` vira `blog.com`. */
export function normalizeDomain(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, '')
}
