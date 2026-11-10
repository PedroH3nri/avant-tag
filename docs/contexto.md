# Groone Avant: contexto do projeto

Contexto principal do projeto, igual nos seis repositórios (os cinco do Avant e o avant-tag) (atualizado em 03/11/2026). Quem chega para trabalhar aqui, pessoa ou agente, precisa só deste arquivo, do `CLAUDE.md`, das issues e da pasta `docs/`. Se algo aqui divergir do código, vale o código; corrija este arquivo nos seis repositórios.

## O produto

O Groone Avant ("Avant") é um SaaS para os clientes ad tech da Groone LLC: donos de sites que monetizam com AdSense e Google Ad Manager (GAM). Ele substitui e melhora o Genius, o sistema atual.

- **Foco do MVP:** gestão da empresa e da operação, permissões da equipe, conexão com o GAM.
- **Preço (ideia):** grátis para clientes da rede Groone, pago para os outros.
- **Idiomas:** interface em português, inglês e espanhol. Rotas e código em inglês.
- **Domínios:** `avant.groone.com` (produção) e `staging.avant.groone.com`.
- **Quem desenvolve:** Pedro (dono do produto, escreve em português) e o Claude, de 23/10 até o fim de 2026.

## Modelo de contas

- Painel interno da Groone → **Cliente** → uma **Empresa** por cliente (o cliente cria) → **membros**, cada um com um papel (predefinido ou personalizado).
- Uma pessoa pode estar em várias Empresas; há uma tabela única de usuários.
- O limite de funcionários por cliente é definido no painel interno. Limites (de pessoas e, quando existirem, de networks ou sites) valem só para Empresas de cliente; a Company Groone não tem limite (Pedro, 2026-10-24).
- Entrada só por convite por e-mail (Resend, validade de 1 dia); o login com Google é ligado depois, em Configurações. Sessão por cookie, 2FA por TOTP com códigos de recuperação.
- Permissões: módulo próprio em Python inspirado no `artesaos/defender` do Laravel, com escopo por Empresa. Catálogo de 66 permissões (33 de cliente e 33 internas). Sites são atribuídos por membro.
- A Empresa ativa vem da sessão; nenhuma rota tem `company_id` no caminho.
- Chaves de API por pessoa (token `avk_...`, guardado como SHA-256), com limite de taxa no Redis (2/s, rajada de 20).

## GAM

- Uma conta de serviço da Groone para tudo, só clientes ligados por MCM.
- Cadastro de network (Pedro, 06/11, core#289): a equipe Groone cadastra pelo painel interno escolhendo o cliente (`internal.networks.assign`), ou o cliente cadastra pelo painel dele (`network.connect`). A network fica ligada à Empresa e ao dono dela (`owner_user_id`, preenchido quando o dono aceita o convite), mesmo quando quem cadastrou é um funcionário. Nada é ligado pelo e-mail da conta do GAM. Todo cadastro testa a conexão (MCM aprovado na Groone e, no Manage Account, a conta de serviço lendo a network): válida, a network fica ativa; inválida, fica pendente e é testada de novo de hora em hora. Como o network code é público (está nas tags), a network do MCM cadastrada pelo cliente fica pendente com `awaiting_confirmation` até a equipe confirmar ou recusar (`confirm_client_network` / `reject_client_network`, `internal.networks.assign`, na página do cliente e no filtro da tela Networks da Groone, com o e-mail do child no MCM para comparar); a cadastrada pela equipe já nasce confirmada (Pedro, 06/11, migration 0048). Até a confirmação nada do GAM entra nela: nem teste, nome, ganhos do MCM, contrato, prazo de comissão, agendador ou ferramentas do GAM. Deploy da v0.85.0 do core: o worker sobe antes da API (o worker antigo não conhece a confirmação).
- Ad Manager REST API v1 atrás de um adaptador `gam_client` **somente leitura** (nenhum método de escrita sem revisão do Pedro).
- Descoberta MCM de hora em hora (childPublishers); sites e ad units importados a cada 6 horas.
- Site também pode ser cadastrado à mão pelo domínio (`sites.manage`, decisão de 2026-10-24): fica "aguardando GAM" e a importação o junta ao site do GAM com o mesmo domínio, mantendo as atribuições. Ad units vêm só do GAM.
- Contratos (Pedro, 2026-10-24): a tabela `contracts` guarda o revshare (parte da Groone) de cada network. O revshare de um contrato nunca muda: quando muda, o contrato ativo é encerrado e nasce outro; há no máximo um ativo por network. No MCM Manage Account o revshare vem do GAM (`approvedManageAccountRevenueShareMillipercent`) numa tarefa de hora em hora e não se cria contrato à mão; no Manage Inventory a equipe Groone cria o contrato à mão. CRUD no painel interno com as permissões `internal.contracts.view/create/update/delete`.
- A receita do cliente e a da Groone são calculadas na consulta com o revshare do contrato **ativo** da network, nunca com um valor gravado nas métricas (as métricas podem sincronizar antes do revshare). As tabelas de métricas guardam só a receita bruta.
- Eventos para a tela em tempo real: canal Redis `avant:events:{company_id}`, JSON `{type: "network.updated", data: {network_id}}`, entregue pelo SSE em `/api/v1/events`.

## Arquitetura

- Python 3.12 com uv, FastAPI, Celery (broker RabbitMQ, Redis para resultados, locks, limites e eventos), PostgreSQL para tudo. Front em Vue 3 (SPA), Tailwind e componentes no estilo shadcn-vue (reka-ui), com build e CI no Node 26 e o pnpm 10.28 instalado pelo npm (do Node 25 em diante o corepack não vem junto; web#228).
- Microserviços que dividem um banco. API first.
- **Row Level Security ligado.** A aplicação conecta como `avant_app` (não é dono das tabelas, sem BYPASSRLS); as migrations usam `avant_owner`. A Unit of Work faz `SET app.company_id`. Não mudar isso.
- O `avant-core` segue arquitetura hexagonal pragmática: ports e adapters por domínio (a lista está em Repositórios), entidades em dataclass com mapeamento imperativo do SQLAlchemy.
- No core, todo domínio (ou subdomínio, como `gam/networks/`) tem `models/`, `enums/`, `errors/`, `tables/`, `interfaces/`, `repositories/` e `services/`, uma coisa por arquivo, com `__init__.py` que reexporta (core#74, 27/10). SQLAlchemy só em `tables/`, `repositories/` e `db/`; `db/` guarda o que é de todos (metadata, mapeamento, Unit of Work com o RLS). Controller e DTO só existem no avant-api.
- O `avant-api` tem um módulo por recurso: `modules/<recurso>/` com um `controller.py`, um `dto.py`, um `service.py` e um `dependencies.py` (recurso novo é módulo novo; apoio só do módulo num arquivo com o nome do assunto), infraestrutura em `app/` e DTOs comuns em `shared/`. O service recebe interfaces pelo construtor (inversão de dependência); model e repository ficam no core.
- O `avant-worker` também segue os domínios do core: tarefas em `tasks/<domínio>/<assunto>_tasks.py` (gam, metrics, money, maintenance) e adaptadores (GAM, data, cotações, eventos) em `adapters/`.
- O `avant-web` também é organizado por domínio: `src/modules/<domínio>/` com as telas, os componentes, o `service.ts` (chamadas à API) e os `types.ts` do domínio; o que é comum fica em `src/lib/`, `src/components/` e `src/layouts/`. As telas não chamam a API direto: passam pelo `service.ts` do domínio.

## Repositórios

Todos privados no perfil pessoal `PedroH3nri` no GitHub (fora da organização iGroone).

| Repositório | O que é | Estado em 03/11 |
|---|---|---|
| `avant-core` | Pacote comum: domínio, casos de uso, models, migrations (Alembic), RLS, e-mail. Instalado pela API e pelo worker por tag git (nunca por commit). | v0.65.0. Domínios: identity, company, access, audit, groups, gam (client, mcm, networks, inventário, contratos, sync, tools), metrics, money, reports, dashboards, alerts, schedules, saved_views, results, revenue_status, costs, goals, commissions, invoices, documents, client_notes, support_tasks, site_checklists, internal |
| `avant-api` | FastAPI em `/api/v1`, cerca de 270 rotas, rotas internas em `/internal`. | develop com as rotas das ferramentas do GAM (PR #152, promovidas no #153); core v0.64.0 pela tag (PR #154) |
| `avant-worker` | Celery worker e beat, tarefas `avant.<fila>.<nome>`, filas `default`, `mail` e `gam`. | 18 tarefas no beat (gam, metrics, money, alerts, schedules, reports, commissions, checklists, maintenance); escritas no GAM (PR #67) com a trava por network; core v0.65.0 pela tag |
| `avant-web` | Painel Vue 3: login, 2FA, convite, Minha conta, equipe, papéis e grupos, documentos, networks, sites, relatórios, dashboards (página inicial), alertas, envios agendados, custos, resultado e faturamento; painel interno `/interno` com clientes, contratos, inventário, resultados, metas, comissões, invoices, tarefas, checklists e ferramentas do GAM. | develop até o PR #182 |
| `avant-infra` | Compose local, Postgres, nginx, monitoramento, deploy. | Compose local e deploy nas VMs (`compose/vm`, `scripts/deploy.sh`); staging ainda não está no ar (M1: #4, #5, #6) |

Cada repositório tem um `CLAUDE.md` com as regras dele e um README. Leia os dois antes de mudar algo.

## Onde está o trabalho

**Toda demanda é uma issue com milestone, no repositório certo** (decisão do Pedro, 23/10). Para saber o que fazer: `gh issue list --repo PedroH3nri/<repo> --milestone "<milestone>"`. Um PR fecha a sua issue com `Closes #N`.

| Milestone | Prazo | Conteúdo |
|---|---|---|
| M1 Staging no ar | 06/11 | Deploy nas VMs, pipeline Jenkins e imagens no GHCR, monitoramento, preparação das VMs |
| M2 Segurança e produção | 21/12 | Revisão de segurança, teste de carga, backups testados, E2E, primeiro deploy de produção |
| M3 Piloto | 31/12 | Um cliente real da rede Groone (ainda não escolhido) |
| M4 Métricas do GAM | feito | Models e sincronização das métricas, motor de consulta, primeira tela de desempenho. Desde a v0.82.0 (core#230), oito tabelas por nível (network, domínio, ad unit, key-value), resumidas e `_detail`; key-value sem dispositivo e particionado por key |
| M5 Personalização e relatórios | quase: resta o épico avant-web#22 | Personalização no estilo HubSpot: dashboards, construtor de relatórios, páginas de relatório no menu, métricas personalizadas (fórmulas), metas, alertas, envios agendados, propriedades personalizadas, visões salvas, tema e marca. Épico: avant-web#22 |
| M6 Grupos e comissão | feito | Grupos de funcionários na Empresa (um por pessoa), imagem da Empresa, metas da equipe Groone e a comissão da equipe Groone (core v0.42.0 a v0.49.0): regras no papel por evento (cadastro e reativação de cliente, network e site), prazos com espera e duração, cálculo diário em dólar sobre o revshare da Groone, fechamento do dia 15 ao 20 depois do `Mcm_Earnings` com a dedução do GAM, desconto manual, emissão. Regras do Pedro (30/10): cada receita conta uma vez por pessoa (vale o prazo de maior percentual) e cada evento gera um prazo só na vida do item. Spec em `docs/superpowers/specs/2026-10-29-comissao-da-equipe-groone-design.md` (avant-core). Decisões: `docs/decisoes/08-grupos-e-imagem-da-empresa.md`, `docs/decisoes/09-comissao-da-equipe-groone.md` |
| M7 Invoices | feito | Invoices da equipe Groone como no Genius: a pessoa cria a invoice do mês com a comissão validada (linhas travadas com os textos do Genius, em inglês), soma serviços do catálogo com valor livre, emite com os dados de recebimento (sempre pessoa física; De GROONE, LLC para o funcionário); o financeiro devolve para rascunho com motivo por e-mail ou confirma o pagamento. Emitida ou paga não muda (triggers no banco). Permissões `internal.invoices.view/manage/services`. Core v0.50.0, spec em `docs/superpowers/specs/2026-10-30-invoices-da-equipe-design.md` (avant-core) |
| M8 Painel interno: itens do Genius | em andamento | O que o painel interno do Genius tem e o Avant não (Pedro, 03/11): documentos do cliente Manage Inventory (identidade e comprovante de residência, enviados pelo cliente e aprovados pela equipe) e observações da equipe (core#188, feito), tarefas de suporte (core#189, feito, domínio `support_tasks`), checklist de domínio automatizado (core#190, feito, domínio `site_checklists`), ferramentas da API do GAM com escrita, em Ferramentas (core#191, feito: domínio `gam/tools` em core#201, escritas por SOAP no worker#64; as rotas, api#150, estão na pre-develop), e comparar períodos no relatório personalizado mais uma consulta por relatório (core#192, aberto) |
| M9 Rewards e quiz | feito (em develop, 09/11) | O reward do Genius refeito no Avant (decisão `docs/decisoes/12-rewards-e-quiz.md`): uma janela numa página do site do cliente que libera o conteúdo depois de um anúncio premiado do GAM (`OutOfPageFormat.REWARDED`), com até 5 perguntas e pedido de contato antes do anúncio. Core v0.87.0 (domínio `rewards`, migrations 0049 e 0050, permissões `rewards.view/manage/leads` e `internal.rewards.*`). Script novo `/reward.js` (desde o M10 o código fica no avant-tag e o avant-web só gera o arquivo), sem compatibilidade com o rewardsv2; o site põe `<script async src="https://avant.groone.com/reward.js"></script>` no `<head>`. Rotas públicas `/api/reward/v2`, `/api/reward/icon/{id}`, `POST /api/reward/events` e `/api/reward/leads` (CORS aberto, limite por IP), eventos e contatos num buffer no Redis (`avant:reward:buffer`) que o worker grava a cada minuto; cache da página em `avant:reward:{domínio}/{caminho}`. Contatos e métricas ficam no Avant, nada vem do Genius, contatos sem prazo de expiração por enquanto (Pedro, 09/11). Uma página só mostra reward quando o domínio está ativo numa única Empresa. Telas em Inventário > Rewards nos dois painéis |
| M10 Ad tag | feito (em develop, 10/11) | A G-Tag do Genius refeita no Avant (decisão `docs/decisoes/13-ad-tag.md`). Todo o código que roda no site do cliente fica no repositório `PedroH3nri/avant-tag` (módulos core, loader, ads, page-views, mgid, analytics e reward; `tag.js` com o reward dentro e `reward.js` só do reward); o avant-web instala o avant-tag por tag do git, usa o mesmo código nas prévias e gera `/tag.js` e `/reward.js` no build (`vite.embed.config.ts`). O site põe `<script async src="https://avant.groone.com/tag.js" data-tag="tg_..."></script>` no `<head>`. Várias tags por site, cada uma com nome e chave; rascunho e versões publicadas com volta; blocos Conteúdo 1 a 9, âncora, interstitial e fixo, por aparelho e por caminho; integrações Analytics, MGID, loader, reward e regras de preço (só a opção guardada por enquanto). Loaders são da Empresa (Inventário > Loaders), modelos GroOne e Tela cheia, com aviso ou bloqueio de adblock. Core v0.88.0 a v0.90.0 (domínios `ad_tags` e `loaders`, migrations 0051 a 0053, permissões `ad_tags.view/manage` e `internal.ad_tags.*`, item "Ad tag no ar" no checklist do site). Rotas públicas `GET /api/tag/config` (cache `avant:tag:{chave}`) e `POST /api/tag/page-views` (precisa estar em `CROSS_SITE_PATHS`); as visitas vão para a lista `avant:page-views:buffer` no Redis e o worker grava a cada minuto em `metrics.page_view_events` (crua, partição por dia, guardada para sempre), `page_views_hourly`, `page_views_key_value_hourly` e `ad_tag_daily`, com o país pelo GeoLite2 (`GEOLITE2_COUNTRY_FILE`, o arquivo fica em `/srv/avant/<ambiente>/geoip/` na VM; sem ele o país fica desconhecido). Telas em Inventário > Ad tags nos dois painéis: lista por site, editor com prévia e escolha do lugar do bloco, versões e métricas. |
| Pós-MVP | sem data | O que sobrar depois do piloto |

Issues abertas em 03/11 (a lista viva está no GitHub):

- **avant-infra:** M1 #4 pipeline Jenkins e GHCR, #5 monitoramento, #6 tarefas do Pedro; M2 #7 backups, #8 teste de carga, #9 revisão de segurança, #10 deploy de produção; M3 #11 piloto; Pós-MVP #16
- **avant-core:** M8 #192 comparar períodos no relatório personalizado; Pós-MVP #18, #23, #54, #56, #57, #59, #104, #193
- **avant-api:** M8 #150 rotas das ferramentas do GAM (na pre-develop); Pós-MVP #15, #21, #26, #50
- **avant-worker:** Pós-MVP #31
- **avant-web:** M2 #9 E2E com Playwright; M5 #22 épico da personalização; Pós-MVP #16, #21, #59, #142

A personalização segue o HubSpot como inspiração (pedido do Pedro, 23/10). Cada funcionalidade tem uma issue por repositório, ligadas entre si: core primeiro, depois api e worker, por fim web.

Fora do escopo por enquanto: port das regras de preço, cobrança, tabela de permissões por papel.

## Como trabalhar nos repositórios

- Rodar tudo na máquina em modo de desenvolvimento: `avant-infra/docs/desenvolvimento.md` ([link](https://github.com/PedroH3nri/avant-infra/blob/develop/docs/desenvolvimento.md)).
- Branches `feat/...` ou `fix/...` a partir de `pre-develop`; PR para `pre-develop`. A `pre-develop` sobe para a `develop` num PR próprio. `develop` publica em staging, `main` em produção.
- **Revisão antes da `develop`** (Pedro, 30/10 e 03/11): a promoção `pre-develop` → `develop` passa por revisão de código de um revisor de contexto novo; o que for crítico ou importante é corrigido, com teste, antes do merge. E só com a CI verde (o `gh api` mescla mesmo com a CI vermelha: espere `gh pr checks --watch`).
- Feature pronta entra na `pre-develop` sem revisão, com as checagens e a CI verdes. A promoção para a `develop` passa pela revisão e pela CI; sem vulnerabilidade nem erro, o Claude mescla (autorizado pelo Pedro em 03/11). `main` e produção ficam com o Pedro.
- Tags do `avant-core` saem pela GitHub Action `release.yml` quando a versão do `pyproject.toml` muda (push de tag direto pode ser bloqueado).
- Antes do PR, Python: `uv run ruff format . && uv run ruff check . && uv run mypy && uv run pytest`. Web: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Mudança de model que a API usa vira dois PRs: um no core (nova tag) e outro subindo a versão na API e no worker.
- O CI da API e do worker usa o secret `AVANT_CORE_ACCESS` para instalar o core privado.
- Tabela nova com `company_id`: RLS e política na mesma migration, mais teste em `tests/integration/test_rls.py`.
- Migrations precisam funcionar com a versão anterior no ar (blue-green): adicionar coluna num deploy, remover a antiga só no seguinte.
- No `avant-web` não há configuração do Prettier: **não rodar o Prettier** nos arquivos existentes, ele reformata o repositório inteiro.
- No `avant-web`, todo texto em `src/lib/i18n.ts` com PT, EN e ES; tipos da API no `types.ts` de cada domínio (comuns em `src/lib/types.ts`), iguais aos `dto.py` da API.
- Caminhos do painel que a API usa e não podem mudar: `/entrar`, `/entrar/2fa`, `/convite/{token}`, `/redefinir-senha/{token}`, `/configuracoes/conta`.
- Nada de segredos no repositório nem na memória. Textos, mensagens de erro e comentários em português.

## Identidade visual

Aprovado: o protótipo navegável no estilo Vercel e o `DESIGN.md` dele (fonte Geist, quase monocromático, primário preto, azul só para links). Tela nova é feita primeiro no protótipo, depois no código. O protótipo do Figma v1 foi rejeitado. O protótipo (React, só referência visual), o `DESIGN.md` e o `PRODUCT.md` ficam em `avant-web/design/`.

## Infraestrutura e operação

- **VM principal** (16 vCPU, 32 GB): produção, que divide a máquina com Genius, Data e MongoDB. Mínimo de 2 instâncias de `api` e de `web`, deploy blue-green.
- **VM pequena** (4 vCPU, 8 GB): Jenkins, Grafana, Prometheus, Loki, staging (1 instância de cada) e backups.
- Imagens no GHCR (`ghcr.io/pedroh3nri/avant-{api,worker,web}`); pipeline no Jenkins.
- TLS no nginx do host; o stack do Avant escuta só em `127.0.0.1`.
- `/api/v1/events` precisa de `proxy_buffering off` em qualquer proxy; `/api/v1/metrics` nunca exposto para a internet.
- Backup com pgBackRest: incremental diário, full semanal, comprimido, retenção de 90 dias, na VM pequena.
- Observabilidade: métricas no Prometheus, logs JSON no Loki com stack traces (sem Sentry), alertas por e-mail.
- Segredos só nas VMs, em `/srv/avant/<ambiente>/`. Variáveis da aplicação: `DATABASE_URL`, `CELERY_BROKER_URL`, `REDIS_URL`, `SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_BASE_URL`, `GOOGLE_OAUTH_CLIENT_ID/SECRET` (redirect `{APP_BASE_URL}/api/v1/auth/google/callback`), `GAM_SERVICE_ACCOUNT_EMAIL` (api), `GAM_SERVICE_ACCOUNT_FILE` e `GAM_GROONE_NETWORK_CODE` (só no worker da fila gam).

## Tarefas manuais do Pedro

Estão na issue avant-infra#6: DNS e HTTPS dos dois domínios, domínio no Resend, cliente OAuth do Google, chave da conta de serviço do GAM e a conta como administradora, arquivos de segredo nas VMs, login das VMs no GHCR e o `avant-bootstrap` em staging.

Alerta de segurança: o repositório do Genius tem segredos commitados (só Pedro e o sócio tinham acesso). Rotacionar é recomendado.

## Documentos de decisão

Cópias em Markdown em `docs/decisoes/` de cada repositório. São o registro das decisões na época: partes foram superadas pelo que está acima e pelo código (por exemplo, o monorepo virou cinco repositórios, o Caddy virou nginx e o cabeçalho `X-Company-Id` virou a Empresa da sessão). Os originais ficaram na conta antiga do claude.ai:

- Requisitos: https://claude.ai/artifact/Xufx2Nkwr4DELmjrApJTGR
- Arquitetura: https://claude.ai/artifact/7oqA6vBK2jQ1Ab4axWWFBL
- Models do MVP (18 models): https://claude.ai/artifact/ViYx1Num6BuctgtgW34Cae
- Conexão com o GAM: https://claude.ai/artifact/4awpwUxBW9VMQoeFN5pvPp
- Fluxos de login e convite: https://claude.ai/artifact/ErKHgj8puoFooDwBK8JB4e
- Endpoints da API: https://claude.ai/artifact/YWMmSvEW9xbVuG5gnbvd5Y
- Repositórios e plano do MVP: https://claude.ai/artifact/9mfxsywc68VEJqeYKDWFPT
- Protótipo navegável: https://claude.ai/artifact/MJJHKXxGN2GA8tpakMnemf
- Grupos na Empresa e imagem da Empresa (26/10): https://claude.ai/artifact/AoxAu9E4XNQhCCmaxVjLRe

## Skills e ferramentas

- `docs/skills/` tem todas as skills que o repositório usa: as do Avant (`avant-*`), as do [superpowers](https://github.com/obra/superpowers) e a do [graphify](https://github.com/Graphify-Labs/graphify). O `docs/skills/README.md` diz quando usar cada uma. `.claude/skills` aponta para essa pasta.
- O `.claude/settings.json` carrega a `using-superpowers` no começo de cada sessão.
- graphify: o grafo do código está versionado em `graphify-out/` de cada repositório (`GRAPH_REPORT.md` para ler; `graph.json` para `graphify query "..."`, `graphify path "A" "B"` e `graphify explain "X"`). Consulte antes de sair lendo arquivo por arquivo. Depois de mudar código, rode `graphify update .` (instale com `uv tool install graphifyy`; é local e sem LLM) e commite o grafo junto. O `.graphifyignore` deixa as skills de terceiros de fora.

## Dicas de ambiente para o agente

- `gh pr create` pode falhar (GraphQL bloqueado pelo proxy): abrir PR com `gh api repos/PedroH3nri/<repo>/pulls -f base=pre-develop -f head=<branch> ...`.
- Clones rasos: `git fetch origin develop:refs/remotes/origin/develop pre-develop:refs/remotes/origin/pre-develop`.
- Não há Postgres local na sessão; os testes de integração da API rodam no CI.
