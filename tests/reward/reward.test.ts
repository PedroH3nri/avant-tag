import { afterEach, describe, expect, it, vi } from 'vitest'
import { showRewardedAd } from '../../src/reward/ads'
import { VISITOR_KEY } from '../../src/page-views'
import { REWARD_CASCADE_ENABLED, REWARD_REBID_ENABLED } from '../../src/ads/cascade'
import { apiOrigin, armTrigger, rewardCascade, startReward } from '../../src/reward/start'
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

type Listeners = Map<string, Array<(event: object) => void>>

/** Junta o ouvinte na lista do evento, como o GPT, que guarda todos e não troca o anterior. */
function listen(listeners: Listeners, name: string, listener: (event: object) => void): void {
  listeners.set(name, [...(listeners.get(name) ?? []), listener])
}

/** Tira o ouvinte da lista do evento, como o `removeEventListener` do GPT. */
function unlisten(listeners: Listeners, name: string, listener: (event: object) => void): void {
  listeners.set(name, (listeners.get(name) ?? []).filter((saved) => saved !== listener))
}

/** Dispara o evento para todos os ouvintes dele. */
function emitter(listeners: Listeners) {
  return {
    get: (name: string) => (event: object) => (listeners.get(name) ?? []).forEach((listener) => listener(event)),
    count: (name: string) => (listeners.get(name) ?? []).length,
  }
}

describe('anúncio premiado', () => {
  /** Um googletag falso que guarda os ouvintes e deixa o teste disparar os eventos. */
  function fakeGoogleTag() {
    const listeners: Listeners = new Map()
    const slots: object[] = []
    const googletag = {
      cmd: { push: (command: () => void) => command() },
      enums: { OutOfPageFormat: { REWARDED: 4 } },
      defineOutOfPageSlot: (path: string) => {
        const slot = { path, addService: () => slot }
        slots.push(slot)
        return slot
      },
      pubads: () => ({ addEventListener: (name: string, listener: (event: object) => void) => listen(listeners, name, listener), removeEventListener: (name: string, listener: (event: object) => void) => unlisten(listeners, name, listener) }),
      enableServices: () => undefined,
      display: () => undefined,
      destroySlots: () => true,
    }
    ;(window as Window & { googletag?: unknown }).googletag = googletag
    return { listeners: emitter(listeners), slots }
  }

  it('sem ad unit responde unavailable sem carregar nada', async () => {
    expect(await showRewardedAd([])).toBe('unavailable')
  })

  it('tenta o próximo ad unit quando vem vazio e avisa o prêmio', async () => {
    const { listeners, slots } = fakeGoogleTag()
    const result = showRewardedAd(['/1/a', '/1/b'])
    listeners.get('slotRenderEnded')({ slot: slots[0], isEmpty: true })
    const visible = vi.fn()
    listeners.get('rewardedSlotReady')({ slot: slots[1], makeRewardedVisible: visible })
    listeners.get('rewardedSlotGranted')({ slot: slots[1] })
    listeners.get('rewardedSlotClosed')({ slot: slots[1] })
    expect(visible).toHaveBeenCalled()
    expect(await result).toBe('granted')
    delete (window as Window & { googletag?: unknown }).googletag
  })

  it('responde closed quando a pessoa fecha antes do prêmio', async () => {
    const { listeners, slots } = fakeGoogleTag()
    const result = showRewardedAd(['/1/a'])
    listeners.get('rewardedSlotClosed')({ slot: slots[0] })
    expect(await result).toBe('closed')
    delete (window as Window & { googletag?: unknown }).googletag
  })
})

describe('Cascata no anúncio premiado', () => {
  const PATH_A = '/1/blog.com/Blog_RewardsA_20261028'
  const PATH_B = '/1/blog.com/Blog_RewardsB_20261028'
  const LADDER = ['1.22', '1.13', '1.05']

  /** Um googletag falso com slot que junta o targeting por key, como o GPT: null apaga a key. */
  function cascadeGoogleTag() {
    const listeners: Listeners = new Map()
    type FakeSlot = { path: string; targeting: Record<string, string>; addService: () => FakeSlot; setConfig: (config: { targeting: Record<string, string | null> }) => void }
    const slots: FakeSlot[] = []
    const refresh = vi.fn()
    const destroySlots = vi.fn(() => true)
    const pageConfigs: Array<Record<string, unknown>> = []
    const slotFailure = { active: false }
    const defineOutOfPageSlot = vi.fn((path: string) => {
      const slot: FakeSlot = {
        path,
        targeting: {},
        addService: () => slot,
        setConfig: (config) => {
          if (slotFailure.active) throw new Error('setConfig falhou')
          for (const [key, value] of Object.entries(config.targeting)) {
            if (value === null) delete slot.targeting[key]
            else slot.targeting[key] = value
          }
        },
      }
      slots.push(slot)
      return slot
    })
    ;(window as Window & { googletag?: unknown }).googletag = {
      cmd: { push: (command: () => void) => command() },
      enums: { OutOfPageFormat: { REWARDED: 4 } },
      defineOutOfPageSlot,
      pubads: () => ({
        addEventListener: (name: string, listener: (event: object) => void) => listen(listeners, name, listener),
        removeEventListener: (name: string, listener: (event: object) => void) => unlisten(listeners, name, listener),
        refresh,
      }),
      setConfig: (config: Record<string, unknown>) => pageConfigs.push(config),
      enableServices: () => undefined,
      display: () => undefined,
      destroySlots,
    }
    /** Dispara o vazio do slot. */
    const empty = (slot: object) => emitter(listeners).get('slotRenderEnded')({ slot, isEmpty: true })
    return { listeners: emitter(listeners), slots, refresh, destroySlots, defineOutOfPageSlot, empty, pageConfigs, slotFailure }
  }

  const ladderOf = {
    group: 'regra',
    rebid: true,
    ladderOfPath: (path: string): string[] | null => (path === PATH_A ? LADDER : null),
  }

  afterEach(() => {
    vi.useRealTimers()
    delete (window as Window & { googletag?: unknown }).googletag
  })

  it('sem rebid (o padrão): 1º degrau com groone_try=1 e, vazio, segue para o próximo caminho', () => {
    const { slots, refresh, defineOutOfPageSlot, empty } = cascadeGoogleTag()
    void showRewardedAd([PATH_A, PATH_B], window, { ...ladderOf, rebid: false })
    expect(slots[0]?.targeting).toEqual({ groone_prices: '1.22', groone_try: '1' })
    empty(slots[0] as object)
    expect(refresh).not.toHaveBeenCalled()
    expect(defineOutOfPageSlot).toHaveBeenCalledTimes(2)
  })

  it('refaz o pedido do mesmo slot com o próximo degrau, sem definir outro', () => {
    const { slots, refresh, destroySlots, defineOutOfPageSlot, empty } = cascadeGoogleTag()
    void showRewardedAd([PATH_A, PATH_B], window, ladderOf)
    expect(slots[0]?.targeting).toEqual({ groone_prices: '1.22', groone_try: '1' })
    empty(slots[0] as object)
    expect(refresh).toHaveBeenCalledWith([slots[0]])
    expect(slots[0]?.targeting).toEqual({ groone_prices: '1.13', groone_try: '2' })
    expect(defineOutOfPageSlot).toHaveBeenCalledTimes(1)
    expect(destroySlots).not.toHaveBeenCalled()
  })

  it('manda a 4ª tentativa sem groone_prices e depois passa ao próximo caminho', () => {
    const { slots, refresh, destroySlots, defineOutOfPageSlot, empty } = cascadeGoogleTag()
    void showRewardedAd([PATH_A, PATH_B], window, ladderOf)
    empty(slots[0] as object)
    empty(slots[0] as object)
    empty(slots[0] as object)
    expect(slots[0]?.targeting).toEqual({ groone_try: '4' })
    expect(refresh).toHaveBeenCalledTimes(3)
    expect(defineOutOfPageSlot).toHaveBeenCalledTimes(1)
    empty(slots[0] as object)
    expect(destroySlots).toHaveBeenCalledWith([slots[0]])
    expect(defineOutOfPageSlot).toHaveBeenCalledTimes(2)
    expect(slots[1]?.path).toBe(PATH_B)
    expect(slots[1]?.targeting).toEqual({})
    expect(refresh).toHaveBeenCalledTimes(3)
  })

  it('depois de 3000 ms não pede de novo: o vazio da tentativa no ar passa ao próximo caminho', () => {
    vi.useFakeTimers()
    const { slots, refresh, defineOutOfPageSlot, empty } = cascadeGoogleTag()
    void showRewardedAd([PATH_A, PATH_B], window, ladderOf)
    empty(slots[0] as object)
    vi.advanceTimersByTime(3001)
    expect(defineOutOfPageSlot).toHaveBeenCalledTimes(1)
    empty(slots[0] as object)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(defineOutOfPageSlot).toHaveBeenCalledTimes(2)
  })

  it('o teto conta do 1º slotRequested, não da montagem', () => {
    vi.useFakeTimers()
    const { listeners, slots, refresh, empty } = cascadeGoogleTag()
    void showRewardedAd([PATH_A, PATH_B], window, ladderOf)
    vi.advanceTimersByTime(5000)
    listeners.get('slotRequested')({ slot: slots[0] })
    empty(slots[0] as object)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('o 1º anúncio tira os ouvintes dele ao terminar, e o 2º funciona sozinho', async () => {
    const { listeners, slots, empty, refresh } = cascadeGoogleTag()
    const first = showRewardedAd([PATH_A], window, ladderOf)
    listeners.get('rewardedSlotClosed')({ slot: slots[0] })
    expect(await first).toBe('closed')
    expect(listeners.count('slotRenderEnded')).toBe(0)
    const second = showRewardedAd([PATH_A], window, ladderOf)
    expect(listeners.count('slotRenderEnded')).toBe(1)
    empty(slots[1] as object)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith([slots[1]])
    listeners.get('rewardedSlotReady')({ slot: slots[1], makeRewardedVisible: vi.fn() })
    listeners.get('rewardedSlotGranted')({ slot: slots[1] })
    listeners.get('rewardedSlotClosed')({ slot: slots[1] })
    expect(await second).toBe('granted')
  })

  it('sem escada para o caminho, o vazio segue para o próximo como hoje', () => {
    const { slots, refresh, defineOutOfPageSlot, empty } = cascadeGoogleTag()
    void showRewardedAd([PATH_B, PATH_A], window, ladderOf)
    empty(slots[0] as object)
    expect(refresh).not.toHaveBeenCalled()
    expect(defineOutOfPageSlot).toHaveBeenCalledTimes(2)
    expect(slots[0]?.targeting).toEqual({})
  })

  it('entrega o prêmio depois de um rebid', async () => {
    const { listeners, slots, empty } = cascadeGoogleTag()
    const result = showRewardedAd([PATH_A], window, ladderOf)
    empty(slots[0] as object)
    listeners.get('rewardedSlotReady')({ slot: slots[0], makeRewardedVisible: vi.fn() })
    listeners.get('rewardedSlotGranted')({ slot: slots[0] })
    listeners.get('rewardedSlotClosed')({ slot: slots[0] })
    expect(await result).toBe('granted')
  })

  describe('rewardCascade', () => {
    const rules = { control_percent: 0, cascades: { RewardsA: LADDER } }

    it('a escada liga por padrão só com o 1º degrau: o rebid fica desligado (o GPT não refaz o pedido do REWARDED)', () => {
      expect(REWARD_CASCADE_ENABLED).toBe(true)
      expect(REWARD_REBID_ENABLED).toBe(false)
      expect(rewardCascade(rules, () => 'visitante')?.rebid).toBe(false)
    })

    it('com a flag desligada não monta escada, mesmo com regra', () => {
      expect(rewardCascade(rules, () => 'visitante', false)).toBeUndefined()
    })

    it('sem regra na resposta não monta escada', () => {
      expect(rewardCascade(null, () => 'visitante', true)).toBeUndefined()
    })

    it('o grupo de controle recebe o grupo e nenhuma escada', () => {
      const control = rewardCascade({ ...rules, control_percent: 100 }, () => 'visitante', true)
      expect(control?.group).toBe('controle')
      expect(control?.ladderOfPath(PATH_A)).toBeNull()
    })

    it('o grupo da regra recebe a escada do bloco do caminho', () => {
      const cascade = rewardCascade(rules, () => 'visitante', true)
      expect(cascade?.group).toBe('regra')
      expect(cascade?.ladderOfPath(PATH_A)).toEqual(LADDER)
      expect(cascade?.ladderOfPath(PATH_B)).toBeNull()
    })

    it('com a flag desligada não pergunta pelo visitante', () => {
      const visitor = vi.fn(() => 'visitante')
      rewardCascade(rules, visitor, false)
      rewardCascade(null, visitor, true)
      expect(visitor).not.toHaveBeenCalled()
    })
  })

  describe('groone_group e falhas', () => {
    it('com a escada ativa põe o groone_group da regra na página', () => {
      const { pageConfigs } = cascadeGoogleTag()
      void showRewardedAd([PATH_A], window, ladderOf)
      expect(pageConfigs).toEqual([{ targeting: { groone_group: 'regra' } }])
    })

    it('o controle leva groone_group controle, sem escada nem key de preço', () => {
      const { pageConfigs, slots, refresh, empty } = cascadeGoogleTag()
      void showRewardedAd([PATH_A, PATH_B], window, { group: 'controle', ladderOfPath: () => null })
      expect(pageConfigs).toEqual([{ targeting: { groone_group: 'controle' } }])
      expect(slots[0]?.targeting).toEqual({})
      empty(slots[0] as object)
      expect(refresh).not.toHaveBeenCalled()
    })

    it('sem cascata não mexe na página', () => {
      const { pageConfigs } = cascadeGoogleTag()
      void showRewardedAd([PATH_A], window)
      expect(pageConfigs).toEqual([])
    })

    it('se o setConfig da 1ª tentativa falha, segue sem escada naquele caminho', () => {
      const { slots, refresh, defineOutOfPageSlot, empty, slotFailure } = cascadeGoogleTag()
      slotFailure.active = true
      void showRewardedAd([PATH_A, PATH_B], window, ladderOf)
      empty(slots[0] as object)
      expect(refresh).not.toHaveBeenCalled()
      expect(defineOutOfPageSlot).toHaveBeenCalledTimes(2)
    })

    it('a tentativa no ar depois dos 3000 ms ainda pode entregar o prêmio', async () => {
      vi.useFakeTimers()
      const { listeners, slots, empty, refresh } = cascadeGoogleTag()
      const result = showRewardedAd([PATH_A], window, ladderOf)
      empty(slots[0] as object)
      vi.advanceTimersByTime(3001)
      const visible = vi.fn()
      listeners.get('rewardedSlotReady')({ slot: slots[0], makeRewardedVisible: visible })
      listeners.get('rewardedSlotGranted')({ slot: slots[0] })
      listeners.get('rewardedSlotClosed')({ slot: slots[0] })
      expect(visible).toHaveBeenCalled()
      expect(refresh).toHaveBeenCalledTimes(1)
      expect(await result).toBe('granted')
    })

    it('o READY_TIMEOUT_MS ainda responde unavailable com a escada ativa', async () => {
      vi.useFakeTimers()
      cascadeGoogleTag()
      const result = showRewardedAd([PATH_A], window, ladderOf)
      vi.advanceTimersByTime(10_001)
      expect(await result).toBe('unavailable')
    })
  })

  describe('startReward', () => {
    /** Roda o startReward com uma resposta falsa da API e devolve o que foi lido ou gravado. */
    async function runStart(priceRules: unknown) {
      window.localStorage.clear()
      const setItem = vi.spyOn(Storage.prototype, 'setItem')
      const reward = sampleReward({ ad_units: { desktop: [PATH_A], mobile: [PATH_A] } })
      const fetchFake = vi.fn(async () => ({ ok: true, json: async () => ({ reward, price_rules: priceRules }) }))
      const original = window.fetch
      window.fetch = fetchFake as unknown as typeof window.fetch
      const { pageConfigs, slots } = cascadeGoogleTag()
      const widget = await startReward('https://api.groone.com', window)
      window.fetch = original
      const stored = setItem.mock.calls.map((call) => call[0])
      setItem.mockRestore()
      return { widget, stored, pageConfigs, slots }
    }

    it('com a escada ligada grava o visitante e manda o reward com o 1º degrau, sem rebid', async () => {
      const { widget, stored } = await runStart({ control_percent: 0, cascades: { RewardsA: LADDER } })
      expect(widget).not.toBeNull()
      expect(stored).toContain(VISITOR_KEY)
    })

    it('sem price_rules também não grava o visitante', async () => {
      const { stored } = await runStart(null)
      expect(stored).not.toContain(VISITOR_KEY)
    })
  })
})
