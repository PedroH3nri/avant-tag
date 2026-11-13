/**
 * Roda a página de teste do rebid (avant-tag#18) num Chrome de verdade com o GPT real e mostra,
 * por formato, quantos pedidos ao GAM saíram e os eventos do slot. Uso: `node rodar.mjs`.
 */

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { chromium, devices } from 'playwright'

const FORMATS = ['anchor', 'fixed', 'content', 'content-lazy', 'interstitial', 'rewarded']
const WAIT_MS = 20_000
const pageHtml = await readFile(new URL('./index.html', import.meta.url))

/** Serve a página de teste em localhost. */
const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(pageHtml)
}).listen(8765)

/** Abre o formato no aparelho pedido e devolve o que o slot fez e os pedidos ao GAM. */
async function runFormat(browser, format, deviceName) {
  const context = await browser.newContext(deviceName ? devices[deviceName] : { viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  const adRequests = []
  page.on('request', (request) => {
    if (!request.url().includes('/gampad/ads')) return
    const query = new URL(request.url()).searchParams
    adRequests.push({ prev_scp: query.get('prev_scp'), scp: query.get('scp'), cust_params: query.get('cust_params') })
  })
  const lazy = format === 'content-lazy'
  await page.goto(`http://localhost:8765/?formato=${lazy ? 'content&lazy=1' : format}`)
  if (lazy) {
    await page.waitForTimeout(4000)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  }
  await page.waitForFunction(() => window.__resultado?.fim === true, null, { timeout: WAIT_MS }).catch(() => null)
  await page.waitForTimeout(1500)
  const result = await page.evaluate(() => window.__resultado)
  await context.close()
  return { aparelho: deviceName ?? 'desktop', pedidos_ao_gam: adRequests.length, parametros: adRequests, ...result }
}

const browser = await chromium.launch({ headless: false, channel: process.env.CANAL ?? 'chrome' }).catch(() =>
  chromium.launch({ headless: false }),
)
const results = []
for (const format of FORMATS) {
  for (const deviceName of [undefined, 'Pixel 7']) results.push(await runFormat(browser, format, deviceName))
}
await browser.close()
server.close()
console.log(JSON.stringify(results, null, 2))
