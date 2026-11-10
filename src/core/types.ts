/**
 * Formatos da API pública da tag, iguais aos de avant-api `modules/ad_tag_public/dto.py`.
 */

export type BlockKind = 'anchor' | 'interstitial' | 'fixed' | 'content'
export type Edge = 'top' | 'bottom'
export type Side = 'before' | 'after'
export type RuleMode = 'all' | 'include' | 'exclude'
export type LoaderTemplate = 'groone' | 'solid'
export type LoaderStyle = 'bar' | 'spinner' | 'dots'
export type LoaderAdblock = 'off' | 'warn' | 'block'
export type Device = 'desktop' | 'mobile'

export interface PublicLoader {
  template: LoaderTemplate
  blur: number
  background: string
  accent: string
  style: LoaderStyle
  text: string | null
  max_seconds: number
  adblock: LoaderAdblock
}

export interface PublicBlock {
  kind: BlockKind
  unit_type: string
  desktop: string | null
  mobile: string | null
  edge: Edge | null
  selector: string | null
  side: Side | null
  refresh_seconds: number | null
  mgid_article: string | null
  rule_mode: RuleMode
  paths: string[]
}

export interface PublicMgid {
  tag_id: string | null
  smart_widget: string | null
  back_button: string | null
  sidebar: string | null
}

export interface PublicAdTag {
  key: string
  version: number
  domain: string
  lazy_load: boolean
  analytics_id: string | null
  mgid: PublicMgid
  reward: boolean
  price_rules: boolean
  loader: PublicLoader | null
  blocks: PublicBlock[]
}

export interface PublicTagResponse {
  tag: PublicAdTag | null
}
