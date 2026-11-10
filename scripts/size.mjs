// Confere o tamanho do tag.js e do reward.js depois do build: a tag tem de ficar abaixo de 30 KB
// em gzip (decisão 13). Uso: `pnpm size`.
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const LIMITS = { 'dist/tag.js': 30 * 1024, 'dist/reward.js': 30 * 1024 }

/** O tamanho do arquivo em gzip, em bytes. */
function gzippedSize(path) {
  return gzipSync(readFileSync(path), { level: 9 }).length
}

let failed = false
for (const [path, limit] of Object.entries(LIMITS)) {
  const size = gzippedSize(path)
  const kilobytes = (size / 1024).toFixed(1)
  console.log(`${path}: ${kilobytes} KB gzip (limite ${limit / 1024} KB)`)
  if (size > limit) failed = true
}
process.exit(failed ? 1 : 0)
