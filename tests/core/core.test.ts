import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  blockAllowed,
  browserLanguage,
  cachedConfig,
  contentHash,
  detectDevice,
  findTagScript,
  pageHash,
  loadConfig,
  normalizeDomain,
  type PublicAdTag,
} from '../../src/core'

/** Uma configuração mínima do blog.com. */
function blogConfig(changes: Partial<PublicAdTag> = {}): PublicAdTag {
  return {
    key: 'tg_abcd1234',
    version: 3,
    domain: 'localhost',
    lazy_load: true,
    analytics_id: null,
    mgid: { tag_id: null, smart_widget: null, back_button: null, sidebar: null },
    reward: false,
    price_rules: false,
    loader: null,
    blocks: [],
    ...changes,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('findTagScript', () => {
  it('lê a chave e a origem do script com data-tag', () => {
    document.body.innerHTML = '<script data-tag="tg_abcd1234" src="https://avant.groone.com/tag.js"></script>'
    expect(findTagScript(window)).toEqual({ key: 'tg_abcd1234', origin: 'https://avant.groone.com' })
  })

  it('ignora chave fora do formato', () => {
    document.body.innerHTML = '<script data-tag="qualquer" src="/tag.js"></script>'
    expect(findTagScript(window)).toBeNull()
  })
})

describe('loadConfig', () => {
  it('guarda a configuração da API e usa a cópia quando a API falha', async () => {
    const config = blogConfig()
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tag: config })))
    vi.stubGlobal('fetch', fetcher)
    expect(await loadConfig(window, 'https://avant.groone.com', config.key)).toEqual(config)
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/api/tag/config?key=tg_abcd1234&url=')
    fetcher.mockRejectedValue(new Error('rede'))
    expect(await loadConfig(window, 'https://avant.groone.com', config.key)).toEqual(config)
  })

  it('tag vazia apaga a cópia e outro domínio não roda', async () => {
    localStorage.setItem('avant:tag:tg_abcd1234', JSON.stringify(blogConfig()))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ tag: null }))))
    expect(await loadConfig(window, 'https://avant.groone.com', 'tg_abcd1234')).toBeNull()
    expect(localStorage.getItem('avant:tag:tg_abcd1234')).toBeNull()
    localStorage.setItem('avant:tag:tg_abcd1234', JSON.stringify(blogConfig({ domain: 'outro.com' })))
    expect(cachedConfig(window, 'tg_abcd1234')).toBeNull()
  })
})

describe('regras de caminho', () => {
  it('casa o curinga com o caminho inteiro', () => {
    expect(blockAllowed('/receitas/bolo', 'include', ['/receitas/*'])).toBe(true)
    expect(blockAllowed('/receita', 'include', ['/receitas/*'])).toBe(false)
    expect(blockAllowed('/receitas/bolo', 'exclude', ['receitas/*'])).toBe(false)
    expect(blockAllowed('/qualquer', 'all', ['/x'])).toBe(true)
    expect(blockAllowed('/sobre/', 'include', ['/sobre'])).toBe(true)
  })
})

describe('aparelho, idioma e domínio', () => {
  it('tablet conta como celular', () => {
    const tablet = {
      navigator: { userAgent: 'Mozilla/5.0 (Macintosh)', maxTouchPoints: 5 },
      innerWidth: 1024,
    } as unknown as Window
    expect(detectDevice(tablet)).toBe('mobile')
    const desktop = {
      navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0)', maxTouchPoints: 0 },
      innerWidth: 1920,
      matchMedia: () => ({ matches: false }),
    } as unknown as Window
    expect(detectDevice(desktop)).toBe('desktop')
  })

  it('pt-BR vira pt e idioma desconhecido cai no padrão', () => {
    const page = { navigator: { languages: ['pt-BR', 'en'], language: 'pt-BR' } } as unknown as Window
    expect(browserLanguage(page, ['en', 'pt', 'es'], 'en')).toBe('pt')
    const other = { navigator: { languages: ['xx'], language: 'xx' } } as unknown as Window
    expect(browserLanguage(other, ['en', 'pt'], 'en')).toBe('en')
  })

  it('domínio sem www e hash estável', () => {
    expect(normalizeDomain('WWW.Blog.com')).toBe('blog.com')
    expect(pageHash('')).toBe('811c9dc59e3779b9')
    expect(contentHash('WWW.Blog.com', '/Receitas/')).toBe(pageHash('blog.com/receitas'))
  })
})
