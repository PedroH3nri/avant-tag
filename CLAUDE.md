# avant-tag

Script do Groone Avant que roda no site do cliente (`tag.js` e `reward.js`). Leia o README antes
de mudar algo.

- Regra de negócio fica no avant-core e na API. A tag só lê a configuração pública
  (`GET /api/tag/config`) e manda o que viu (`POST /api/tag/page-views`, reward).
- Formatos da API em `src/core/types.ts`, iguais aos `dto.py` do avant-api
  (`modules/ad_tag_public` e `modules/price_floor_public`).
- Um módulo por assunto em `src/<módulo>/` (core, loader, ads, page-views, price-rules, mgid, analytics,
  reward), com `index.ts` reexportando. Cada módulo recebe a janela e as saídas por parâmetro e
  tem teste com jsdom em `tests/<módulo>/`.
- A página do cliente nunca quebra: erro de um módulo fica nele, e o loader sempre sai. A tag e
  o reward rodam uma vez por página (`core/guard.ts`).
- O GAM é só leitura: a tag só monta slots.
- `tag.js` abaixo de 30 KB gzip (`pnpm size`). Nada de dependência em tempo de execução.
- Textos para o visitante no idioma do navegador. Comentários e mensagens do código em português.
- Clean code obrigatório (skill `avant-clean-code`): nomes claros, nada de nome de uma letra (nem
  em callback), toda função com um comentário de 1 ou 2 linhas sobre o que faz, nada de
  comentário ao lado do código. Conferido por `pnpm clean-code`.
- Antes de abrir PR: `pnpm lint && pnpm clean-code && pnpm typecheck && pnpm test && pnpm build && pnpm size`.
- Nada de segredos no repositório.
- PRs vão para `pre-develop`; a promoção para `develop` passa por revisão e CI (skill `avant-fluxo-de-trabalho`).

## Contexto, issues e skills

- Comece por `docs/contexto.md`: produto, decisões, estado dos repositórios e onde está cada coisa. Decisões antigas em `docs/decisoes/` (a desta tag é a 13).
- Todo trabalho parte de uma issue com milestone neste repositório (`gh issue list --milestone ...`). Pedido sem issue vira issue antes.
- Skills em `docs/skills/` (índice em `docs/skills/README.md`); `.claude/skills` aponta para lá. Comece pela `avant-fluxo-de-trabalho`.
- Grafo do código em `graphify-out/` (comece pelo `GRAPH_REPORT.md`, ou `graphify query "..."`). Mudou código: `graphify update .` e commite o grafo no mesmo PR.
