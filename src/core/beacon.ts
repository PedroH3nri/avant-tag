/**
 * Envio que sobrevive à saída da página: `sendBeacon`, ou `fetch` com `keepalive` sem ele.
 * O corpo vai como `text/plain` (sem preflight de CORS), a não ser que o tipo seja outro.
 */

/** Manda o corpo em JSON para o endereço; diz se o navegador aceitou o envio. */
export function sendBeacon(target: Window, address: string, body: unknown, type = 'text/plain'): boolean {
  const text = JSON.stringify(body)
  try {
    if (target.navigator.sendBeacon?.(address, new Blob([text], { type }))) return true
  } catch {
    return false
  }
  void target
    .fetch(address, { method: 'POST', body: text, keepalive: true, credentials: 'omit', headers: { 'Content-Type': type } })
    .catch(() => undefined)
  return true
}
