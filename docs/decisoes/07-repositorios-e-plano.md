# Avant: repositório e plano do MVP

> Registro da decisão na época em que foi tomada (outubro de 2026). Onde divergir de `docs/contexto.md` ou do código, vale o código.

Oct 23, 2026 · @Pedro

## Resumo

Um repositório por serviço, todos privados no perfil `PedroH3nri` (decisão de Pedro): `avant-core`, `avant-api`, `avant-worker`, `avant-web` e `avant-infra`. Eles geram quatro imagens no GHCR: `api`, `worker`, `scheduler` e `web`. Como os serviços dividem um banco só, os models e as migrations ficam num pacote Python próprio, o `avant-core`, que a API e o worker instalam numa versão fixa. O core segue arquitetura hexagonal pragmática (decisão de Pedro): ports and adapters por módulo, entidades em dataclass com mapeamento imperativo do SQLAlchemy e Unit of Work.

O plano vai de 23/10 a 31/12/2026, e termina com um piloto num cliente da rede Groone. Quem desenvolve são Pedro e o Claude, começando em 23/10 e indo até o fim do ano.

O protótipo React fica em avant-web/`design/prototype` só como referência visual, junto com o `DESIGN.md`, que é a regra para as telas Vue.

## Estrutura de pastas

```text
avant-core/                     pacote Python comum (biblioteca, sem servidor)
├── src/avant_core/
│   ├── db/                     engine, sessão, RLS (SET app.company_id)
│   ├── models/                 os 18 models do MVP (SQLAlchemy 2)
│   ├── access/                 permissões estilo defender
│   ├── gam/                    adaptador gam_client (SOAP agora, REST depois)
│   ├── mail/                   Resend e templates PT/EN/ES
│   ├── events/                 publicação no Redis para o SSE
│   └── audit/                  gravação no AuditLog
├── migrations/                 Alembic, único histórico do banco
└── tests/

avant-api/                      FastAPI, imagem api
├── src/avant_api/routers/      auth, company, members, invitations, roles,
│                               networks, sites, api_keys, internal, events
├── tests/                      pytest com Postgres real
└── Jenkinsfile

avant-worker/                   Celery, imagens worker e scheduler
├── src/avant_worker/tasks/     gam, mail, manutenção
├── src/avant_worker/beat.py    agenda: MCM, inventário, testes, expiração
├── tests/
└── Jenkinsfile

avant-web/                      Vue 3 + Vite + TypeScript, imagem web
├── src/
│   ├── api/                    cliente gerado do OpenAPI da avant-api
│   ├── components/ui/          shadcn-vue
│   ├── layouts/                sidebar + navbar do protótipo
│   ├── pages/                  uma pasta por tela
│   ├── stores/                 Pinia: sessão, Empresa ativa, permissões
│   └── i18n/                   pt.json, en.json, es.json
├── design/                     DESIGN.md, PRODUCT.md, prototype/
├── tests/                      Vitest + Playwright
└── Jenkinsfile

avant-infra/                    como tudo roda junto
├── compose/                    local, staging e produção
├── nginx/                      proxy, blue-green, buffering off no /events
├── monitoring/                 Prometheus, Loki, painéis do Grafana
├── jenkins/                    biblioteca compartilhada dos Jenkinsfiles
└── .env.example                nomes das variáveis, nunca valores
```

**Como o `avant-core` chega aos serviços:** cada mudança nele vira uma tag (`v0.4.0`), e a API e o worker o instalam direto do GitHub nessa tag (`avant-core @ git+https://github.com/PedroH3nri/avant-core@v0.4.0`). Assim não precisa de servidor de pacotes. As migrations rodam a partir da imagem da API, com a versão do core que ela usa.

**O custo de repos separados:** uma mudança de model que a API usa vira dois PRs, um no core e outro subindo a versão na API. Para não esquecer, o Jenkins do core abre sozinho o PR de atualização na API e no worker a cada tag nova.

Cada repositório tem seu `CLAUDE.md` com as regras dele, e o `avant-core` não conhece FastAPI nem Celery.

## Serviços e ferramentas

| Imagem | O que roda | Instâncias em produção | Instâncias em staging |
| --- | --- | --- | --- |
| `api` | FastAPI com Uvicorn | 2 (blue-green) | 1 |
| `worker` | Celery: filas `gam`, `mail`, `default` | 1, com 2 processos na fila gam | 1 |
| `scheduler` | Celery beat | 1 (nunca mais de uma) | 1 |
| `web` | o build do Vue servido por nginx | 2 (blue-green) | 1 |

PostgreSQL, RabbitMQ e Redis ficam fora das imagens do Avant, como serviços da VM.

Ferramentas propostas:

| Parte | Ferramentas |
| --- | --- |
| Python | Python 3.12, uv, Ruff (lint e formatação), mypy, pytest |
| Banco | SQLAlchemy 2, Alembic, psycopg 3 |
| API | FastAPI, Pydantic 2, sse-starlette para o `/events` |
| Tarefas | Celery 5, RabbitMQ como broker, Redis para resultados, locks e limites |
| GAM | `googleads` (SOAP, como o Genius) dentro do `gam_client` |
| Segurança | argon2-cffi, pyotp (2FA), Authlib (Google) |
| Frontend | Vue 3, Vite, TypeScript, Vue Router, Pinia, vue-i18n, Tailwind, shadcn-vue, fonte Geist |
| Testes do front | Vitest e Playwright |

**Por que shadcn-vue:** o protótipo aprovado foi feito com shadcn/ui (React), e a versão Vue tem os mesmos componentes e a mesma ideia de tokens no Tailwind. O `DESIGN.md` e as variáveis de cor passam quase iguais, então o painel Vue fica fiel ao protótipo sem redesenhar.

## Pipeline

Como decidido: `develop` publica em staging, `main` publica em produção, e toda mudança entra por PR.

1. **Branch de trabalho** (`feat/...`, `fix/...`) a partir de `develop`, com PR para `develop`.
2. **Em todo PR**, o Jenkins roda: Ruff, mypy, pytest com Postgres real, checagem de migrations (sobe e desce), lint e testes do Vue, e build das imagens sem publicar. PR vermelho não entra.
3. **Merge em `develop`:** o Jenkins gera as imagens com a tag do commit, publica no GHCR, roda as migrations no banco de staging e troca os containers de `staging.avant.groone.com`.
4. **PR de `develop` para `main`:** depois de testar em staging.
5. **Merge em `main`:** mesmas imagens (sem rebuild), backup do pgBackRest antes, migrations, sobe a cor nova (blue ou green), espera o `/ready` das 2 instâncias e só então o nginx troca o tráfego. A cor antiga fica parada por 1 hora para voltar rápido.

**Migrations precisam funcionar com a versão anterior no ar**, porque no blue-green as duas cores usam o mesmo banco por um tempo. Na prática: adicionar coluna num deploy e remover a antiga só no deploy seguinte.

Segredos (chave da conta de serviço, Resend, banco, Google OAuth) ficam só nas VMs, em arquivos `.env` lidos pelo compose. O repositório tem só o `.env.example` com os nomes.

## Plano até 31/12

As etapas seguem a ordem de dependência: sem login e permissões não há equipe, e sem equipe não há a quem ligar as networks.

&#91;embedded content: plano do MVP · 7 etapas até 31/12\]

Cada etapa termina publicada em staging, e a produção sobe uma vez, em 21/12, depois da revisão de segurança, do teste de carga e do primeiro restore de backup. Os 10 dias finais são de piloto e correções com um cliente da rede Groone, com a sincronização de métricas que Pedro já tem entrando só depois do MVP.

| Etapa | Entrega |
| --- | --- |
| Fundação | monorepo, pipeline, staging no ar com a tela de login vazia |
| Login, 2FA e permissões | convite, senha, Google em Configurações, 2FA, sessões, `core.access` |
| Empresa, equipe, interno | criar Empresa, membros, convites, papéis, painel interno de clientes |
| Conexão com o GAM | `gam_client`, descoberta MCM, conta de serviço, importação, SSE |
| Sites, chaves de API | atribuição de sites, ad units sem site, chaves de API, histórico |
| Segurança e produção | revisão de segurança, teste de carga, backups testados, alertas, deploy |
| Piloto | um cliente real usando, correções |

## Primeira semana (23/10 a 02/11)

A meta é terminar a semana com uma tela de login vazia publicada em staging pelo pipeline completo.

- [ ] Criar os 5 repositórios privados em `PedroH3nri` (feito em 23/10), cada um com as branches `main` e `develop` protegidas (só por PR)
- [ ] Esqueleto de cada repositório da seção acima, com `CLAUDE.md`, e o `.env.example` no `avant-infra`
- [ ] `docker compose` local: Postgres, RabbitMQ, Redis, api, worker, scheduler, web
- [ ] Pacote `core` com conexão ao banco, sessão por requisição e o `SET app.company_id` para o RLS
- [ ] Primeira migration: User, UserCredential, Company, Membership, Role, Permission, RolePermission, com RLS ligado
- [ ] FastAPI com `/health`, `/ready`, `/metrics`, logs JSON e o formato padrão de erro
- [ ] Vue com Vite, Tailwind, shadcn-vue, Geist, os tokens do `DESIGN.md`, i18n PT/EN/ES e o layout sidebar + navbar
- [ ] Jenkinsfile: checagens nos PRs, imagens no GHCR, deploy em staging no merge em `develop`
- [ ] DNS de `staging.avant.groone.com` e `avant.groone.com`, com HTTPS
- [ ] Domínio `avant.groone.com` verificado no Resend (registros SPF e DKIM)
- [ ] Cliente OAuth do Google criado no mesmo projeto do Google Cloud do Genius

## Decisões de Pedro (23/10/2026)

| Pergunta | Decisão |
| --- | --- |
| Quem desenvolve | Pedro e o Claude, de 23/10 até o fim do ano |
| Repositórios | Um por serviço: avant-core, avant-api, avant-worker, avant-web, avant-infra |
| Componentes do Vue | shadcn-vue |
| Cliente piloto | Em aberto por enquanto |
| Começo | Manhã de 23/10, com o esqueleto dos repositórios |
