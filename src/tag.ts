/**
 * Entrada do tag.js, a ad tag do Avant no site do cliente:
 * `<script async src="https://avant.groone.com/tag.js" data-tag="{chave}"></script>`.
 */

import { claimPage } from './core/guard'

/** Liga a tag uma vez por página; a segunda tag na mesma página desiste. */
export function boot(target: Window = window): boolean {
  return claimPage(target, 'tag')
}

if (import.meta.env.MODE !== 'test') boot()
