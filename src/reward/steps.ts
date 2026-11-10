/** As etapas da janela e o nome de cada uma nos eventos. */

import type { PublicReward, RewardStep } from './types'

/** As etapas na ordem: contato no começo, perguntas, contato no fim e o anúncio. */
export function rewardSteps(reward: Pick<PublicReward, 'questions' | 'lead'>): RewardStep[] {
  const questions: RewardStep[] = reward.questions.map((_question, index) => ({ kind: 'question', index }))
  const lead: RewardStep[] = reward.lead ? [{ kind: 'lead' }] : []
  const start = reward.lead?.position === 'start' ? lead : []
  const end = reward.lead?.position === 'end' ? lead : []
  return [...start, ...questions, ...end, { kind: 'reward' }]
}

/** O nome da etapa nos eventos (`question_1` a `question_5` ou `lead`); o anúncio não tem. */
export function stepEventName(step: RewardStep): string | null {
  if (step.kind === 'question') return `question_${step.index + 1}`
  return step.kind === 'lead' ? 'lead' : null
}
