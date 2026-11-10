/**
 * O rótulo "Anúncio Patrocinado" em volta do bloco de conteúdo, nas línguas da g-tag.
 */

export const SPONSORED_LABELS: Record<string, string> = {
  pt: 'Anúncio Patrocinado',
  es: 'Anuncio Patrocinado',
  en: 'Sponsored Ad',
  fr: 'Annonce Sponsorisée',
  it: 'Annuncio Sponsorizzato',
  de: 'Gesponserte Anzeige',
  nl: 'Gesponsorde Advertentie',
  ru: 'Рекламное объявление',
  ja: 'スポンサー広告',
  zh: '赞助广告',
  ar: 'إعلان مدفوع',
  ko: '스폰서 광고',
  tr: 'Sponsorlu Reklam',
  pl: 'Reklama Sponsorowana',
  sv: 'Sponsrad Annons',
}

/** O rótulo na língua, ou em inglês. */
export function sponsoredLabel(language: string): string {
  return SPONSORED_LABELS[language] ?? (SPONSORED_LABELS.en as string)
}
