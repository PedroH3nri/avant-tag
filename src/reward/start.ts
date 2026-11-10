/**
 * O reward na página: busca o reward na API de onde o script veio e abre a janela no gatilho
 * escolhido (ao carregar, na rolagem ou no clique). Usado pelo tag.js e pelo reward.js.
 */

import { localStore } from '../core/config'
import { showRewardedAd } from './ads'
import type { PublicReward } from './types'
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
export function browserPorts(origin: string, target: Window = window): WidgetPorts {
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
    showAd: (paths) => showRewardedAd(paths, target),
    now: () => Date.now(),
    storage: localStore(target),
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
  const ports = browserPorts(origin, target)
  try {
    const response = await target.fetch(`${origin}/api/reward/v2?url=${encodeURIComponent(target.location.href)}`)
    if (!response.ok) return null
    const { reward } = (await response.json()) as { reward: PublicReward | null }
    if (!reward || deviceAdUnits(reward, target.innerWidth).length === 0 || coolingDown(reward, ports)) return null
    const widget = new RewardWidget(reward, ports, target)
    armTrigger(reward, () => widget.open(), target)
    return widget
  } catch {
    return null
  }
}
