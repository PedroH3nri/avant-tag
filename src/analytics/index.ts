/**
 * O Google Analytics da tag: `gtag.js` com o ID, sem duplicar se a página já tiver um.
 */

export const GTAG_SOURCE = 'https://www.googletagmanager.com/gtag/js'

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...values: unknown[]) => void }

/** Liga o Analytics com o ID; diz se ligou (não liga sem ID ou se a página já tem). */
export function startAnalytics(target: Window, analyticsId: string | null): boolean {
  if (!analyticsId) return false
  const page = target.document
  if (page.querySelector(`script[src^="${GTAG_SOURCE}"]`)) return false
  const gtagWindow = target as GtagWindow
  const script = page.createElement('script')
  script.async = true
  script.src = `${GTAG_SOURCE}?id=${encodeURIComponent(analyticsId)}`
  page.head.append(script)
  gtagWindow.dataLayer = gtagWindow.dataLayer ?? []
  /** Põe o comando na fila do Analytics, como o `gtag` oficial. */
  gtagWindow.gtag = function gtag() {
    gtagWindow.dataLayer?.push(arguments)
  }
  gtagWindow.gtag('js', new Date())
  gtagWindow.gtag('config', analyticsId)
  return true
}
