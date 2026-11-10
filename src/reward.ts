/**
 * Entrada do reward.js, o reward sozinho (sem a ad tag), no mesmo endereço de sempre. Com o
 * tag.js na página, o reward roda uma vez só: quem chegar primeiro roda e o outro desiste.
 */

import { claimPage } from './core/guard'
import { domReady } from './core/safely'
import { scriptOrigin } from './core/script'
import { startReward } from './reward/start'

/** Liga o reward uma vez por página, depois que o documento carregou; diz se ligou. */
export async function boot(target: Window = window): Promise<boolean> {
  if (!claimPage(target, 'reward')) return false
  const script = target.document.currentScript as HTMLScriptElement | null
  const origin = scriptOrigin(script?.src, target.location.origin)
  await domReady(target)
  await startReward(origin, target)
  return true
}

if (import.meta.env.MODE !== 'test') void boot().catch(() => undefined)
