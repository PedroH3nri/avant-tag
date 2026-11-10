/**
 * Quem visita: o `visitor_id` fica no `localStorage` e a sessão vale 10 minutos sem página nova.
 */

import { localStore } from '../core/config'
import { newId } from '../core/ids'

export const VISITOR_KEY = 'avant:visitor'
export const SESSION_KEY = 'avant:session'
export const SESSION_MS = 10 * 60 * 1000

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

interface StoredSession {
  id: string
  last: number
}

/** O id guardado do visitante, ou um novo (guardado quando o navegador deixa). */
export function visitorId(target: Window): string {
  const store = localStore(target)
  const saved = store?.getItem(VISITOR_KEY) ?? ''
  if (UUID_PATTERN.test(saved)) return saved
  const created = newId(target)
  try {
    store?.setItem(VISITOR_KEY, created)
  } catch {
    return created
  }
  return created
}

/** A sessão da página: a mesma se a última página foi há menos de 10 minutos. */
export function sessionId(target: Window, now: number): string {
  const store = localStore(target)
  let session: StoredSession | null = null
  try {
    session = JSON.parse(store?.getItem(SESSION_KEY) ?? 'null') as StoredSession | null
  } catch {
    session = null
  }
  const current =
    session && UUID_PATTERN.test(session.id) && now - session.last < SESSION_MS ? session.id : newId(target)
  try {
    store?.setItem(SESSION_KEY, JSON.stringify({ id: current, last: now }))
  } catch {
    return current
  }
  return current
}
