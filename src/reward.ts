/**
 * Entrada do reward.js, o reward sozinho (sem a ad tag), no mesmo endereço de sempre. Com o
 * tag.js na página, quem roda o reward é a tag e este script desiste.
 */

import { claimPage } from './core/guard'

/** Liga o reward uma vez por página. */
export function boot(target: Window = window): boolean {
  return claimPage(target, 'reward')
}

if (import.meta.env.MODE !== 'test') boot()
