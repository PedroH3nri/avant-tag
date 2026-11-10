# 12. Rewards e quiz (plano)

**Estado:** plano de 09/11/2026, protótipo e respostas do Pedro no mesmo dia (seção do fim).

Pedido do Pedro (09/11): trazer o reward do Genius para o Avant, ligado a um site, visto e editado
pelo cliente e pela equipe Groone, com o corpo da janela personalizável e uma pré-visualização.
O protótipo está em `avant-web/design/prototype` (telas Rewards, Editar reward e Métricas, nos
dois painéis), PR avant-web#243.

## Decisões já tomadas com o Pedro

- **Reward e quiz são uma coisa só.** No Genius a tabela `quizzes` repete os campos de `rewards`
  e o quiz só acrescenta perguntas e o pedido de contato. No Avant o quiz é um reward com uma
  etapa "Antes do anúncio" opcional: até 5 perguntas com 3 respostas cada e, se quiser, o pedido
  de contato (nome mais e-mail ou telefone), antes ou depois das perguntas. As respostas não
  mudam o reward.
- **Um reward por página.** A página é um caminho no domínio do site (`receitas/bolo`). Um link
  colado perde o domínio.
- **Corpo personalizável.** Três layouts (Simples; Destaque, com o ícone num círculo que pulsa;
  Cabeçalho, com uma faixa reta em degradê), cores do corpo, título, texto, borda, botão e texto
  do botão (o círculo e o cabeçalho usam a cor do botão), cantos, espessura da borda, fonte (8
  opções do Google Fonts) e sombra. Quatro modelos de cor prontos.
- **Rodapé fixo.** "Oferta patrocinada" não se edita e aparece no idioma do navegador do
  visitante (português, inglês ou espanhol). O aviso de consentimento do pedido de contato segue
  a mesma regra.
- **Quando abre:** ao carregar a página, ao rolar uma porcentagem (5% a 100%) ou ao clicar num
  elemento (seletor CSS). Um só gatilho por reward.
- **Tempo para mostrar de novo** (`cooldown`): de 5 a 1.440 minutos, para a mesma pessoa.
- **Redirecionamento** ao terminar o anúncio: só para outra página do mesmo site, nunca a
  página do próprio reward.
- **Ad units:** os do site com "Rewards" no tipo, agrupados pela data do bloco. O padrão é usar
  sempre o grupo mais recente; o cliente pode fixar uma data. Cada grupo mostra se roda em
  Desktop, Mobile ou nos dois.
- **Métricas:** iguais para todo reward (janelas abertas, cliques no botão com CTR, anúncios
  concluídos, desistências, gráfico por dia e as etapas), mais as do quiz no padrão do Genius
  quando há perguntas (sessões, taxa de conclusão, taxa de desistência, CTR do reward, cliques e
  CTR por resposta) e a lista de contatos com busca, filtro por resposta e CSV.

## O que já existe e o reward usa

- **Data do bloco no nome.** As ferramentas do GAM (core#191, `gam/tools/services/formats.py`)
  criam os blocos como `{Alias}_{Tipo}_{AAAAMMDD}`, igual ao Genius; o tipo do reward é
  `Rewards` (Tag Light, vale para os dois aparelhos) ou `Rewards_Desktop` e `Rewards_Mobile`
  (GTag). A data e o aparelho saem do nome que já está em `ad_units.name`: não precisa de coluna
  nova. Depois de criar os blocos, a ferramenta já importa o inventário, e a importação geral
  roda a cada 6 horas (`avant.gam.schedule_imports`).
- **Rota pública para o site** (api#231/#233): `POST /api/admanager/keyvalue` recebe a g-tag no
  mesmo caminho do Genius, com CORS pela origem do pedido, limite por IP no Redis e buffer que o
  worker esvazia. O reward segue o mesmo desenho.
- **Imagem em Postgres:** a imagem da Empresa já fica no banco; o ícone do reward vai do mesmo
  jeito, servido por rota pública com cache.
- **Atribuição de sites:** um membro do cliente só vê os sites atribuídos a ele; vale também para
  os rewards.

## Modelo (avant-core, domínio novo `rewards/`)

Uma coisa por arquivo, como os outros domínios (`models/`, `enums/`, `errors/`, `tables/`,
`interfaces/`, `repositories/`, `services/`). Todas as tabelas têm `company_id` com RLS e política
na mesma migration.

| Tabela | Campos principais |
|---|---|
| `rewards` | `site_id`, `name`, `page_path` (único por site), `active`, ícone (`icon_kind` emoji/imagem/nenhum, `icon_emoji`, `icon_image`), textos (`title`, `description`, `button_text`), corpo (`layout`, `body_color`, `border_color`, `border_width`, `title_color`, `text_color`, `button_color`, `button_text_color`, `radius`, `font`, `shadow`), gatilho (`trigger`, `scroll_percent`, `click_selector`), `cooldown_minutes`, `ad_unit_day` (nulo = mais recentes), `redirect_path`, pedido de contato (`lead_kind`, `lead_position`, `lead_title`, `lead_description`, `lead_button`, nulos quando desligado), `deleted_at` |
| `reward_questions` | `reward_id`, `position` (1 a 5), `title`, `description`, `answers` (3 textos) |
| `reward_leads` | `reward_id`, `name`, `contact`, `kind`, `language`, `answers` (índice escolhido por pergunta), `created_at` |
| `metrics.reward_daily` | `reward_id`, `day`, `opens`, `clicks`, `completed`, `closed` |
| `metrics.reward_step_daily` | `reward_id`, `day`, `step` (pergunta N ou contato), `reached` |
| `metrics.reward_answer_daily` | `reward_id`, `day`, `question`, `answer`, `count` |

- Apagar um reward marca `deleted_at` (as métricas e os contatos continuam ligados a ele) e tira a
  página da lista, liberando o caminho para um reward novo.
- Validações no domínio: cores `#rrggbb`, faixas de cantos (0 a 32), borda (0 a 6), rolagem
  (5 a 100), `cooldown` (5 a 1.440), pergunta com título e as três respostas, redirecionamento
  diferente da página, data de ad units existente no site.
- **Permissões novas** (em `access/catalog.py` e numa migration): `rewards.view`,
  `rewards.manage`, `rewards.leads` (ver e exportar contatos, dado pessoal) no cliente;
  `internal.rewards.view`, `internal.rewards.manage`, `internal.rewards.leads` na equipe Groone.
  Entram nos papéis prontos: dono com todas; Gestor de tráfego com `view` e `manage`.
- **Casos de uso:** listar (paginado, 10 por página), criar, editar, pausar e ativar, apagar,
  trocar o ícone; grupos de ad units do site (data, aparelhos, nomes); montar a configuração
  pública de uma URL; gravar os contadores e os contatos que o worker traz; métricas do período e
  contatos paginados com filtro; exportar CSV.

## Rotas (avant-api)

**Painel** (`modules/rewards/`, Empresa da sessão, como em `sites`):

- `GET /api/v1/rewards`, `POST /api/v1/rewards`, `GET|PATCH|DELETE /api/v1/rewards/{id}`
- `PUT /api/v1/rewards/{id}/icon`
- `GET /api/v1/sites/{id}/reward-ad-units`: os grupos por data com os aparelhos
- `GET /api/v1/rewards/{id}/metrics?from=&to=`
- `GET /api/v1/rewards/{id}/leads` e `/leads/export` (`rewards.leads`)
- No painel interno, as mesmas operações em `/api/v1/internal/rewards`, listando todos os
  clientes, no padrão de `internal/inventory`.

**Públicas** (`modules/reward_public/`, sem sessão, CORS pela origem, limite por IP):

- `GET /api/reward/v2?url=`: a configuração da página. Fica no Redis
  (`avant:reward:{url}`), como o `ad:reward:{url}` do Genius, e só sai para reward ativo de site
  ativo. Leva textos, corpo, gatilho, `cooldown`, perguntas, pedido de contato, redirecionamento
  e os ad units separados em `desktop` e `mobile` (um bloco sem aparelho vale para os dois).
- `GET /api/reward/icon/{id}`: o ícone em imagem, com cache longo.
- `POST /api/reward/events`: lote de eventos do script (abriu, respondeu, deixou contato,
  clicou, concluiu, fechou), por `sendBeacon`, num buffer no Redis.
- `POST /api/reward/leads`: o contato, com o idioma e as respostas; e-mail ou telefone
  conferidos.

**Cache:** salvar, pausar ou apagar um reward apaga a chave da página. Quando a importação do
worker traz ad units de reward novos num site, ela apaga as chaves dos rewards desse site que
estão em "mais recentes"; o próximo visitante já recebe o bloco novo.

## Worker (avant-worker)

- `avant.default.flush_reward_events` a cada minuto: lê o buffer do Redis, soma por reward, dia,
  etapa e resposta e grava nas tabelas `metrics.reward_*`; grava os contatos. Idempotente pelo
  identificador do lote.
- Depois de `import_inventory`: se entrou ad unit de reward novo num site, apaga o cache dos
  rewards em "mais recentes" desse site.
- Os contatos não são apagados por enquanto: o prazo de guarda dos dados vira uma funcionalidade
  própria mais à frente.

## Script do site e telas (avant-web)

- **Um desenho só para a janela.** O render da janela (layouts, etapas, rodapé por idioma) fica
  num módulo TypeScript sem dependências em `src/embed/reward/`. A pré-visualização do painel e o
  script do site usam o mesmo módulo: o que o cliente vê na prévia é o que o visitante vê.
- **Script** `reward.js`, gerado pelo build num arquivo próprio e servido pelo nginx: busca a
  configuração, escolhe o ad unit pelo aparelho, respeita o gatilho e o `cooldown` (no
  `localStorage`), mostra as etapas, abre o anúncio premiado com
  `googletag.defineOutOfPageSlot(..., REWARDED)`, libera a página ou redireciona e manda os
  eventos.
- **Telas** em `src/modules/rewards/`: lista, editar (com a prévia ao lado, idioma do visitante,
  computador e celular, e as etapas), métricas. No painel do cliente em Inventário > Rewards; no
  interno em Inventário > Rewards, com a coluna Cliente. Textos em PT, EN e ES no `i18n.ts`.

## Infra (avant-infra)

- nginx: servir `/reward.js` com cache e `Access-Control-Allow-Origin: *`; as rotas
  `/api/reward/*` passam para a API como as outras.
- Nenhuma variável nova.

## Ordem e issues

Milestone nova **M9 Rewards e quiz** no core, api, worker, web e infra.

1. **core#295:** domínio `rewards` com tabelas, RLS, permissões e casos de uso do painel; grupos de
   ad units pelo nome; configuração pública.
2. **core#296:** métricas (`metrics.reward_*`) e contatos, com consulta e CSV.
3. **api#239:** rotas do painel e do painel interno.
4. **api#240:** rotas públicas, cache no Redis e limites.
5. **worker#130:** esvaziar o buffer de eventos e contatos; apagar o cache depois da importação.
6. **web#244:** módulo de render da janela e o `reward.js`.
7. **web#245:** telas (lista, editar, métricas) nos dois painéis.
8. **infra#90:** nginx para o script e as rotas públicas.

O core entra primeiro com uma tag nova; api e worker sobem a versão do core; o web vem por
último. O worker sobe antes da api (a api grava no buffer que o worker esvazia).

## Respostas do Pedro (09/11)

1. **Contatos e métricas ficam no Avant.** O Data não entra no reward.
2. **Não importar** os rewards e quizzes do Genius: os clientes cadastram de novo no Avant.
3. **Os contatos ficam guardados.** O prazo de guarda dos dados (TTL) será uma funcionalidade
   própria, mais à frente; nada de limpeza automática de contatos agora.
4. **Script novo.** O site troca a tag do Genius pela do Avant; sem compatibilidade com o
   `rewardsv2.min.js`.
