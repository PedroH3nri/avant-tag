/**
 * A página do cliente nunca quebra: cada módulo da tag roda aqui e um erro fica nele.
 */

/** Roda o módulo e devolve o resultado, ou nada quando ele falha. */
export function safely<Result>(run: () => Result): Result | null {
  try {
    return run()
  } catch {
    return null
  }
}

/** Espera o documento carregar (o `<body>` e o conteúdo para os seletores). */
export function domReady(target: Window): Promise<void> {
  if (target.document.readyState !== 'loading') return Promise.resolve()
  return new Promise((resolve) => {
    target.document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
  })
}
