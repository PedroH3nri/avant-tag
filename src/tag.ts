/**
 * Entrada do tag.js, a ad tag do Avant no site do cliente:
 * `<script async src="https://avant.groone.com/tag.js" data-tag="{chave}"></script>`.
 * A ordem: guarda, configuração, loader, visitas, anúncios, Analytics, MGID e reward.
 */

import { startAds, type AdsRun } from './ads'
import { startAnalytics } from './analytics'
import { browserLanguage, claimPage, detectDevice, domReady, findTagScript, loadConfig, normalizeDomain, safely } from './core'
import type { PublicAdTag, PublicBlock } from './core/types'
import { detectAdblock, LOADER_LANGUAGES, startLoader } from './loader'
import { insertArticle, startMgid } from './mgid'
import { startPageViews } from './page-views'
import { offerwallShown, startReward } from './reward/index'

export interface TagRun {
  config: PublicAdTag
  ads: AdsRun | null
}

/** Uma promessa que nunca termina, para o loader quando os anúncios não ligaram. */
const NEVER = new Promise<void>(() => undefined)

/** Põe o artigo do MGID no lugar de um bloco que ficou vazio, quando ele tem um. */
function emptyBlockHandler(target: Window, config: PublicAdTag) {
  return (block: PublicBlock, container: HTMLElement | null): void => {
    if (block.mgid_article && container && config.mgid.tag_id) {
      safely(() => insertArticle(target, block.mgid_article as string, container))
    }
  }
}

/** Abre o reward da tag se nenhum outro abriu e o offerwall do Google não apareceu. */
async function runReward(target: Window, origin: string): Promise<void> {
  if (!claimPage(target, 'reward')) return
  if (await offerwallShown(target)) return
  await startReward(origin, target)
}

/** Liga a tag na página; devolve nada quando ela não roda (segunda tag, sem chave ou sem configuração). */
export async function runTag(target: Window = window): Promise<TagRun | null> {
  if (!claimPage(target, 'tag')) return null
  const script = findTagScript(target)
  if (!script) return null
  const config = await loadConfig(target, script.origin, script.key)
  if (!config) return null
  const device = detectDevice(target)
  const language = browserLanguage(target, LOADER_LANGUAGES, 'en')
  const adblock = detectAdblock(target).catch(() => false)
  let adblockSeen = false
  void adblock.then((found) => {
    adblockSeen = found
  })
  let ads: AdsRun | null = null
  /** Os anúncios começam quando o conteúdo da página já existe. */
  const adsStarted = domReady(target).then(() => {
    ads = safely(() =>
      startAds(config, { target, origin: script.origin, device, language, onEmpty: emptyBlockHandler(target, config) }),
    )
    return ads
  })
  if (config.loader) {
    const loader = config.loader
    safely(() =>
      startLoader(loader, {
        target,
        domain: normalizeDomain(target.location.hostname),
        language,
        adblock,
        gptReady: adsStarted.then((run) => run?.gptReady ?? NEVER),
        firstViewable: adsStarted.then((run) => run?.firstViewable ?? NEVER),
      }),
    )
  }
  safely(() =>
    startPageViews(config, {
      target,
      origin: script.origin,
      device,
      language,
      adblock: () => adblockSeen,
      blocks: () => (ads as AdsRun | null)?.results() ?? [],
    }),
  )
  await adsStarted
  safely(() => startAnalytics(target, config.analytics_id))
  safely(() => startMgid(target, config.mgid))
  if (config.reward) void runReward(target, script.origin).catch(() => undefined)
  return { config, ads }
}

if (import.meta.env.MODE !== 'test') void runTag().catch(() => undefined)
