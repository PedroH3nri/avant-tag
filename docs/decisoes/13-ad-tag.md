# 13. Ad tag

**Estado:** aprovado pelo Pedro em 10/11/2026 (protótipo em `avant-web/design/prototype`). Milestone
**M10 Ad tag** com issues nos seis repositórios; o script fica em `PedroH3nri/avant-tag`. Plano do
loader em `docs/superpowers/plans/2026-11-10-loader.md`.

Pedido do Pedro (09/11): "vamos pensar na integração da adtag, igual temos no genius, mas melhor".

## Como o Genius faz hoje

Lido em `iGroone/genius` (`AdTagController`, `AdTag`, migrations `*ad_tag*`, telas
`mcm/sites/publisher/ad_tags`).

- **Cadastro por site**, no painel do cliente e no interno (`/mcm/tags/{id_site}`), permissões
  `mcm.tags.*`. Um site pode ter **várias** tags; cada uma tem uma chave (`md5` do domínio,
  network e hora).
- **Instalação:** `<script id="groone" src="https://genius.groone.com/g-tag.min.js"
  data-key="{chave}">`. O fonte do `g-tag.min.js` fica no repositório `iGroone/G-Tag` (TypeScript,
  webpack, 106 KB minificado), resumido na seção seguinte.
- **Configuração** numa linha só da tabela `ad_tags`, com colunas repetidas: âncora (em cima ou
  embaixo), intersticial, fixo (em cima ou embaixo, nunca no mesmo lado da âncora) e **Content1 a
  Content9**, cada um com seletor CSS, posição (antes ou depois do elemento) e refresh de 30 a 120
  segundos. Mais: lazy load, ordem de carregamento dos blocos (`ad_tag_priority_ads`), incluir ou
  excluir cada bloco por URL completa (`ad_tag_ads_config`), Google Analytics (ID), MGID (tag,
  smart widget, back button, sidebar e um artigo por Content), e chaves ligando reward, quiz,
  loader e price rule.
- **Seletor visual:** o servidor baixa a página do site, tira scripts e eventos e mostra num
  `iframe` com o `groone-picker.js`; o cliente clica no elemento e o seletor vai para o campo.
- **Entrega:** `GET /api/tag/{key}` lê `ad:tag:{key}` no Redis (ou monta do banco) e devolve o
  JSON com `config`, `integrations` e `ad_units`. Recusa domínio desativado.
- **Em volta:** a tag manda os key-values para `/api/admanager/keyvalue` (o Avant já recebe, api#231)
  e as visitas para o Data (`data.groone.com/api/analytics/pages`), de onde vem a tela Visitas do
  Avant. O price rule busca `GET /api/prices/{site}/{content_hash}` pelo país.

### O script `g-tag` (repositório `iGroone/G-Tag`)

Ordem do `bootstrap` em `src/index.ts`: lê a chave do `<script id="groone">`, busca
`/api/tag/{key}` (guarda no `localStorage` e usa a cópia se o servidor falhar), confere HTTPS,
tag ativa e domínio, e então:

1. **Loader** (opcional): tela cheia com o logo enquanto o GPT carrega; detecta adblock
   (`ppub_config`) e mostra um cartão pedindo para desligar.
2. **Visitas** (`pageViews`): um resumo por página vista com `visitor_id` (`localStorage`),
   `session_id` (10 min), aparelho, plataforma, navegador in-app, referrer, `id_post`,
   `content_hash`, tempo visível e invisível, rolagem máxima, último clique em link ou botão,
   adblock, blocos sem anúncio e blocos visíveis. Vai por `sendBeacon` para o Data
   (`/api/v2/analytics`) ao sair da página e a cada clique (no máximo 1 a cada 5 s).
3. **Ad manager:** carrega o GPT; `security` desiste se um overlay fixo cobre a tela; key-values
   (`id_post_wp` do `shortlink`, `land_uri`, `content_hash` FNV de domínio + caminho, UTMs) no
   `setConfig` e enviados para `/api/admanager/keyvalue`; lazy load; os blocos na ordem de
   prioridade, cada um com regra de URL, slot `/{network}/{domínio}/{Alias}_{Bloco}_{Aparelho}_{data}`
   (no M.I. `22893970961,{network}`), floor do price rule no targeting `groone_prices`, divisórias
   "Anúncio Patrocinado" no idioma do navegador, refresh só com 50% do bloco visível e a aba
   aberta (máximo 5), artigo MGID quando o bloco fica vazio; MGID (tag, smart widget, back
   button, sidebar).
4. **Google Analytics** (gtag com o ID).
5. **Reward e quiz**, se não houver offerwall do Google (espera 2,5 s pelo `.fc-monetization-dialog`).

Defeitos vistos no código: o price rule busca `/api/prices/{site}/885` (o hash está fixo no
código); aparelho pelo texto `mobile` do user agent (tablet Android cai em desktop); a chave
de visitas pode duplicar o envio em clique mais saída; `await` no topo do módulo; 106 KB.

### O que dá para fazer melhor

1. **Data dos blocos congelada.** `date_blocks` é gravada ao salvar; blocos novos criados no GAM
   só valem quando alguém salva a tag de novo. No Avant a data sai na hora da entrega, como no
   reward (o mais recente, ou uma data fixada).
2. **Cache furado.** Criar não grava o cache e apagar não limpa: uma tag apagada continua sendo
   entregue pelo Redis. Pausar (`active`) não existe na tela.
3. **Várias tags por site** sem dizer qual está no ar. No Avant o site continua podendo ter
   várias (Pedro, 09/11), cada uma com nome, chave e situação na lista (no ar, versão, última vez
   vista).
4. **Sem histórico.** Salvar já publica, e a versão só conta. No Avant: rascunho, publicar,
   histórico com quem publicou e voltar para uma versão.
5. **Nove colunas por bloco de conteúdo.** No Avant os blocos viram linhas (`placements`), com o
   aparelho de cada um (os blocos GTag já são por Desktop e Mobile).
6. **Regras por URL completa** (`https://dominio/...`). No Avant: caminho com curinga
   (`/receitas/*`), que não quebra com `www`, parâmetros ou `http`.
7. **Prévia com risco de SSRF:** a URL só precisa conter o domínio. No Avant a página é baixada
   pelo `HttpPageFetcher` do worker, que só conecta em IP público (core#190).
8. **Ninguém sabe se a tag está no ar.** No Avant a tag avisa (amostra) que rodou: versão vista,
   última vez vista, blocos preenchidos ou vazios. Vira item automático do checklist e alerta.
9. **Chave no HTML sem conferir o domínio.** No Avant a linha leva a chave da tag
   (`data-tag`), porque um site pode ter várias, e a API só entrega a configuração quando o
   domínio da página é o do site da tag: copiar a linha para outro domínio não entrega nada.

## Proposta

### Modelo (avant-core, domínio novo `ad_tags/`)

| Tabela | Campos principais |
|---|---|
| `ad_tags` | `site_id`, `name` (único no site), `key` (única, `tg_` + 8 caracteres), `active`, `ad_unit_day` (nulo = mais recentes), `lazy_load`, `label` (texto acima do anúncio), integrações (`analytics_id`, `loader_id` (nulo = sem loader), MGID: `mgid_tag_id`, smart widget, back button e sidebar), `reward` e `price_rules` (ligado ou desligado), `draft` (JSON do rascunho), `published_version_id`, `updated_at` |
| `ad_tag_versions` | `ad_tag_id`, `number`, `config` (JSON imutável do que foi publicado), `published_by`, `published_at` |
| `metrics.ad_tag_daily` | `ad_tag_id`, `day`, `version`, `placement`, `device`, `pageviews`, `rendered`, `empty`, `last_seen_at` |

O `config` de uma versão leva a lista de blocos: tipo (âncora, intersticial, fixo, conteúdo 1 a 9),
aparelhos, posição, seletor e lado (antes ou depois), refresh (30 a 120 s ou desligado), artigo
MGID para quando o bloco fica vazio, ordem de carregamento e regras de caminho (incluir ou
excluir). Validação no domínio: fixo e âncora em lados
diferentes, um tipo por bloco, seletor não vazio no conteúdo.

**Permissões:** `ad_tags.view`, `ad_tags.manage` no cliente; `internal.ad_tags.view`,
`internal.ad_tags.manage` na equipe Groone. Publicar e voltar versão gravam auditoria.

### Rotas (avant-api)

- Painel: `GET|POST /api/v1/ad-tags` (lista por site e criação), `GET|PATCH /api/v1/ad-tags/{id}`
  (nome e rascunho), `POST .../publish`, `GET .../versions`,
  `POST .../versions/{n}/restore`, `POST .../pause|resume`, `GET .../health`, `GET .../preview?path=`
  (HTML limpo para o seletor). No interno, as mesmas em `/api/v1/internal/...`.
- Pública: `GET /api/tag/config?key=&url=` com CORS (só entrega se o domínio da URL for o do site
  da tag), cache no Redis (`avant:tag:{chave}`) apagado ao
  publicar, pausar e quando a importação traz blocos novos; `POST /api/tag/events` (amostra, por
  `sendBeacon`, buffer no Redis como o reward).

### Worker (avant-worker)

- `flush_ad_tag_events` a cada minuto (soma em `metrics.ad_tag_daily`).
- Depois de `import_inventory`: limpa o cache das tags do site que usam "mais recentes".
- Prévia: baixar a página pelo `HttpPageFetcher` (ou chamada síncrona na API com o mesmo
  transporte) e limpar scripts, `on*` e `meta refresh`.
- Checklist: item automático "Ad tag no ar" pela última vez vista.

### Script (avant-tag) e telas (avant-web)

- `avant-tag`: o `tag.js` com tudo o que o `g-tag` faz (loader e adblock, visitas, GPT, blocos,
  key-values, refresh, MGID, Analytics, reward com quiz), mais a amostra de saúde, corrigindo os
  defeitos listados. Aparelho por `matchMedia` e user agent (tablet conta como celular para os
  blocos). Meta: menos de 30 KB gzip. Ver "Onde fica o código do site".
- O módulo que posiciona os blocos é o mesmo da prévia do painel: o que o cliente vê é o que vai ao
  ar.
- Telas em `src/modules/ad_tags/` do `avant-web`: Inventário > Ad tags com as tags agrupadas por
  site (várias por site, criar com site e nome) e o editor
  (blocos à esquerda, site à direita com o seletor, alternando computador e celular), botão
  Publicar com o que mudou e histórico; métricas numa página própria, como as do reward.
  No interno, Inventário > Ad tags com a coluna Cliente.

### Infra (avant-infra)

- nginx: `/tag.js` com cache curto e `Access-Control-Allow-Origin: *`; `/api/tag/*` para a API.

## Ordem

Protótipo primeiro (`avant-web/design/prototype`), depois core → worker → api → avant-tag → web
→ infra, numa milestone nova **M10 Ad tag** nos seis repositórios, com issues por repositório como
na M9. O `avant-tag` começa com a base do repositório (README, CLAUDE.md, contexto, skills, CI
com lint, typecheck, testes e build, como os outros).

## Respostas do Pedro (09/11)

1. **Fonte:** `iGroone/G-Tag` (lido acima). A tag do Avant fica num repositório novo,
   `PedroH3nri/avant-tag`.
2. **Quem configura:** a equipe Groone ou o membro do cliente que tem acesso ao site (atribuição
   de sites).
3. **Integrações:** todas as do `g-tag` continuam (Analytics, MGID, loader com adblock, reward,
   quiz, key-values, visitas).
4. **Visitas vão para o Avant.** O Avant copia o recebimento do `analytics-v2` do Data (ver
   abaixo) e deixa de ler o Mongo do Data para as visitas desses sites.
5. **Reward dentro da tag**, como no `g-tag`: um script só no site.
6. **Não importar** as tags do Genius.
7. **Floor:** a tag já leva o lugar do floor por bloco (`groone_prices`), mas as regras de preço
   vêm depois da ad tag, num plano próprio.

## Visitas no Avant (cópia do `analytics-v2` do Data)

O Data hoje: `POST /api/v2/analytics` grava o resumo cru numa lista do Redis por domínio
(`pvs:raw:{domínio}`); a cada minuto um consumidor pega até 5.000 por domínio, acha o país pelo IP
(GeoLite2), guarda o resumo bruto (`page_views_v2`) e soma contadores por domínio, network, dia,
hora e país, e por UTM, `content_hash`, `id_post_wp` e `land_uri`; outro job grava os contadores
no Mongo (`page_views_v2_domains` e `page_views_v2_{chave}`).

No Avant:

- `POST /api/tag/page-views` (público, CORS, limite por IP, corpo pequeno) com o mesmo resumo,
  trocando `tag_key`, `id_client` e `network` pelo domínio (o Avant acha o site).
- Buffer no Redis e `avant.default.flush_page_views` a cada minuto: país pelo IP (GeoLite2 no
  worker, o IP não é gravado), soma em `metrics.page_views_hourly` (a tabela que a tela Visitas
  já usa) e nas quebras por key-value numa tabela nova `metrics.page_views_key_value_hourly`.
- O resumo bruto por página vista (tempo visível, rolagem, clique, adblock, blocos) fica numa
  tabela particionada por dia, `metrics.page_view_events`, **sem apagar nada** (Pedro, 09/11: os
  dados são importantes). O prazo de guarda (TTL) e a exportação dos dados antigos viram uma
  funcionalidade própria mais à frente, a mesma dos contatos do reward. A partição por dia é o que
  deixa essa limpeza barata depois.
- A leitura do Mongo do Data (worker#24) continua para os sites que ainda estão na tag do Genius.

## Onde fica o código do site

- **`avant-tag`** passa a ter todo o código que roda no site do cliente, **em módulos**
  (Pedro, 09/11): `core` (configuração, aparelho, idioma, envio por beacon), `ads` (GPT e blocos),
  `page-views`, `loader`, `mgid`, `analytics` e `reward` (o render que hoje está em
  `avant-web/src/embed/reward`, com o quiz). TypeScript, Vite, testes com Vitest e jsdom.
- **Dois scripts** saem do mesmo código:
  - `tag.js`: a tag completa, com o reward dentro, como no `g-tag`.
  - `reward.js`: só o reward, para o cliente que quer usar só ele. É o script que já existe
    hoje (mesmo endereço), agora gerado pelo `avant-tag`.
  Se um site tiver os dois instalados, o reward roda uma vez só (o `tag.js` marca a página e o
  `reward.js` desiste).
- O `avant-web` instala o `avant-tag` por tag git (como a API instala o core), usa o mesmo render na
  prévia do reward e da ad tag, e o build copia `tag.js` e `reward.js` para o `dist/`, que o nginx
  já serve.
- A tag fica: `<script async src="https://avant.groone.com/tag.js" data-tag="{chave}"></script>`.
  O `reward.js` sozinho continua sem chave (acha o reward pelo domínio e caminho).

## Ajustes do protótipo (Pedro, 09/11)

- **Várias tags por site**, como no Genius: cada uma com nome e chave própria; a lista agrupa por
  site e a linha de instalação é por tag. Uma página deve carregar uma tag só (a segunda desiste).
- **Métricas numa página própria**, como as do reward; o editor fica com Blocos, Integrações e
  Versões. A prévia do site fica parada e só os cartões dos blocos rolam.
- **Seletor de elemento** mostra o bloco no lugar enquanto o mouse passa (metade de cima entra
  antes, de baixo entra depois) e o clique fixa elemento e lado.
- **Integrações** com o logo do Google Analytics e da MGID; **reward** e **regras de preço** com
  escolha por rádio (ligado ou desligado em cada tag).
- **Adicionar bloco** lista só os blocos que existem no GAM na data escolhida (os mais recentes ou a
  fixada); bloco sem ad unit naquela data fica com aviso e impede publicar.
- **Loader vira recurso próprio** (Pedro, 10/11), como o reward: a Empresa monta os seus loaders em
  Inventário > Loaders (logo em texto, texto embaixo, cores de fundo e destaque, animação barra,
  círculo ou pontos, tempo máximo de 1 a 5 s, e adblock: não avisar, avisar ou bloquear) e cada ad tag escolhe um em Integrações (ou nenhum). Tabela `loaders` com
  `company_id` e RLS, `ad_tags.loader_id`; salvar um loader chega às tags que o usam sem publicar a
  tag de novo (limpa o cache delas). Apagar só sem tag usando. Permissões das ad tags valem para os
  loaders. No `avant-tag` é o módulo `loader`, que desenha o mesmo visual da prévia do painel.
- **Modelos de loader** (Pedro, 10/11): `GroOne`, copiado do loader da g-tag
  (`src/tag/loader`: véu translúcido com blur por cima da página, cartão de vidro com spin, ícone do
  site no canto e o cartão de adblock com ícone, título, texto, observação, botão e GROONE®), e
  `Tela cheia` (cor, animação barra, círculo ou pontos). Configuração: blur de 0 a 3 (0, 4, 8 e 14
  px), cores (véu e brilho do spin, ou fundo e destaque) e o ícone é sempre o do site (favicon lido
  da página, como faz a g-tag; sem ícone, o nome do site). Campos novos: `template` e `blur`; sai o logo em texto.
- **Textos do aviso de adblock fixos** (Pedro, 10/11): não são editáveis; saem no idioma do navegador
  do visitante, com as traduções da g-tag (`src/tag/loader/translator.ts`, 15 idiomas, inglês como
  padrão). Ficam no módulo `loader` do `avant-tag`, não no banco.

## Implementação da saúde e das visitas (core#310, 10/11)

- **Um envio só por página.** O `tag.js` manda um resumo por página vista
  (`POST /api/tag/page-views`), com a versão da tag e como cada bloco terminou. Desse resumo saem
  as visitas e a saúde da tag (`metrics.ad_tag_daily`), sem uma rota de eventos à parte.
- **Chave em vez de `id_client` e `network`.** O resumo leva a chave da tag (`data-tag`), e o
  domínio da URL tem de ser o do site da tag, como na configuração.
- **Uma vez só.** `metrics.page_view_events` tem chave (dia, `page_view_id`). Só a página que
  entra agora soma nas visitas por hora, nas key-values e na saúde, então repetir um lote não
  conta de novo.
- **Partições.** São diárias (`page_view_events_AAAAMMDD`) e o worker cria todo dia as de hoje e
  dos 7 dias seguintes pela função `metrics.create_page_view_partition`. A `_default` pega o que
  cair fora delas.
- **Convivência com o Mongo do Data.** A cópia do Mongo (worker#24) pula os sites em que a tag
  do Avant foi vista nos últimos 2 dias. Quem ainda está na tag do Genius continua vindo do Data.
  Nas horas em que as duas tags rodarem juntas no mesmo site, a visita pode contar em dobro.
