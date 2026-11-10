import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicLoader } from '../../src/core/types'
import { adblockTexts, detectAdblock, renderLoader, siteIconUrl, siteName, startLoader } from '../../src/loader'

/** Um loader GroOne que bloqueia com adblock. */
function grooneLoader(changes: Partial<PublicLoader> = {}): PublicLoader {
  return {
    template: 'groone',
    blur: 2,
    background: '#080e16',
    accent: '#087ee5',
    style: 'spinner',
    text: null,
    max_seconds: 3,
    adblock: 'off',
    ...changes,
  }
}

/** Uma promessa que o teste resolve na hora que quiser. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/** Liga o loader com GPT pronto e o primeiro anúncio sob controle do teste. */
function start(config: PublicLoader, adblock = false) {
  const viewable = deferred()
  const run = startLoader(config, {
    target: window,
    domain: 'blog.com',
    language: 'pt',
    adblock: Promise.resolve(adblock),
    gptReady: Promise.resolve(),
    firstViewable: viewable.promise,
  })
  return { run, viewable }
}

/** Avança o relógio falso e deixa as promessas andarem. */
async function advance(milliseconds: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(milliseconds)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  document.documentElement.style.overflow = ''
})

describe('startLoader', () => {
  it('sai no primeiro anúncio visível, com fade, e devolve a rolagem', async () => {
    const { run, viewable } = start(grooneLoader())
    await advance(0)
    expect(document.querySelector('.avl-layer')).not.toBeNull()
    expect(document.documentElement.style.overflow).toBe('hidden')
    viewable.resolve()
    await advance(0)
    expect(document.querySelector('.avl-out')).not.toBeNull()
    await advance(400)
    await run.finished
    expect(document.querySelector('.avl-layer')).toBeNull()
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('sai no tempo máximo sem anúncio', async () => {
    const { run } = start(grooneLoader({ max_seconds: 2 }))
    await advance(1999)
    expect(document.querySelector('.avl-out')).toBeNull()
    await advance(401)
    await run.finished
    expect(document.querySelector('.avl-layer')).toBeNull()
  })

  it('erro do GPT não prende a página', async () => {
    const run = startLoader(grooneLoader({ max_seconds: 1 }), {
      target: window,
      domain: 'blog.com',
      language: 'pt',
      adblock: Promise.resolve(false),
      gptReady: Promise.reject(new Error('gpt')),
      firstViewable: Promise.reject(new Error('gpt')),
    })
    await advance(500)
    await run.finished
    expect(document.querySelector('.avl-layer')).toBeNull()
  })

  it('warn mostra o aviso e libera em continuar assim', async () => {
    const { run } = start(grooneLoader({ adblock: 'warn' }), true)
    await advance(0)
    const skip = document.querySelector<HTMLButtonElement>('.avl-skip')
    expect(document.querySelector('.avl-title')?.textContent).toBe('Apoie o conteúdo gratuito')
    skip?.click()
    await advance(400)
    await run.finished
    expect(document.querySelector('.avl-layer')).toBeNull()
  })

  it('block não libera sem recarregar', async () => {
    const { run, viewable } = start(grooneLoader({ adblock: 'block' }), true)
    viewable.resolve()
    await advance(10_000)
    expect(document.querySelector('.avl-skip')).toBeNull()
    expect(document.querySelector('.avl-card')).not.toBeNull()
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(await run.adblock).toBe(true)
  })
})

describe('renderLoader', () => {
  it('desenha o Tela cheia com a animação e o texto, na prévia', () => {
    const preview = document.createElement('div')
    document.body.append(preview)
    const layer = renderLoader(preview, grooneLoader({ template: 'solid', style: 'dots', text: 'Carregando…' }), {
      mode: 'loading',
      language: 'es',
      domain: 'receitas.com.br',
      iconUrl: null,
      inline: true,
    })
    expect(layer.classList.contains('avl-inline')).toBe(true)
    expect(layer.querySelectorAll('.avl-dots span')).toHaveLength(3)
    expect(layer.querySelector('.avl-name')?.textContent).toBe('receitas')
    expect(layer.querySelector('.avl-text')?.textContent).toBe('Carregando…')
    expect(document.querySelectorAll('#avant-loader-style')).toHaveLength(1)
  })
})

describe('idioma, ícone e adblock', () => {
  it('idioma desconhecido cai no inglês', () => {
    expect(adblockTexts('es').button).toBe('Ya lo desactivé, quiero continuar')
    expect(adblockTexts('xx').title).toBe('Support free content')
  })

  it('ícone pela ordem dos links', () => {
    document.head.innerHTML =
      '<link rel="apple-touch-icon" href="https://blog.com/apple.png"><link rel="icon" href="https://blog.com/icon.png">'
    expect(siteIconUrl(document)).toBe('https://blog.com/icon.png')
    document.head.innerHTML = ''
    expect(siteIconUrl(document)).toBeNull()
    expect(siteName('www.blog.com')).toBe('blog')
  })

  it('ppub_config que falha é bloqueador', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('bloqueado')))
    expect(await detectAdblock(window)).toBe(true)
    expect(sessionStorage.getItem('avant-has-adblock')).toBe('true')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    expect(await detectAdblock(window)).toBe(false)
    vi.unstubAllGlobals()
  })
})
