/**
 * O próprio `<script>` da tag: a chave (`data-tag`) e a origem da API (a do `src`).
 */

export interface TagScript {
  key: string
  origin: string
}

const KEY_PATTERN = /^tg_[a-z0-9]{8}$/

/** A origem do endereço do script, ou a da página quando o endereço não serve. */
export function scriptOrigin(source: string | null | undefined, fallback: string): string {
  try {
    return new URL(source ?? '', fallback).origin
  } catch {
    return fallback
  }
}

/** Acha o script da tag (o atual ou o primeiro com `data-tag`) e lê a chave; sem chave válida, nada. */
export function findTagScript(target: Window): TagScript | null {
  const current = target.document.currentScript
  const element =
    current instanceof HTMLScriptElement && current.dataset.tag
      ? current
      : target.document.querySelector<HTMLScriptElement>('script[data-tag]')
  const key = element?.dataset.tag?.trim() ?? ''
  if (!element || !KEY_PATTERN.test(key)) return null
  return { key, origin: scriptOrigin(element.src, target.location.origin) }
}
