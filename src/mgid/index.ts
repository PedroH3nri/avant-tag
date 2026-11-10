/**
 * O MGID da tag: o script do site, os widgets fixos (smart widget, back button e sidebar) e o
 * artigo no lugar de um bloco que ficou vazio.
 */

import type { PublicMgid } from '../core/types'

export const MGID_SCRIPT = 'https://jsc.mgid.com/site/'
const ARTICLE_WAIT_MS = 3000

type MgidWindow = Window & { _mgq?: unknown[] }

/** Um `div` de widget do MGID. */
function widget(page: Document, widgetId: string): HTMLElement {
  const element = page.createElement('div')
  element.dataset.type = '_mgwidget'
  element.dataset.widgetId = widgetId
  return element
}

/** Pede ao MGID para montar os widgets novos. */
function loadWidgets(target: Window): void {
  const mgidWindow = target as MgidWindow
  mgidWindow._mgq = mgidWindow._mgq ?? []
  mgidWindow._mgq.push(['_mgc.load'])
}

/** Põe o script do site e os widgets fixos; sem `tag_id` não faz nada. */
export function startMgid(target: Window, mgid: PublicMgid): boolean {
  if (!mgid.tag_id) return false
  const page = target.document
  const source = `${MGID_SCRIPT}${mgid.tag_id}.js`
  if (!page.querySelector(`script[src="${source}"]`)) {
    const script = page.createElement('script')
    script.src = source
    script.async = true
    page.head.append(script)
  }
  for (const widgetId of [mgid.smart_widget, mgid.back_button, mgid.sidebar]) {
    if (widgetId) page.body.append(widget(page, widgetId))
  }
  loadWidgets(target)
  return true
}

/** Põe o artigo do MGID no bloco vazio; some com o bloco se nada chegar em 3 s. */
export function insertArticle(target: Window, articleId: string, container: HTMLElement): void {
  const element = widget(target.document, articleId)
  container.append(element)
  loadWidgets(target)
  target.setTimeout(() => {
    if (element.childElementCount === 0) container.style.display = 'none'
  }, ARTICLE_WAIT_MS)
}
