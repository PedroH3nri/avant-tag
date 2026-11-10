import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const ENTRIES = { tag: 'AvantTag', reward: 'AvantReward' } as const
type Entry = keyof typeof ENTRIES

/** A entrada do build pela variável ENTRY (tag ou reward); a primeira limpa o dist/. */
function chosenEntry(value: string | undefined): Entry {
  return value === 'reward' ? 'reward' : 'tag'
}

const entry = chosenEntry(process.env.ENTRY)

// Um IIFE por script, sem hash no nome, para o nginx servir em /tag.js e /reward.js.
export default defineConfig({
  build: {
    emptyOutDir: entry === 'tag',
    copyPublicDir: false,
    target: 'es2019',
    lib: {
      entry: fileURLToPath(new URL(`./src/${entry}.ts`, import.meta.url)),
      name: ENTRIES[entry],
      formats: ['iife'],
      fileName: () => `${entry}.js`,
    },
  },
})
