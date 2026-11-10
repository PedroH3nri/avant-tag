# avant-tag

O código que roda no site do cliente do Groone Avant (decisão 13, `docs/decisoes/13-ad-tag.md`).
Do mesmo código saem dois scripts:

- `tag.js`: a ad tag completa, com loader, visitas, anúncios do GAM, MGID, Google Analytics e o
  reward dentro.
- `reward.js`: só o reward, para quem não usa a ad tag. Fica no mesmo endereço de hoje.

Os outros repositórios do projeto são o avant-core, o avant-api, o avant-worker, o avant-web e o
avant-infra.

## Instalação no site

```html
<script async src="https://avant.groone.com/tag.js" data-tag="tg_xxxxxxxx"></script>
```

A chave (`data-tag`) é a da ad tag no painel. A API só entrega a configuração quando o domínio da
página é o do site da tag.

## Estrutura

TypeScript sem framework, em módulos. Cada um recebe a janela e as saídas por parâmetro, e os
testes rodam com jsdom.

```
src/
  tag.ts, reward.ts   entradas do tag.js e do reward.js
  core/               configuração, script, aparelho, idioma, beacon, regras de caminho, guarda
  loader/             loader e aviso de adblock (render usado também na prévia do painel)
  ads/                GPT, blocos no lugar, key-values, refresh
  page-views/         uma página vista, um envio para /api/tag/page-views
  mgid/, analytics/   integrações
  reward/             reward e quiz (veio do avant-web)
tests/                Vitest + jsdom
scripts/              clean-code.mjs, size.mjs
```

O avant-web instala este repositório por tag git, como a API instala o core. A partir daqui ele:

- monta o `tag.js` e o `reward.js` no `dist/` dele, que o nginx serve;
- usa o mesmo render na prévia da ad tag, do loader e do reward.

## Desenvolvimento

Node 26 e pnpm 10, como no avant-web:

```bash
pnpm install
pnpm lint && pnpm clean-code && pnpm typecheck && pnpm test && pnpm build && pnpm size
```

O `pnpm size` falha se o `tag.js` passar de 30 KB em gzip.

## Versões

O avant-web instala uma tag `vX.Y.Z`. Ela é criada pela Action `release.yml` quando o `version`
do `package.json` muda na `develop`.

Plano de implementação: `docs/superpowers/plans/2026-11-10-avant-tag.md`.
