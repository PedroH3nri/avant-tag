/**
 * O aparelho para os blocos: celular quando a tela é de toque e estreita ou o user agent diz;
 * tablet conta como celular (a g-tag punha tablet Android no computador).
 */

import type { Device } from './types'

const MOBILE_AGENT = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i
const TABLET_WIDTH = 1366

/** `mobile` ou `desktop` para a janela. */
export function detectDevice(target: Window): Device {
  const agent = target.navigator.userAgent
  const coarse = target.matchMedia?.('(pointer: coarse)').matches ?? false
  const narrow = target.innerWidth <= TABLET_WIDTH
  const touchMac = /Macintosh/.test(agent) && target.navigator.maxTouchPoints > 1
  return MOBILE_AGENT.test(agent) || touchMac || (coarse && narrow) ? 'mobile' : 'desktop'
}
