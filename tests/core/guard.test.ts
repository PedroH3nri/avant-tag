import { describe, expect, it } from 'vitest'

import { claimPage } from '../../src/core/guard'

describe('claimPage', () => {
  it('deixa rodar só a primeira vez de cada parte', () => {
    const page = {} as Window
    expect(claimPage(page, 'tag')).toBe(true)
    expect(claimPage(page, 'tag')).toBe(false)
    expect(claimPage(page, 'reward')).toBe(true)
    expect(claimPage(page, 'reward')).toBe(false)
  })
})
