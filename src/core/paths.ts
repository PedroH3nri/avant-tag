/**
 * Regras de caminho dos blocos: `all`, `include` ou `exclude`, com `*` como curinga
 * (`/receitas/*`). Não depende de `www`, parâmetros nem `http`.
 */

import type { RuleMode } from './types'

/** Transforma o padrão em expressão regular de caminho inteiro. */
function patternExpression(pattern: string): RegExp {
  const clean = `/${pattern.trim().replace(/^\/+/, '')}`
  const escaped = clean.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}/?$`, 'i')
}

/** Diz se o caminho casa com algum padrão. */
export function matchesAny(path: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => patternExpression(pattern).test(path || '/'))
}

/** Diz se o bloco roda no caminho, pela regra dele. */
export function blockAllowed(path: string, mode: RuleMode, patterns: readonly string[]): boolean {
  if (mode === 'all' || patterns.length === 0) return true
  const found = matchesAny(path, patterns)
  return mode === 'include' ? found : !found
}
