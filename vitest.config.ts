import { defineConfig } from 'vitest/config'

// Testes com jsdom: a tag mexe no DOM do site.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
