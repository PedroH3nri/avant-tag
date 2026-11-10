/**
 * O offerwall do Google (`.fc-monetization-dialog`) tem a vez: com ele na página, o reward da tag
 * não abre.
 */

export const OFFERWALL_SELECTOR = '.fc-monetization-dialog'
export const OFFERWALL_WAIT_MS = 2500
const CHECK_EVERY_MS = 100

/** Diz se o offerwall apareceu dentro do tempo. */
export function offerwallShown(target: Window, milliseconds = OFFERWALL_WAIT_MS): Promise<boolean> {
  const started = Date.now()
  return new Promise((resolve) => {
    /** Confere a página até o offerwall aparecer ou o tempo acabar. */
    const check = (): void => {
      if (target.document.querySelector(OFFERWALL_SELECTOR)) return resolve(true)
      if (Date.now() - started >= milliseconds) return resolve(false)
      target.setTimeout(check, CHECK_EVERY_MS)
    }
    check()
  })
}
