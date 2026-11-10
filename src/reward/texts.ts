/**
 * Textos fixos da janela no idioma do navegador de quem visita o site. Ficam aqui, e não em
 * src/lib/i18n.ts, porque o reward.js roda no site do cliente sem o painel.
 */

import type { VisitorLanguage } from './types'

export interface VisitorTexts {
  footer: string
  close: string
  name: string
  email: string
  phone: string
  emailPlaceholder: string
  phonePlaceholder: string
  progress: (current: number, total: number) => string
  consent: (domain: string) => string
  invalid: string
}

export const VISITOR_TEXTS: Record<VisitorLanguage, VisitorTexts> = {
  pt: {
    footer: 'Oferta patrocinada',
    close: 'Fechar',
    name: 'Seu nome',
    email: 'E-mail',
    phone: 'Telefone',
    emailPlaceholder: 'voce@email.com',
    phonePlaceholder: '(11) 91234-5678',
    progress: (current, total) => `Pergunta ${current} de ${total}`,
    consent: (domain) => `Ao continuar, você aceita receber contato de ${domain}.`,
    invalid: 'Confira os dados e tente de novo.',
  },
  en: {
    footer: 'Sponsored offer',
    close: 'Close',
    name: 'Your name',
    email: 'Email',
    phone: 'Phone',
    emailPlaceholder: 'you@email.com',
    phonePlaceholder: '+1 202 555 0100',
    progress: (current, total) => `Question ${current} of ${total}`,
    consent: (domain) => `By continuing, you agree to be contacted by ${domain}.`,
    invalid: 'Check your details and try again.',
  },
  es: {
    footer: 'Oferta patrocinada',
    close: 'Cerrar',
    name: 'Tu nombre',
    email: 'Correo',
    phone: 'Teléfono',
    emailPlaceholder: 'tu@correo.com',
    phonePlaceholder: '+34 612 34 56 78',
    progress: (current, total) => `Pregunta ${current} de ${total}`,
    consent: (domain) => `Al continuar, aceptas recibir contacto de ${domain}.`,
    invalid: 'Revisa los datos e inténtalo de nuevo.',
  },
}

/** O idioma da janela a partir do idioma do navegador: português, espanhol ou, no resto, inglês. */
export function visitorLanguage(browserLanguage: string | undefined): VisitorLanguage {
  const prefix = (browserLanguage ?? '').slice(0, 2).toLowerCase()
  return prefix === 'pt' || prefix === 'es' ? prefix : 'en'
}
