# Arquitetura do MVP do Avant

> Registro da decisão na época em que foi tomada (outubro de 2026). Onde divergir de `docs/contexto.md` ou do código, vale o código.

Oct 22, 2026 · @Pedro

## Visão geral

O MVP do Avant entrega dois módulos: conta e equipe (painel interno, clientes, Empresa, papéis, convites) e conexão com o Google Ad Manager (MCM ou conta de serviço, importação de sites). Esta é uma proposta técnica para revisão, baseada nas decisões do [documento de requisitos](https://claude.ai/artifact/Xufx2Nkwr4DELmjrApJTGR).

- **Stack:** Python, FastAPI, Celery com RabbitMQ e Redis, PostgreSQL compartilhado, Vue 3 SPA, Docker Compose na VM principal.
- **Princípio central:** todo dado de cliente pertence a uma Empresa, e nenhuma consulta roda sem o filtro da Empresa ativa.
- **Fora deste desenho:** métricas, dashboards, price rules e cobrança.

## Serviços

&#91;embedded content: serviços do MVP · API, 3 workers, filas e banco\]

A API nunca chama um worker diretamente: ela põe a tarefa numa fila do RabbitMQ, e cada worker lê só a sua fila. Todos gravam no mesmo PostgreSQL, com as migrations num único lugar.

## Modelo de dados

São 12 tabelas no PostgreSQL. As que pertencem a um cliente levam `company_id`; usuários e o catálogo de permissões são globais, porque uma pessoa pode estar em várias Empresas.

| Tabela | Campos principais | Relacionamentos |
| --- | --- | --- |
| `users` | id, email (único), name, password\_hash, google\_sub, status, internal\_role\_id | Global. `internal_role_id` só para a equipe Groone |
| `clients` | id, name, owner\_user\_id, member\_limit, mcm\_status, created\_at | Cadastrado no painel interno. 1 cliente tem 1 Empresa |
| `companies` | id, client\_id (único), name, settings (JSONB) | `settings` guarda tema e cores do sistema |
| `permissions` | code (PK, ex.: `members.manage`), description, scope | Catálogo fixo, criado por migration. `scope` = company ou internal |
| `roles` | id, company\_id (nulo = pré-definido), scope, name, is\_system | Pré-definidos são globais; papéis próprios têm `company_id` |
| `role_permissions` | role\_id, permission\_code | N para N entre papéis e permissões |
| `memberships` | user\_id, company\_id, role\_id, status, joined\_at | Único por (user\_id, company\_id) |
| `invitations` | id, company\_id, email, role\_id, token\_hash, invited\_by, expires\_at, accepted\_at, revoked\_at | Conta no limite de funcionários enquanto pendente |
| `gam_networks` | id, company\_id, network\_code (único), name, connection\_type (mcm, service\_account), status, last\_checked\_at, last\_error | Uma Empresa pode ter várias networks |
| `sites` | id, company\_id, gam\_network\_id, gam\_site\_id, url, approval\_status, synced\_at | Importados do GAM |
| `ad_units` | id, company\_id, gam\_network\_id, gam\_ad\_unit\_id, parent\_id, name, path, synced\_at | Importados do GAM, em árvore |
| `audit_log` | id, company\_id, actor\_user\_id, action, target, payload (JSONB), created\_at | Registra convites, mudanças de papel e conexões |

O limite de funcionários é checado na criação do convite: membros ativos mais convites pendentes não podem passar de `clients.member_limit`, contados dentro de uma transação com trava na linha do cliente.

## Isolamento, autenticação e permissões

Cada requisição passa por três checagens, nesta ordem: quem é o usuário, em qual Empresa ele está agindo, e se o papel dele nessa Empresa tem a permissão pedida.

- **Autenticação:** login por e-mail e senha (hash com Argon2) ou Google (OpenID Connect). O login com Google só é aceito para um usuário que já existe e tem o mesmo e-mail verificado. A API devolve um token de acesso curto (15 minutos) e um refresh token em cookie httpOnly.
- **Empresa ativa:** o SPA envia o cabeçalho `X-Company-Id`. Uma dependência do FastAPI confere se existe `membership` ativa para o usuário nessa Empresa e carrega o papel.
- **Permissão:** cada endpoint declara o código exigido, por exemplo `require("members.invite")`. O conjunto de permissões do papel fica em cache no Redis e é invalidado quando o papel muda.
- **Isolamento:** a camada de repositório sempre filtra por `company_id` da Empresa ativa. Como segunda barreira, o Row Level Security do PostgreSQL fica ativo já no MVP nas tabelas com `company_id`.
- **Equipe Groone:** rotas `/internal/*` exigem `internal_role_id` e permissões de escopo internal. Os papéis internos (Admin, Comercial, Marketing) ficam para depois, como combinado.

Catálogo inicial de permissões da Empresa: `company.manage`, `members.invite`, `members.manage`, `roles.manage`, `gam.connect`, `sites.view`, `traffic.view`, `revenue.view`, `dashboards.edit`.

### Controle de acesso no estilo do Defender

O Avant terá um módulo próprio, `core.access`, que reproduz em Python o que o [Defender](https://github.com/artesaos/defender) faz no Genius, com uma diferença: o Defender vale para o sistema todo, e no Avant cada papel e permissão vale dentro de uma Empresa. Não há pacote Python equivalente e mantido, por isso a proposta é escrever o módulo.

| No Defender (Laravel) | No Avant (FastAPI) |
| --- | --- |
| Middleware `needsPermission:user.index\|user.create` | Dependência `require("members.view", "members.invite")`, exige todas |
| Opção `any => true` | `require_any("members.view", "members.invite")`, basta uma |
| Middleware `needsRole:admin` | `require_role("gestor-trafego")` |
| Curinga `user.*` | Curinga `members.*` |
| Permissão direta no usuário, com `value` true ou false, que vence a do papel | Tabela `member_permissions` (membership\_id, permission\_code, value), que vence a do papel |
| Permissão temporária com `expires` e `revokeExpiredPermissions()` | Coluna `expires_at` em `member_permissions` e tarefa `revoke_expired_permissions` na fila `maintenance` |
| `canDo()` com papel superuser | Papel interno Admin da Groone passa em todas as checagens |
| `@shield` no Blade e `Defender::javascript()` | Rota `GET /me/permissions` e, no Vue, diretiva `v-can="'members.invite'"` e guarda de rota |
| Comandos `defender:make:role` e `defender:make:permission` | Comandos `avant access make-role` e `avant access make-permission` (Typer) |

A ordem da checagem é: permissão direta do membro, se existir e não tiver vencido; senão, permissões do papel dele na Empresa ativa. O resultado fica em cache no Redis por membro e é invalidado quando papel ou permissão mudam.

## Fluxos

**Convite de funcionário**

1. O dono (ou quem tem `members.invite`) informa e-mail e papel. A API checa o limite de funcionários e cria o convite com um token aleatório, guardando só o hash.
2. A API põe na fila `email` a tarefa de envio. O worker manda o e-mail com o link `/convite/<token>`, válido por 1 dia.
3. A pessoa abre o link. Se o e-mail ainda não tem usuário, ela define nome e senha; se já tem, só confirma.
4. A API cria a `membership` com o papel do convite, marca o convite como aceito e registra no `audit_log`.
5. A partir daí a pessoa pode entrar também com o Google, usando o mesmo e-mail.

**Conexão com o GAM por MCM (automática)**

1. O cliente aceita o contrato MCM com a Groone no Ad Manager.
2. A cada 15 minutos, o Celery Beat dispara a tarefa que lista, pela API do GAM, os child publishers da network da Groone.
3. Uma network nova e aceita aparece no painel interno, onde a equipe Groone seleciona o cliente proprietário; só então vira `gam_networks` com status connected.
4. Em seguida entra na fila `gam` a importação de sites e ad units.

**Conexão com o GAM por conta de serviço (manual)**

1. O Avant mostra o passo a passo e o e-mail da conta de serviço da Groone para o cliente adicionar como administrador no GAM.
2. O cliente informa o network code e clica em "Testar conexão". A API cria a network ligada ao próprio cliente, com status pending e põe na fila `gam` a tarefa de teste.
3. O worker tenta ler a network com a conta de serviço. Deu certo: status connected e importação de sites. Falhou: status error com a mensagem, que aparece para o cliente.
4. O SPA consulta o status da network até sair de pending.

## Endpoints da API REST

Todas as rotas ficam sob `/api/v1`. As rotas de Empresa exigem o cabeçalho `X-Company-Id` e a permissão indicada.

| Método e rota | O que faz | Permissão |
| --- | --- | --- |
| `POST /auth/login` | Login com e-mail e senha | Pública |
| `POST /auth/google` | Login com Google (usuário já existente) | Pública |
| `POST /auth/refresh`, `POST /auth/logout` | Renova ou encerra a sessão | Logado |
| `GET /me`, `GET /me/companies` | Dados do usuário e Empresas de que participa | Logado |
| `GET /invitations/{token}`, `POST /invitations/{token}/accept` | Abre e aceita o convite, definindo a senha | Pública (token) |
| `POST /companies` | Cliente cria a sua Empresa (409 se já existir) | Papel Cliente |
| `GET /companies/current`, `PATCH /companies/current` | Lê e edita a Empresa, inclusive tema | `company.manage` |
| `GET /members`, `PATCH /members/{user_id}`, `DELETE /members/{user_id}` | Lista, troca papel e remove funcionário | `members.manage` |
| `GET /invitations`, `POST /invitations`, `DELETE /invitations/{id}` | Lista, cria e revoga convites | `members.invite` |
| `GET /permissions` | Catálogo de permissões | Logado |
| `GET /roles`, `POST /roles`, `PATCH /roles/{id}`, `DELETE /roles/{id}` | Papéis pré-definidos e próprios | `roles.manage` (leitura: logado) |
| `GET /gam/networks`, `GET /gam/networks/{id}` | Networks conectadas e status | `sites.view` |
| `POST /gam/networks`, `POST /gam/networks/{id}/test` | Cadastra network por conta de serviço e testa | `gam.connect` |
| `POST /gam/networks/{id}/sync` | Reimporta sites e ad units | `gam.connect` |
| `GET /sites`, `GET /ad-units` | Sites e ad units importados | `sites.view` |
| `GET/POST/PATCH /internal/clients` | Painel interno: clientes, limite de funcionários, network code MCM | Equipe Groone |

A documentação OpenAPI sai pronta do FastAPI em `/api/docs`, o que ajuda no desenvolvimento do frontend.

## Tarefas em fila e agendadas

Cada fila tem o seu worker, para que uma importação lenta do GAM nunca atrase o envio de um convite.

| Tarefa | Fila | Quando roda | O que faz |
| --- | --- | --- | --- |
| `send_invitation_email` | `email` | Ao criar ou reenviar convite | Envia o e-mail pelo Resend com o link do convite |
| `test_gam_connection` | `gam` | Ao clicar em "Testar conexão" | Confere o acesso da conta de serviço à network |
| `discover_mcm_networks` | `gam` | A cada 15 minutos (Beat) | Lista child publishers da network Groone e conecta os novos |
| `import_sites_and_ad_units` | `gam` | Após conectar e diariamente (Beat) | Importa ou atualiza sites e ad units |
| `expire_invitations` | `maintenance` | A cada hora (Beat) | Marca convites vencidos e libera vaga no limite |

As tarefas do GAM são idempotentes (rodar duas vezes dá o mesmo resultado) e têm retry com espera crescente, porque a API do GAM tem cota de requisições. Os intervalos de 15 minutos e diário são sugestões iniciais.

## Ambientes, deploy e backup

Produção roda sempre com pelo menos 2 instâncias do front e 2 da API, e cada deploy é blue-green (decidido por Pedro em 22/10/2026).

| Item | Decisão |
| --- | --- |
| Ambientes | Local (Docker Compose); staging na VM menor, com 1 instância de cada serviço; produção na VM principal |
| Branches | `develop` publica em staging, `main` em produção, sempre por pull request |
| Domínios | `avant.groone.com` e `staging.avant.groone.com`, HTTPS automático pelo Caddy |
| Código e imagens | Repositório na organização da Groone no GitHub; imagens no GitHub Container Registry |
| Segredos | `.env` e chave do GCP só nas VMs, nunca no repositório |
| Backup | Incremental diário, completo semanal, arquivos descartados após 3 meses |

**Como o blue-green funciona no Jenkins**

1. Lint, tipos, testes e build; as imagens são publicadas no GHCR com a tag do commit.
2. O Jenkins sobe a cor inativa (por exemplo green) com 2 instâncias de front e 2 de API, ao lado da cor ativa (blue).
3. As migrations rodam antes da troca. Elas precisam ser compatíveis com a versão anterior (adicionar coluna, nunca renomear ou apagar no mesmo deploy), porque as duas cores usam o mesmo banco por alguns minutos.
4. O Jenkins confere o `/health` das instâncias green. Se todas responderem, o Caddy passa a enviar o tráfego para green, com um reload sem derrubar conexões.
5. Blue fica parada por um tempo para rollback imediato e depois é removida.

Os workers do Celery não precisam de blue-green: eles são reiniciados com desligamento suave, terminando a tarefa em andamento antes de sair.

**Backup com pgBackRest**

Decidido: pgBackRest com backup completo semanal e incremental diário, compactado (zstd) e guardado em disco de VM, sem bucket externo. O pgBackRest apaga sozinho o que passar de 90 dias. O repositório de backup fica na VM menor, separado da VM do banco, para que uma falha de disco na VM principal não leve banco e backup juntos. Vale também restaurar um backup em staging uma vez por mês.

## Observabilidade

Métricas, logs e alertas ficam na VM menor, no Prometheus, no Loki e no Grafana, e os alertas chegam por e-mail (decidido por Pedro em 22/10/2026). No MVP não há ferramenta separada de erros: o stack trace vai no próprio log.

| Camada | Como fica |
| --- | --- |
| Métricas | Prometheus coleta a API (`prometheus-fastapi-instrumentator`), Celery, PostgreSQL, RabbitMQ, Redis, as duas VMs (node\_exporter) e os containers (cAdvisor) |
| Logs | JSON com `request_id`, `company_id`, `user_id` e rota; exceções com stack trace completo; centralizados no Loki e consultados no Grafana |
| Erros do front | O `errorHandler` do Vue envia o erro para `POST /api/v1/client-errors`, que grava no mesmo log |
| Alertas | Grafana por e-mail, usando o SMTP do Resend |

Alertas iniciais: API fora do ar, taxa de erro acima do normal, fila do Celery acumulando, falha no backup e disco acima de 80%. Quando o volume de clientes crescer, vale reavaliar o Sentry, que agrupa erros repetidos e avisa quando surge um erro novo.

## Estrutura do repositório

Um repositório só, com o pacote `core` compartilhado entre a API e os workers. Assim o banco tem um único dono das migrations, mesmo com vários serviços.

```text
avant/
  core/            models SQLAlchemy, migrations Alembic, catálogo de permissões, cliente GAM
  services/
    api/           FastAPI: rotas, dependências de auth e permissão, schemas Pydantic
    workers/       tarefas Celery: email, gam, maintenance + agenda do Beat
  frontend/        Vue 3 SPA (Vite, Vue Router, Pinia)
  deploy/          docker-compose.yml, Caddy ou Nginx, variáveis de ambiente
  tests/
```

A chave da conta de serviço entra como arquivo montado no container a partir de um segredo da VM, nunca versionada no repositório.

## Decisões e perguntas em aberto

Respostas de Pedro em 22/10/2026:

- **Dono da network:** quando a equipe Groone cadastra a network, ela seleciona o cliente proprietário; quando o cliente adiciona por conta própria, a network fica ligada ao id do próprio cliente.
- **E-mail:** os convites saem pelo Resend.
- **Validade do convite:** 1 dia.
- **Dono do cliente:** só pode ser removido ou trocado de papel pelo painel interno.
- **Row Level Security:** ativo já no MVP.

Ainda em aberto:

- [ ] Revisão da matriz de permissões dos papéis pré-definidos no documento de requisitos.
