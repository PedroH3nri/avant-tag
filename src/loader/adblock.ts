/**
 * Detecção de adblock como a g-tag: busca o `ppub_config` do GPT; falha ou resposta ruim é
 * bloqueador. Guarda o resultado na sessão para as outras partes da tag.
 */

export const ADBLOCK_PROBE = 'https://securepubads.g.doubleclick.net/pagead/ppub_config'
export const ADBLOCK_KEY = 'avant-has-adblock'

/** A sessão do navegador, ou nada quando bloqueada. */
function sessionStore(target: Window): Storage | null {
  try {
    return target.sessionStorage
  } catch {
    return null
  }
}

/** Diz se o visitante usa bloqueador de anúncios e guarda a resposta na sessão. */
export async function detectAdblock(target: Window): Promise<boolean> {
  let blocked: boolean
  try {
    const response = await target.fetch(ADBLOCK_PROBE, { credentials: 'omit' })
    blocked = !response.ok
  } catch {
    blocked = true
  }
  sessionStore(target)?.setItem(ADBLOCK_KEY, String(blocked))
  return blocked
}
