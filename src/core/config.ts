/**
 * Busca a configuração da tag na API e guarda a última no `localStorage`, usada quando a API
 * falha. A cópia só vale para o mesmo domínio e a mesma chave.
 */

import { normalizeDomain } from './domain'
import type { PublicAdTag, PublicTagResponse } from './types'

const STORAGE_PREFIX = 'avant:tag:'
const FETCH_TIMEOUT_MS = 5_000

/** O armazenamento local, ou nada quando o site ou o visitante bloqueou. */
export function localStore(target: Window): Storage | null {
  try {
    return target.localStorage
  } catch {
    return null
  }
}

/** Lê a cópia guardada da tag, se ela for da chave e do domínio da página. */
export function cachedConfig(target: Window, key: string): PublicAdTag | null {
  try {
    const saved = localStore(target)?.getItem(STORAGE_PREFIX + key)
    const config = saved ? (JSON.parse(saved) as PublicAdTag) : null
    return config && matchesPage(config, key, target) ? config : null
  } catch {
    return null
  }
}

/** Diz se a configuração é desta chave e do domínio da página. */
export function matchesPage(config: PublicAdTag, key: string, target: Window): boolean {
  return config.key === key && config.domain === normalizeDomain(target.location.hostname)
}

/** Busca a configuração; tag vazia na API apaga a cópia, e erro de rede usa a cópia. */
export async function loadConfig(target: Window, origin: string, key: string): Promise<PublicAdTag | null> {
  const address = `${origin}/api/tag/config?key=${encodeURIComponent(key)}&url=${encodeURIComponent(target.location.href)}`
  try {
    const response = await withTimeout(target.fetch(address, { credentials: 'omit' }), FETCH_TIMEOUT_MS, target)
    if (!response.ok) return cachedConfig(target, key)
    const { tag } = (await response.json()) as PublicTagResponse
    const store = localStore(target)
    if (!tag || !matchesPage(tag, key, target)) {
      store?.removeItem(STORAGE_PREFIX + key)
      return null
    }
    store?.setItem(STORAGE_PREFIX + key, JSON.stringify(tag))
    return tag
  } catch {
    return cachedConfig(target, key)
  }
}

/** Rejeita a promessa se ela não terminar no tempo. */
function withTimeout<Value>(promise: Promise<Value>, milliseconds: number, target: Window): Promise<Value> {
  return new Promise((resolve, reject) => {
    const timer = target.setTimeout(() => reject(new Error('tempo esgotado')), milliseconds)
    promise.then(
      (value) => {
        target.clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        target.clearTimeout(timer)
        reject(error)
      },
    )
  })
}
