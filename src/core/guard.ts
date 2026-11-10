/**
 * Guarda de uma vez por página: a tag e o reward marcam a janela e quem chega depois desiste.
 */

export type PagePart = 'tag' | 'reward'

const FLAGS: Record<PagePart, '__avantTag' | '__avantReward'> = {
  tag: '__avantTag',
  reward: '__avantReward',
}

type FlaggedWindow = Window & { __avantTag?: boolean; __avantReward?: boolean }

/** Marca a parte na página e diz se é a primeira vez; `false` quer dizer que outro já rodou. */
export function claimPage(target: Window, part: PagePart): boolean {
  const flagged = target as FlaggedWindow
  const flag = FLAGS[part]
  if (flagged[flag]) return false
  flagged[flag] = true
  return true
}
