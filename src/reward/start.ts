/**
 * O reward na página: busca o reward na API de onde o script veio e abre a janela no gatilho
 * escolhido (ao carregar, na rolagem ou no clique). Usado pelo tag.js e pelo reward.js.
 */

import { REWARD_CASCADE_ENABLED } from '../ads/cascade'
import { localStore } from '../core/config'
import { visitorId } from '../page-views'
import { blockOfPath, groupOf, RULE_GROUP } from '../price-rules'
import { showRewardedAd, type RewardCascade } from './ads'
import type { PublicReward, PublicRewardPage, RewardPriceRules } from './types'
import { coolingDown, deviceAdUnits, RewardWidget, type LeadBody, type RewardEvent, type WidgetPorts } from './widget'

/** A origem da API: a mesma do endereço do reward.js. */
export function apiOrigin(scriptSource: string | undefined, fallback: string): string {
  try {
    return new URL(scriptSource ?? '', fallback).origin
  } catch {
    return fallback
  }
}

/** As saídas reais do script: beacon para eventos, fetch para o contato, GPT para o anúncio. */
export function browserPorts(origin: string, target: Window = window, cascade?: RewardCascade): WidgetPorts {
  return {
    /** Manda o lote por beacon (sobrevive à saída da página); sem beacon, por fetch. */
    sendEvents(events: RewardEvent[]) {
      const body = JSON.stringify({ events })
      const url = `${origin}/api/reward/events`
      if (target.navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return
      void target.fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => undefined)
    },
    /** Manda o contato e diz se a API aceitou. */
    async sendLead(lead: LeadBody) {
      try {
        const response = await target.fetch(`${origin}/api/reward/leads`, {
          method: 'POST',
          body: JSON.stringify(lead),
          keepalive: true,
          headers: { 'Content-Type': 'text/plain' },
        })
        return response.ok
      } catch {
        return false
      }
    },
    showAd: (paths) => showRewardedAd(paths, target, cascade),
    now: () => Date.now(),
    storage: localStore(target),
  }
}

/** O grupo e a escada de cada caminho; nada com a flag desligada ou sem regra, e sem escada no controle. */
export function rewardCascade(
  rules: RewardPriceRules | null,
  visitor: () => string,
  enabled: boolean = REWARD_CASCADE_ENABLED,
): RewardCascade | undefined {
  if (!enabled || !rules) return undefined
  const group = groupOf(visitor(), rules.control_percent)
  if (group !== RULE_GROUP) return { group, ladderOfPath: () => null }
  return {
    group,
    ladderOfPath: (path) => {
      const block = blockOfPath(path)
      const ladder = block ? rules.cascades[block] : undefined
      return ladder && ladder.length > 0 ? ladder : null
    },
  }
}

/** Abre a janela no gatilho do reward: logo, ao passar da rolagem pedida ou no clique no seletor. */
export function armTrigger(reward: PublicReward, open: () => void, target: Window = window): void {
  if (reward.trigger === 'scroll') {
    const percent = reward.scroll_percent ?? 50
    /** Confere a rolagem e abre uma vez ao passar do ponto. */
    const onScroll = (): void => {
      const element = target.document.documentElement
      const scrollable = element.scrollHeight - target.innerHeight
      const reached = scrollable <= 0 ? 100 : (target.scrollY / scrollable) * 100
      if (reached < percent) return
      target.removeEventListener('scroll', onScroll)
      open()
    }
    target.addEventListener('scroll', onScroll, { passive: true })
    return onScroll()
  }
  if (reward.trigger === 'click' && reward.click_selector) {
    const selector = reward.click_selector
    /** Abre quando o clique cai no seletor, sem deixar o link seguir. */
    const onClick = (event: Event): void => {
      const clicked = event.target instanceof Element ? event.target.closest(selector) : null
      if (!clicked) return
      event.preventDefault()
      target.document.removeEventListener('click', onClick, true)
      open()
    }
    try {
      target.document.querySelector(selector)
    } catch {
      return
    }
    target.document.addEventListener('click', onClick, true)
    return
  }
  open()
}

/** Busca o reward da página e arma o gatilho; sem reward, sem anúncio ou no intervalo, não faz nada. */
export async function startReward(origin: string, target: Window = window): Promise<RewardWidget | null> {
  try {
    const response = await target.fetch(`${origin}/api/reward/v2?url=${encodeURIComponent(target.location.href)}`)
    if (!response.ok) return null
    const { reward, price_rules: rules } = (await response.json()) as PublicRewardPage
    const ports = browserPorts(origin, target, rewardCascade(rules ?? null, () => visitorId(target)))
    if (!reward || deviceAdUnits(reward, target.innerWidth).length === 0 || coolingDown(reward, ports)) return null
    const widget = new RewardWidget(reward, ports, target)
    armTrigger(reward, () => widget.open(), target)
    return widget
  } catch {
    return null
  }
}
