/**
 * O reward como a rota pública `GET /api/reward/v2` devolve (avant-api, modules/reward_public/dto.py).
 * A prévia do painel monta o mesmo formato a partir do formulário.
 */

export type RewardLayout = 'simple' | 'highlight' | 'header'
export type RewardTrigger = 'load' | 'scroll' | 'click'
export type RewardIconKind = 'emoji' | 'image' | 'none'
export type RewardLeadKind = 'email' | 'phone'
export type RewardLeadPosition = 'start' | 'end'
export type VisitorLanguage = 'pt' | 'en' | 'es'

export interface PublicRewardStyle {
  layout: RewardLayout
  body_color: string
  border_color: string
  title_color: string
  text_color: string
  button_color: string
  button_text_color: string
  border_width: number
  radius: number
  font: string
  shadow: boolean
}

export interface PublicRewardQuestion {
  id: string
  title: string
  description: string
  answers: string[]
}

export interface PublicRewardLead {
  kind: RewardLeadKind
  position: RewardLeadPosition
  title: string
  description: string
  button: string
}

export interface PublicReward {
  id: string
  title: string
  description: string
  button_text: string
  icon: { kind: RewardIconKind; emoji: string | null; url: string | null }
  style: PublicRewardStyle
  trigger: RewardTrigger
  scroll_percent: number | null
  click_selector: string | null
  cooldown_minutes: number
  redirect_url: string | null
  questions: PublicRewardQuestion[]
  lead: PublicRewardLead | null
  ad_units: { desktop: string[]; mobile: string[] }
}

export interface RewardPriceRules {
  control_percent: number
  cascades: Record<string, string[]>
}

export interface PublicRewardPage {
  reward: PublicReward | null
  price_rules: RewardPriceRules | null
}

export type RewardStep =
  | { kind: 'question'; index: number }
  | { kind: 'lead' }
  | { kind: 'reward' }
