import { afterEach, describe, expect, it, vi } from 'vitest'
import { showRewardedAd } from '../../src/reward/ads'
import { apiOrigin, armTrigger } from '../../src/reward/start'
import { renderReward } from '../../src/reward/render'
import { rewardSteps, stepEventName } from '../../src/reward/steps'
import { visitorLanguage } from '../../src/reward/texts'
import type { PublicReward } from '../../src/reward/types'
import { coolingDown, deviceAdUnits, RewardWidget, validLead, type WidgetPorts } from '../../src/reward/widget'

/** Um reward com duas perguntas e contato no fim. */
function sampleReward(changes: Partial<PublicReward> = {}): PublicReward {
  return {
    id: 'r1',
    title: 'Ganhe acesso',
    description: 'Veja um anúncio',
    button_text: 'Liberar',
    icon: { kind: 'emoji', emoji: '🎁', url: null },
    style: {
      layout: 'simple',
      body_color: '#0a213d',
      border_color: '#1e3a5f',
      title_color: '#ffffff',
      text_color: '#c7d2e0',
      button_color: '#1976d2',
      button_text_color: '#ffffff',
      border_width: 1,
      radius: 24,
      font: 'Geist',
      shadow: true,
    },
    trigger: 'load',
    scroll_percent: null,
    click_selector: null,
    cooldown_minutes: 30,
    redirect_url: null,
    questions: [
      { id: 'q1', title: 'Primeira?', description: '', answers: ['A', 'B', 'C'] },
      { id: 'q2', title: 'Segunda?', description: '', answers: ['D', 'E', 'F'] },
    ],
    lead: { kind: 'email', position: 'end', title: 'Seu contato', description: '', button: 'Continuar' },
    ad_units: { desktop: ['/1/desk'], mobile: ['/1/mob'] },
    ...changes,
  }
}

/** Saídas falsas que guardam os eventos e o contato. */
function fakePorts(leadAccepted = true): WidgetPorts & { events: unknown[]; leads: unknown[]; ads: string[][] } {
  const memory = new Map<string, string>()
  const ports = {
    events: [] as unknown[],
    leads: [] as unknown[],
    ads: [] as string[][],
    sendEvents: (events: unknown[]) => void ports.events.push(...events),
    sendLead: async (lead: unknown) => {
      ports.leads.push(lead)
      return leadAccepted
    },
    showAd: async (paths: string[]) => {
      ports.ads.push(paths)
      return 'granted' as const
    },
    now: () => 9_000_000_000,
    storage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value) },
  }
  return ports
}

/** O shadow root da janela aberta na página. */
function shadow(): ShadowRoot {
  const host = document.querySelector('[data-avant-reward]')
  if (!host?.shadowRoot) throw new Error('janela fechada')
  return host.shadowRoot
}

afterEach(() => {
  document.body.replaceChildren()
  document.head.replaceChildren()
  vi.useRealTimers()
})

describe('etapas', () => {
  it('põe o contato antes ou depois das perguntas e o anúncio no fim', () => {
    const reward = sampleReward()
    expect(rewardSteps(reward)).toEqual([{ kind: 'question', index: 0 }, { kind: 'question', index: 1 }, { kind: 'lead' }, { kind: 'reward' }])
    const start = rewardSteps({ ...reward, lead: { ...reward.lead!, position: 'start' } })
    expect(start[0]).toEqual({ kind: 'lead' })
    expect(rewardSteps({ questions: [], lead: null })).toEqual([{ kind: 'reward' }])
    expect(stepEventName({ kind: 'question', index: 1 })).toBe('question_2')
    expect(stepEventName({ kind: 'reward' })).toBeNull()
  })

  it('escolhe o idioma do visitante', () => {
    expect(visitorLanguage('pt-BR')).toBe('pt')
    expect(visitorLanguage('es-MX')).toBe('es')
    expect(visitorLanguage('fr')).toBe('en')
    expect(visitorLanguage(undefined)).toBe('en')
  })
})

describe('render', () => {
  it('escreve os textos sem interpretar HTML', () => {
    const reward = sampleReward({ title: '<img src=x onerror=alert(1)>' })
    const box = renderReward(reward, { language: 'pt', step: { kind: 'reward' }, domain: 'site.com' })
    expect(box.querySelector('img[src=x]')).toBeNull()
    expect(box.querySelector('h2')?.textContent).toBe('<img src=x onerror=alert(1)>')
    expect(box.textContent).toContain('Oferta patrocinada')
  })

  it('mostra o progresso e as três respostas da pergunta', () => {
    const answers: number[] = []
    const box = renderReward(sampleReward(), {
      language: 'en',
      step: { kind: 'question', index: 1 },
      domain: 'site.com',
      onAnswer: (_question, answer) => answers.push(answer),
    })
    expect(box.textContent).toContain('Question 2 of 2')
    const buttons = [...box.querySelectorAll('button')].filter((button) => button.textContent === 'E')
    buttons[0]?.click()
    expect(answers).toEqual([1])
  })

  it('desenha os três layouts com o botão de fechar', () => {
    for (const layout of ['simple', 'highlight', 'header'] as const) {
      const reward = sampleReward()
      reward.style.layout = layout
      const box = renderReward(reward, { language: 'es', step: { kind: 'reward' }, domain: 'site.com' })
      expect(box.querySelector('button[aria-label="Cerrar"]')).not.toBeNull()
      expect(box.getAttribute('role')).toBe('dialog')
    }
  })

  it('mostra o aviso de consentimento com o domínio no contato', () => {
    const box = renderReward(sampleReward(), { language: 'pt', step: { kind: 'lead' }, domain: 'site.com', invalidLead: true })
    expect(box.textContent).toContain('receber contato de site.com')
    expect(box.querySelector('[role=alert]')).not.toBeNull()
    expect(box.querySelector('input[type=email]')).not.toBeNull()
  })
})

describe('regras do script', () => {
  it('escolhe os ad units pelo aparelho', () => {
    expect(deviceAdUnits(sampleReward(), 500)).toEqual(['/1/mob'])
    expect(deviceAdUnits(sampleReward(), 1200)).toEqual(['/1/desk'])
  })

  it('respeita o intervalo desde a última abertura', () => {
    const ports = fakePorts()
    const reward = sampleReward()
    expect(coolingDown(reward, ports)).toBe(false)
    ports.storage?.setItem('avant-reward:r1', String(9_000_000_000 - 29 * 60_000))
    expect(coolingDown(reward, ports)).toBe(true)
    ports.storage?.setItem('avant-reward:r1', String(9_000_000_000 - 31 * 60_000))
    expect(coolingDown(reward, ports)).toBe(false)
  })

  it('confere e-mail e telefone do contato', () => {
    expect(validLead('email', 'Ana', 'ana@site.com')).toBe(true)
    expect(validLead('email', ' ', 'ana@site.com')).toBe(false)
    expect(validLead('email', 'Ana', 'ana')).toBe(false)
    expect(validLead('phone', 'Ana', '+55 11 91234-5678')).toBe(true)
    expect(validLead('phone', 'Ana', 'abc')).toBe(false)
  })

  it('tira a origem da API do endereço do script', () => {
    expect(apiOrigin('https://avant.groone.com/reward.js', 'https://site.com')).toBe('https://avant.groone.com')
    expect(apiOrigin(undefined, 'https://site.com')).toBe('https://site.com')
  })
})

describe('janela no site', () => {
  it('passa pelas perguntas e pelo contato e manda os eventos e as respostas', async () => {
    const ports = fakePorts()
    const widget = new RewardWidget(sampleReward(), ports, window, 'pt')
    widget.open()
    expect(shadow().querySelector('h2')?.textContent).toBe('Primeira?')
    widget.answer(0, 2)
    widget.answer(1, 0)
    expect(widget.step).toEqual({ kind: 'lead' })
    await widget.submitLead('Ana', 'ana@site.com')
    expect(ports.leads).toEqual([
      {
        reward_id: 'r1',
        name: 'Ana',
        contact: 'ana@site.com',
        language: 'pt',
        answers: [
          { question_id: 'q1', answer: 2 },
          { question_id: 'q2', answer: 0 },
        ],
      },
    ])
    await widget.unlock()
    expect(ports.ads).toEqual([['/1/desk']])
    expect(document.querySelector('[data-avant-reward]')).toBeNull()
    expect(ports.events.map((event) => (event as { kind: string; step?: string }).step ?? (event as { kind: string }).kind)).toEqual([
      'open',
      'answer',
      'question_1',
      'answer',
      'question_2',
      'lead',
      'click',
      'complete',
    ])
    expect(ports.storage?.getItem('avant-reward:r1')).toBe('9000000000')
  })

  it('fica no contato quando a API recusa ou o formato está errado', async () => {
    const ports = fakePorts(false)
    const widget = new RewardWidget(sampleReward({ questions: [] }), ports, window, 'pt')
    widget.open()
    await widget.submitLead('Ana', 'sem-arroba')
    expect(ports.leads).toHaveLength(0)
    expect(shadow().querySelector('[role=alert]')).not.toBeNull()
    await widget.submitLead('Ana', 'ana@site.com')
    expect(ports.leads).toHaveLength(1)
    expect(widget.step).toEqual({ kind: 'lead' })
  })

  it('fecha pelo X e manda close', () => {
    const ports = fakePorts()
    const widget = new RewardWidget(sampleReward(), ports, window, 'pt')
    widget.open()
    shadow().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.click()
    expect(document.querySelector('[data-avant-reward]')).toBeNull()
    expect(ports.events).toContainEqual({ reward_id: 'r1', kind: 'close' })
  })
})

describe('gatilho', () => {
  it('abre no clique do seletor e só uma vez', () => {
    const open = vi.fn()
    document.body.innerHTML = '<a class="premio" href="/x"><span>abrir</span></a>'
    armTrigger(sampleReward({ trigger: 'click', click_selector: '.premio' }), open)
    expect(open).not.toHaveBeenCalled()
    document.querySelector('span')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    document.querySelector('span')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('ignora um seletor inválido e abre logo no carregamento', () => {
    const open = vi.fn()
    armTrigger(sampleReward({ trigger: 'click', click_selector: '[[' }), open)
    expect(open).not.toHaveBeenCalled()
    armTrigger(sampleReward(), open)
    expect(open).toHaveBeenCalledTimes(1)
  })
})

describe('anúncio premiado', () => {
  /** Um googletag falso que guarda os ouvintes e deixa o teste disparar os eventos. */
  function fakeGoogleTag() {
    const listeners = new Map<string, (event: object) => void>()
    const slots: object[] = []
    const googletag = {
      cmd: { push: (command: () => void) => command() },
      enums: { OutOfPageFormat: { REWARDED: 4 } },
      defineOutOfPageSlot: (path: string) => {
        const slot = { path, addService: () => slot }
        slots.push(slot)
        return slot
      },
      pubads: () => ({ addEventListener: (name: string, listener: (event: object) => void) => listeners.set(name, listener) }),
      enableServices: () => undefined,
      display: () => undefined,
      destroySlots: () => true,
    }
    ;(window as Window & { googletag?: unknown }).googletag = googletag
    return { listeners, slots }
  }

  it('sem ad unit responde unavailable sem carregar nada', async () => {
    expect(await showRewardedAd([])).toBe('unavailable')
  })

  it('tenta o próximo ad unit quando vem vazio e avisa o prêmio', async () => {
    const { listeners, slots } = fakeGoogleTag()
    const result = showRewardedAd(['/1/a', '/1/b'])
    listeners.get('slotRenderEnded')?.({ slot: slots[0], isEmpty: true })
    const visible = vi.fn()
    listeners.get('rewardedSlotReady')?.({ slot: slots[1], makeRewardedVisible: visible })
    listeners.get('rewardedSlotGranted')?.({ slot: slots[1] })
    listeners.get('rewardedSlotClosed')?.({ slot: slots[1] })
    expect(visible).toHaveBeenCalled()
    expect(await result).toBe('granted')
    delete (window as Window & { googletag?: unknown }).googletag
  })

  it('responde closed quando a pessoa fecha antes do prêmio', async () => {
    const { listeners, slots } = fakeGoogleTag()
    const result = showRewardedAd(['/1/a'])
    listeners.get('rewardedSlotClosed')?.({ slot: slots[0] })
    expect(await result).toBe('closed')
    delete (window as Window & { googletag?: unknown }).googletag
  })
})
