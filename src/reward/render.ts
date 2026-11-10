/**
 * O desenho da janela do reward, em DOM puro e sem dependências: o reward.js mostra no site e o
 * painel usa na prévia, então o que o cliente vê é o que o visitante vê. Todo texto entra por
 * `textContent` (nunca HTML) e todo estilo é inline, para o CSS do site não mexer na janela.
 */

import { accentGradient, luminance, mix } from './colors'
import { fontStack } from './fonts'
import { VISITOR_TEXTS } from './texts'
import type { PublicReward, RewardStep, VisitorLanguage } from './types'

export interface RenderOptions {
  language: VisitorLanguage
  step: RewardStep
  domain: string
  onAnswer?: (questionIndex: number, answerIndex: number) => void
  onLead?: (name: string, contact: string) => void
  onUnlock?: () => void
  onClose?: () => void
  invalidLead?: boolean
  busy?: boolean
}

type Styles = Partial<Record<string, string>>

const PULSE_CSS =
  '@keyframes avant-reward-pulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.4);opacity:0}}' +
  '@media (prefers-reduced-motion:reduce){.avant-reward-pulse{animation:none!important}}'
const CLOSE_ICON = 'M18 6 6 18M6 6l12 12'

/** Cria um elemento com estilo inline e, se houver, o texto. */
function element(tag: string, styles: Styles = {}, text?: string): HTMLElement {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(styles)) {
    if (value !== undefined) node.style.setProperty(name, value)
  }
  if (text !== undefined) node.textContent = text
  return node
}

/** O ícone do reward (emoji, imagem ou nada) no tamanho pedido. */
function iconView(reward: PublicReward, size: number): HTMLElement | null {
  if (reward.icon.kind === 'emoji') {
    const emoji = element('div', { 'font-size': `${size}px`, 'line-height': '1' }, reward.icon.emoji || '🎁')
    emoji.setAttribute('aria-hidden', 'true')
    return emoji
  }
  if (reward.icon.kind !== 'image' || !reward.icon.url) return null
  const image = element('img', {
    display: 'block',
    margin: '0 auto',
    'max-height': `${size * 2.2}px`,
    'max-width': `${size * 2.6}px`,
    'object-fit': 'contain',
  }) as HTMLImageElement
  image.src = reward.icon.url
  image.alt = ''
  return image
}

/** O botão de fechar, com o desenho de cada layout. */
function closeButton(reward: PublicReward, options: RenderOptions, dark: boolean): HTMLElement {
  const layout = reward.style.layout
  const button = element('button', {
    position: 'absolute',
    'z-index': '1',
    top: layout === 'highlight' ? '16px' : '12px',
    right: layout === 'highlight' ? '16px' : '12px',
    padding: layout === 'highlight' ? '8px' : '6px',
    border: layout === 'header' ? '1px solid rgba(255,255,255,0.35)' : 'none',
    'border-radius': '999px',
    cursor: 'pointer',
    display: 'flex',
    background:
      layout === 'highlight' ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : layout === 'header' ? 'rgba(255,255,255,0.15)' : 'transparent',
    color: layout === 'header' ? '#ffffff' : layout === 'highlight' ? reward.style.title_color : reward.style.text_color,
  })
  button.setAttribute('type', 'button')
  button.setAttribute('aria-label', VISITOR_TEXTS[options.language].close)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', CLOSE_ICON)
  svg.append(path)
  button.append(svg)
  button.addEventListener('click', () => options.onClose?.())
  return button
}

/** O ícone no círculo que pulsa, do layout Destaque. */
function highlightIcon(reward: PublicReward, icon: HTMLElement): HTMLElement {
  const { button_color: button, body_color: body } = reward.style
  const wrap = element('div', { position: 'relative', margin: '0 auto 20px', width: '112px', height: '112px' })
  const style = element('style', {}, PULSE_CSS)
  wrap.append(style)
  for (const delay of ['0s', '1.5s']) {
    const ring = element('span', {
      position: 'absolute',
      inset: '0',
      'border-radius': '999px',
      background: mix(button, body, 0.35),
      animation: `avant-reward-pulse 3s ease-out ${delay} infinite`,
    })
    ring.className = 'avant-reward-pulse'
    ring.setAttribute('aria-hidden', 'true')
    wrap.append(ring)
  }
  const outer = element('div', {
    position: 'relative',
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '100%',
    height: '100%',
    padding: '8px',
    'box-sizing': 'border-box',
    'border-radius': '999px',
    background: mix(button, body, 0.22),
  })
  const inner = element('div', {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '100%',
    height: '100%',
    'border-radius': '999px',
    background: accentGradient(button),
  })
  inner.append(icon)
  outer.append(inner)
  wrap.append(outer)
  return wrap
}

/** Um campo de texto da etapa de contato. */
function leadInput(reward: PublicReward, type: string, label: string, placeholder: string): HTMLInputElement {
  const style = reward.style
  const input = element('input', {
    height: '44px',
    width: '100%',
    'box-sizing': 'border-box',
    padding: '0 16px',
    'font-size': '15px',
    'font-family': 'inherit',
    outline: 'none',
    border: `1px solid ${mix(style.text_color, style.body_color, 0.35)}`,
    background: 'transparent',
    color: style.title_color,
    'border-radius': `${Math.min(style.radius, 14)}px`,
  }) as HTMLInputElement
  input.type = type
  input.required = true
  input.placeholder = placeholder
  input.setAttribute('aria-label', label)
  return input
}

/** O botão principal (continuar ou liberar), com o fundo de cada layout. */
function mainButton(reward: PublicReward, text: string, big: boolean): HTMLElement {
  const style = reward.style
  const shadow =
    style.layout === 'highlight'
      ? `0 10px 28px -8px ${mix(style.button_color, style.body_color, 0.55)}`
      : style.layout === 'header'
        ? `0 8px 20px -8px ${style.button_color}`
        : 'none'
  return element(
    'button',
    {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      width: '100%',
      height: big ? '48px' : '44px',
      padding: '0 20px',
      border: 'none',
      cursor: 'pointer',
      'font-family': 'inherit',
      'font-size': '15px',
      'font-weight': '600',
      background: style.layout === 'header' ? accentGradient(style.button_color) : style.button_color,
      color: style.button_text_color,
      'border-radius': `${Math.min(style.radius, 14)}px`,
      'box-shadow': shadow,
    },
    text,
  )
}

/** As respostas da pergunta, uma por botão. */
function answersView(reward: PublicReward, options: RenderOptions, index: number): HTMLElement {
  const style = reward.style
  const list = element('div', { display: 'grid', gap: '8px', 'margin-top': '24px' })
  const question = reward.questions[index]
  question?.answers.forEach((answer, answerIndex) => {
    const button = element(
      'button',
      {
        height: '44px',
        width: '100%',
        padding: '0 16px',
        cursor: 'pointer',
        'font-family': 'inherit',
        'font-size': '15px',
        'font-weight': '500',
        border: `1.5px solid ${style.button_color}`,
        color: style.title_color,
        background: mix(style.button_color, style.body_color, 0.06),
        'border-radius': `${Math.min(style.radius, 14)}px`,
      },
      answer,
    )
    button.setAttribute('type', 'button')
    button.addEventListener('click', () => options.onAnswer?.(index, answerIndex))
    list.append(button)
  })
  return list
}

/** O formulário de contato: nome, e-mail ou telefone, botão e o aviso de consentimento. */
function leadForm(reward: PublicReward, options: RenderOptions): HTMLElement {
  const texts = VISITOR_TEXTS[options.language]
  const lead = reward.lead
  const form = element('form', { display: 'grid', gap: '12px', 'margin-top': '24px' })
  if (!lead) return form
  const name = leadInput(reward, 'text', texts.name, texts.name)
  name.autocomplete = 'name'
  const email = lead.kind === 'email'
  const contact = leadInput(
    reward,
    email ? 'email' : 'tel',
    email ? texts.email : texts.phone,
    email ? texts.emailPlaceholder : texts.phonePlaceholder,
  )
  contact.autocomplete = email ? 'email' : 'tel'
  const submit = mainButton(reward, lead.button, false)
  submit.setAttribute('type', 'submit')
  if (options.busy) submit.setAttribute('disabled', 'true')
  form.append(name, contact)
  if (options.invalidLead) {
    const error = element('p', { margin: '0', 'font-size': '13px', color: reward.style.title_color }, texts.invalid)
    error.setAttribute('role', 'alert')
    form.append(error)
  }
  const consent = element('p', { margin: '0', 'font-size': '12px', 'line-height': '1.4', opacity: '0.7' }, texts.consent(options.domain))
  consent.lang = options.language
  form.append(submit, consent)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    options.onLead?.(name.value, contact.value)
  })
  return form
}

/** Título e descrição da etapa: da pergunta, do contato ou do reward. */
function heading(reward: PublicReward, step: RewardStep): { title: string; description: string } {
  if (step.kind === 'question') {
    const question = reward.questions[step.index]
    return { title: question?.title ?? '', description: question?.description ?? '' }
  }
  if (step.kind === 'lead') return { title: reward.lead?.title ?? '', description: reward.lead?.description ?? '' }
  return { title: reward.title, description: reward.description }
}

/** Monta a janela do reward na etapa pedida, num dos três layouts. */
export function renderReward(reward: PublicReward, options: RenderOptions): HTMLElement {
  const style = reward.style
  const texts = VISITOR_TEXTS[options.language]
  const dark = luminance(style.body_color) < 0.4
  const framed = style.layout !== 'simple'
  const box = element('div', {
    position: 'relative',
    width: '100%',
    'max-width': '400px',
    'box-sizing': 'border-box',
    overflow: 'hidden',
    'text-align': 'center',
    padding: framed ? '0' : '36px 28px 20px',
    background: style.body_color,
    border: `${style.border_width}px solid ${style.border_color}`,
    'border-radius': `${style.radius}px`,
    'font-family': fontStack(style.font),
    'box-shadow': style.shadow ? '0 24px 64px -16px rgba(0,0,0,0.45)' : 'none',
    color: style.text_color,
  })
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', reward.title)
  box.append(closeButton(reward, options, dark))
  if (style.layout === 'header') {
    const band = element('div', {
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      height: '120px',
      background: accentGradient(style.button_color),
    })
    const icon = iconView(reward, 48)
    if (icon) band.append(icon)
    box.append(band)
  }
  const content = element('div', {
    padding: framed ? `${style.layout === 'highlight' ? '40px' : '24px'} 28px 24px` : '0',
  })
  const icon = style.layout === 'header' ? null : iconView(reward, style.layout === 'highlight' ? 46 : 52)
  if (icon && style.layout === 'simple') {
    const holder = element('div', { 'margin-bottom': '16px' })
    holder.append(icon)
    content.append(holder)
  }
  if (icon && style.layout === 'highlight') content.append(highlightIcon(reward, icon))
  const step = options.step
  if (step.kind === 'question') {
    const progress = texts.progress(step.index + 1, reward.questions.length)
    content.append(
      element(
        'p',
        { margin: '0 0 8px', 'font-size': '12px', 'font-weight': '600', 'text-transform': 'uppercase', 'letter-spacing': '0.04em', opacity: '0.7' },
        progress,
      ),
    )
  }
  const { title, description } = heading(reward, step)
  content.append(
    element('h2', { margin: '0', 'font-size': '22px', 'font-weight': '700', 'line-height': '1.2', 'overflow-wrap': 'anywhere', color: style.title_color }, title),
  )
  if (description) {
    content.append(element('p', { margin: '8px 0 0', 'font-size': '15px', 'line-height': '1.6', 'overflow-wrap': 'anywhere' }, description))
  }
  if (step.kind === 'question') content.append(answersView(reward, options, step.index))
  if (step.kind === 'lead') content.append(leadForm(reward, options))
  if (step.kind === 'reward') {
    const unlock = mainButton(reward, reward.button_text, style.layout === 'highlight')
    unlock.style.setProperty('margin-top', '24px')
    unlock.setAttribute('type', 'button')
    if (options.busy) unlock.setAttribute('disabled', 'true')
    unlock.addEventListener('click', () => options.onUnlock?.())
    content.append(unlock)
  }
  const footer = element(
    'p',
    framed
      ? {
          margin: '0',
          padding: '12px 0',
          'font-size': '12px',
          opacity: '0.8',
          background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          'border-top': `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)'}`,
        }
      : { margin: '16px 0 0', 'font-size': '12px', opacity: '0.7' },
    texts.footer,
  )
  footer.lang = options.language
  box.append(content)
  if (framed) box.append(footer)
  else content.append(footer)
  return box
}
