/**
 * O reward no site: decide quando abrir, bloqueia a página com a janela, passa pelas etapas,
 * manda eventos e o contato para a API e mostra o anúncio premiado no fim.
 */

import type { AdOutcome } from './ads'
import { fontStylesheet } from './fonts'
import { renderReward } from './render'
import { rewardSteps, stepEventName } from './steps'
import { visitorLanguage } from './texts'
import type { PublicReward, RewardStep, VisitorLanguage } from './types'

const MOBILE_WIDTH = 768
const COOLDOWN_PREFIX = 'avant-reward:'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^[+()\d\s.-]{8,20}$/

export interface RewardEvent {
  reward_id: string
  kind: 'open' | 'step' | 'answer' | 'click' | 'complete' | 'close'
  step?: string
  question_id?: string
  answer?: number
}

export interface LeadBody {
  reward_id: string
  name: string
  contact: string
  language: string
  answers: { question_id: string; answer: number }[]
}

export interface WidgetPorts {
  sendEvents(events: RewardEvent[]): void
  sendLead(lead: LeadBody): Promise<boolean>
  showAd(paths: string[]): Promise<AdOutcome>
  now(): number
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
}

/** Os ad units do aparelho de quem visita: celular abaixo de 768 px de largura. */
export function deviceAdUnits(reward: PublicReward, width: number): string[] {
  return width < MOBILE_WIDTH ? reward.ad_units.mobile : reward.ad_units.desktop
}

/** Diz se o reward ainda está no intervalo desde a última vez que abriu neste navegador. */
export function coolingDown(reward: PublicReward, ports: Pick<WidgetPorts, 'now' | 'storage'>): boolean {
  try {
    const opened = Number(ports.storage?.getItem(COOLDOWN_PREFIX + reward.id) ?? '')
    return opened > 0 && ports.now() - opened < reward.cooldown_minutes * 60_000
  } catch {
    return false
  }
}

/** Confere nome e contato antes de mandar: nome com texto e e-mail ou telefone no formato. */
export function validLead(kind: 'email' | 'phone', name: string, contact: string): boolean {
  if (!name.trim() || name.length > 200 || contact.length > 300) return false
  return (kind === 'email' ? EMAIL : PHONE).test(contact.trim())
}

/** Uma janela aberta no site: guarda a etapa, as respostas e o que já foi mandado. */
export class RewardWidget {
  private readonly steps: RewardStep[]
  private position = 0
  private readonly answers = new Map<string, number>()
  private overlay: HTMLElement | null = null
  private root: ShadowRoot | null = null
  private invalidLead = false
  private busy = false

  /** Prepara a janela do reward com o idioma do navegador. */
  constructor(
    private readonly reward: PublicReward,
    private readonly ports: WidgetPorts,
    private readonly target: Window = window,
    private readonly language: VisitorLanguage = visitorLanguage(target.navigator.language),
  ) {
    this.steps = rewardSteps(reward)
  }

  /** Abre a janela por cima da página, guarda a hora para o intervalo e manda `open`. */
  open(): void {
    if (this.overlay) return
    const document = this.target.document
    const host = document.createElement('div')
    host.setAttribute('data-avant-reward', this.reward.id)
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;'
    this.root = host.attachShadow({ mode: 'open' })
    const font = document.createElement('link')
    font.rel = 'stylesheet'
    font.href = fontStylesheet(this.reward.style.font)
    document.head.append(font)
    this.overlay = host
    document.body.append(host)
    try {
      this.ports.storage?.setItem(COOLDOWN_PREFIX + this.reward.id, String(this.ports.now()))
    } catch {
      this.ports.storage = null
    }
    this.ports.sendEvents([{ reward_id: this.reward.id, kind: 'open' }])
    this.draw()
  }

  /** A etapa em que a janela está. */
  get step(): RewardStep {
    return this.steps[this.position] ?? { kind: 'reward' }
  }

  /** Desenha a etapa atual dentro do shadow DOM, por cima de um fundo escuro. */
  private draw(): void {
    if (!this.root) return
    const backdrop = this.target.document.createElement('div')
    backdrop.style.cssText =
      'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,0.6);'
    backdrop.append(
      renderReward(this.reward, {
        language: this.language,
        step: this.step,
        domain: this.target.location.hostname.replace(/^www\./, ''),
        invalidLead: this.invalidLead,
        busy: this.busy,
        onAnswer: (questionIndex, answerIndex) => this.answer(questionIndex, answerIndex),
        onLead: (name, contact) => void this.submitLead(name, contact),
        onUnlock: () => void this.unlock(),
        onClose: () => this.close(),
      }),
    )
    this.root.replaceChildren(backdrop)
  }

  /** Passa para a próxima etapa e manda `step` com o nome da que terminou. */
  private advance(): void {
    const name = stepEventName(this.step)
    if (name) this.ports.sendEvents([{ reward_id: this.reward.id, kind: 'step', step: name }])
    this.position += 1
    this.invalidLead = false
    this.draw()
  }

  /** Guarda a resposta da pergunta, manda `answer` e segue. */
  answer(questionIndex: number, answerIndex: number): void {
    const question = this.reward.questions[questionIndex]
    if (!question || this.step.kind !== 'question') return
    this.answers.set(question.id, answerIndex)
    this.ports.sendEvents([{ reward_id: this.reward.id, kind: 'answer', question_id: question.id, answer: answerIndex }])
    this.advance()
  }

  /** Confere e manda o contato com as respostas já dadas; com erro, mostra o aviso. */
  async submitLead(name: string, contact: string): Promise<void> {
    const lead = this.reward.lead
    if (!lead || this.busy || this.step.kind !== 'lead') return
    if (!validLead(lead.kind, name, contact)) {
      this.invalidLead = true
      return this.draw()
    }
    this.busy = true
    this.draw()
    const accepted = await this.ports.sendLead({
      reward_id: this.reward.id,
      name: name.trim(),
      contact: contact.trim(),
      language: this.language,
      answers: [...this.answers].map(([questionId, answer]) => ({ question_id: questionId, answer })),
    })
    this.busy = false
    this.invalidLead = !accepted
    if (accepted) this.advance()
    else this.draw()
  }

  /** Manda `click`, mostra o anúncio e, se a pessoa ganhou, manda `complete` e libera a página. */
  async unlock(): Promise<void> {
    if (this.busy || this.step.kind !== 'reward') return
    this.busy = true
    this.ports.sendEvents([{ reward_id: this.reward.id, kind: 'click' }])
    this.remove()
    const outcome = await this.ports.showAd(deviceAdUnits(this.reward, this.target.innerWidth))
    if (outcome === 'closed') {
      this.ports.sendEvents([{ reward_id: this.reward.id, kind: 'close' }])
      return
    }
    if (outcome === 'granted') this.ports.sendEvents([{ reward_id: this.reward.id, kind: 'complete' }])
    if (this.reward.redirect_url) this.target.location.assign(this.reward.redirect_url)
  }

  /** Fecha a janela pelo X e manda `close`. */
  close(): void {
    this.ports.sendEvents([{ reward_id: this.reward.id, kind: 'close' }])
    this.remove()
  }

  /** Tira a janela da página. */
  private remove(): void {
    this.overlay?.remove()
    this.overlay = null
    this.root = null
  }
}
