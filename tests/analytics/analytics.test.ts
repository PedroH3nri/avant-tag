import { describe, expect, it } from 'vitest'

import { startAnalytics } from '../../src/analytics'

describe('startAnalytics', () => {
  it('liga uma vez só e só com o ID', () => {
    expect(startAnalytics(window, null)).toBe(false)
    expect(startAnalytics(window, 'G-ABC123')).toBe(true)
    expect(startAnalytics(window, 'G-ABC123')).toBe(false)
    expect(document.querySelectorAll('script[src^="https://www.googletagmanager.com/gtag/js"]')).toHaveLength(1)
    expect((window as Window & { dataLayer?: unknown[] }).dataLayer).toHaveLength(2)
  })
})
