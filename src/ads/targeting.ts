/**
 * Os key-values da página, como a g-tag: `id_post_wp` do `shortlink` do WordPress, `land_uri`,
 * `content_hash` e as UTMs (até 60 caracteres cada).
 */

import { contentHash } from '../core/hash'

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
const MAX_VALUE = 60

/** O id do post do WordPress pelo `<link rel="shortlink" href="...?p=123">`. */
export function wordpressPostId(page: Document): string | null {
  const link = page.querySelector<HTMLLinkElement>('link[rel="shortlink"]')
  if (!link?.href) return null
  try {
    return new URL(link.href).searchParams.get('p')
  } catch {
    return null
  }
}

/** Os key-values da página, só os que têm valor. */
export function pageKeyValues(target: Window): Record<string, string> {
  const { location } = target
  const values: Record<string, string> = {
    land_uri: location.pathname.trim().slice(0, MAX_VALUE),
    content_hash: contentHash(location.hostname, location.pathname),
  }
  const postId = wordpressPostId(target.document)
  if (postId) values.id_post_wp = postId
  const query = new URLSearchParams(location.search)
  for (const key of UTM_KEYS) {
    const value = query.get(key)?.trim()
    if (value) values[key] = value.slice(0, MAX_VALUE)
  }
  return values
}

/** O código da network para o envio dos key-values: o primeiro trecho do caminho do bloco. */
export function networkOfPath(path: string): string | null {
  const first = path.split('/')[1] ?? ''
  return first.split(',')[0] || null
}
