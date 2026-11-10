# Avant: endpoints da API do MVP

> Registro da decisão na época em que foi tomada (outubro de 2026). Onde divergir de `docs/contexto.md` ou do código, vale o código.

Oct 23, 2026 · @Pedro

## Convenções

O MVP tem cerca de 80 rotas REST em `/api/v1`, num serviço FastAPI só. As de autenticação estão no [documento de login](https://claude.ai/artifact/ErKHgj8puoFooDwBK8JB4e) e não se repetem aqui.

- **Empresa ativa vem da sessão**, não da URL. Rotas do cliente não têm `company_id` no caminho: `GET /members` já é "membros da Empresa ativa". Isso evita que alguém troque o id na URL para ver outra Empresa, e o RLS do Postgres usa o mesmo valor.
- **Painel interno** fica em `/api/v1/internal/...`, só para quem tem papel na Company Groone e 2FA verificado na sessão.
- **Permissão** de cada rota é declarada no código (`Depends(require("team.invite"))`). A coluna Permissão abaixo é o contrato. "Membro" quer dizer qualquer membro ativo.
- **Recorte por site:** rotas que devolvem sites, ad units ou dados por site filtram pelos sites atribuídos quando o papel é `assigned`.
- **Paginação** por cursor: `?limit=50&cursor=...`, resposta `{ "items": [...], "next_cursor": "..." }`. Limite máximo de 200.
- **Filtros e busca** por query string: `?status=active&q=maria`.
- **Erros** sempre em `{ "error": { "code": "seat_limit_reached", "message": "...", "details": {} } }`. O frontend traduz pelo `code`. 401 sem sessão, 403 sem permissão, 404 também quando o recurso é de outra Empresa, 409 para conflito, 422 para validação, 429 para limite.
- **Idempotência:** POSTs que disparam e-mail ou tarefa (convite, sincronizar) aceitam o cabeçalho `Idempotency-Key`, para clique duplo não duplicar.
- **Datas** em ISO 8601 UTC; o frontend converte para o fuso da pessoa.
- **Documentação** gerada pelo próprio FastAPI (OpenAPI), e os tipos do Vue gerados a partir dela.

## API first e chaves de API

O Avant é API first: o painel Vue não tem nenhuma rota própria, e tudo o que ele faz um cliente pode fazer pela mesma API, com uma chave. A documentação OpenAPI fica pública em `avant.groone.com/api/docs`.

- **Duas formas de entrar:** cookie de sessão (o painel) ou cabeçalho `Authorization: Bearer avk_...` (integrações). As rotas, as permissões e o recorte por site são os mesmos.
- **A chave pertence a um membro e a uma Empresa.** Ela só pode ter as permissões que o membro tem, ou menos, e herda os sites atribuídos a ele. A Empresa ativa é a da chave.
- **Validade:** até 1 ano, revogável a qualquer momento. Membro removido ou suspenso: as chaves dele param na hora.
- **O valor aparece uma vez só**, na criação. O banco guarda o hash e os primeiros 8 caracteres para a pessoa reconhecer a chave.
- **Fora do alcance das chaves:** login, 2FA, senha, sessões, criação de outras chaves e todo o `/internal`.
- **Limite:** balde de fichas por chave (decidido por Pedro). Recarrega 2 requisições por segundo e guarda até 20 para rajadas. Passou, recebe `429` com `Retry-After`. Se a chave tomar mais de 20 respostas 429 em 1 minuto, fica 30 segundos inativa. Contadores no Redis, valendo para todas as instâncias, e cabeçalhos `X-RateLimit-*` em toda resposta.
- **Contrato estável:** mudanças que quebram vão para `/api/v2`, e a `v1` continua no ar por pelo menos 6 meses depois do aviso.

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /api-keys` | chaves da Empresa ativa (quem tem `api_keys.manage` vê todas; os outros, só as próprias) | membro |
| `POST /api-keys` | cria chave: nome, permissões e validade; só por sessão | `api_keys.manage` |
| `DELETE /api-keys/{id}` | revoga | dono da chave ou `api_keys.manage` |

Novo model **ApiKey**: `company_id`, `membership_id`, `name`, `prefix`, `secret_hash`, `permissions`, `expires_at`, `last_used_at`, `revoked_at`. Criar e revogar chaves entra no AuditLog.

## Catálogo de permissões

São 22 permissões: 16 para clientes e 6 internas. A 16ª é api\_keys.manage (criar chaves e ver as de todos), descrita em API first. Os papéis personalizados combinam as de cliente. O dono tem todas, e o Admin Groone tem todas as internas.

| Permissão | Deixa fazer | Escopo |
| --- | --- | --- |
| `company.edit` | editar nome, cor e preferências da Empresa | cliente |
| `team.view` | ver membros e convites | cliente |
| `team.invite` | convidar, reenviar e cancelar convites | cliente |
| `team.manage` | trocar papel, suspender e remover membros | cliente |
| `roles.view` | ver papéis e suas permissões | cliente |
| `roles.manage` | criar, editar e apagar papéis personalizados | cliente |
| `permissions.grant` | dar ou tirar permissão direta de um membro | cliente |
| `network.view` | ver networks e o histórico de sincronização | cliente |
| `network.connect` | conectar network pela conta de serviço | cliente |
| `network.sync` | usar o botão "Sincronizar agora" | cliente |
| `network.disconnect` | desconectar uma network | cliente |
| `sites.view` | ver sites e ad units (respeitando o recorte por site) | cliente |
| `sites.assign` | atribuir sites a membros e ligar ad units a sites | cliente |
| `reports.view` | ver relatórios e métricas (usado depois do MVP) | cliente |
| `audit.view` | ver o histórico de ações da Empresa | cliente |
| `internal.clients.view` | ver clientes e suas páginas de suporte | interno |
| `internal.clients.manage` | convidar dono, mudar vagas e plano, suspender | interno |
| `internal.owner.change` | trocar o dono de uma Empresa | interno |
| `internal.networks.assign` | escolher o cliente das networks MCM sem dono | interno |
| `internal.users.manage` | desativar pessoas e zerar 2FA | interno |
| `internal.staff.manage` | gerenciar a equipe Groone e seus papéis | interno |

Todo membro ativo, sem permissão nenhuma, ainda pode ver a própria conta, a Empresa ativa (nome e cor) e a tela inicial.

## Empresa e equipe

### Empresa

| Rota | Faz | Permissão |
| --- | --- | --- |
| `POST /companies` | cria a Empresa ao aceitar o convite de dono (nome e cor) | convite de dono válido |
| `GET /company` | Empresa ativa: nome, cor, plano, vagas usadas e limite | membro |
| `PATCH /company` | edita nome, cor e preferências | `company.edit` |

### Membros

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /members` | lista com papel, status e data de entrada; filtros `status`, `role`, `q` | `team.view` |
| `GET /members/{id}` | detalhe, com permissões diretas e sites atribuídos | `team.view` |
| `PATCH /members/{id}` | troca o papel ou suspende/reativa | `team.manage` |
| `DELETE /members/{id}` | remove e libera a vaga | `team.manage` |
| `POST /members/me/leave` | sair da Empresa (o dono não pode) | membro |

Ninguém altera o dono nem a si mesmo por essas rotas (`409 cannot_change_owner`, `409 cannot_change_self`).

### Convites

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /invitations` | convites pendentes, com quem convidou e quando expira | `team.view` |
| `POST /invitations` | convida por e-mail e papel; `409 seat_limit_reached` sem vaga, `409 already_member` | `team.invite` |
| `POST /invitations/{id}/resend` | novo token e mais 1 dia; só se pendente | `team.invite` |
| `DELETE /invitations/{id}` | cancela e libera a vaga | `team.invite` |

### Papéis e permissões

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /permissions` | catálogo de permissões de cliente, com nomes em PT/EN/ES | `roles.view` |
| `GET /roles` | predefinidos e personalizados, com quantos membros cada um tem | `roles.view` |
| `POST /roles` | cria papel personalizado: nome, permissões e `site_scope` | `roles.manage` |
| `PATCH /roles/{id}` | edita papel personalizado | `roles.manage` |
| `DELETE /roles/{id}` | apaga; `409 role_in_use` se tiver membros | `roles.manage` |
| `PUT /members/{id}/permissions` | define as permissões diretas do membro (allow/deny, validade) | `permissions.grant` |

Um papel personalizado não pode incluir `permissions.grant` nem `roles.manage` se quem cria não tiver essas permissões, para ninguém dar a si mais do que tem (pergunta 1).

## GAM

### Networks

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /networks` | lista com status, tipo de conexão, última sincronização e erro | `network.view` |
| `GET /networks/service-account` | e-mail da conta de serviço Groone para o passo a passo | `network.connect` |
| `POST /networks/test` | roda as 4 verificações sem salvar nada; devolve o resultado de cada uma | `network.connect` |
| `POST /networks` | conecta pelo network code: testa de novo, cria e dispara a importação | `network.connect` |
| `GET /networks/{id}` | detalhe com contagem de sites e ad units | `network.view` |
| `POST /networks/{id}/sync` | "Sincronizar agora"; `429` se já rodou há menos de 10 minutos | `network.sync` |
| `GET /networks/{id}/sync-runs` | histórico de importações | `network.view` |
| `POST /networks/{id}/disconnect` | desconecta; para as sincronizações e mantém o histórico | `network.disconnect` |

**Avisos em tempo real por SSE** (EventSource): o Vue abre `GET /events` uma vez e recebe eventos como `network.updated` e `sync_run.updated` enquanto um teste ou importação roda. Como o servidor só envia, SSE basta: usa o cookie da sessão, reconecta sozinho e passa por proxies HTTP comuns. Os workers do Celery publicam os eventos no Redis (pub/sub), e qualquer uma das instâncias da API os repassa, então funciona com o blue-green e com duas instâncias. Cada pessoa só recebe eventos da Empresa ativa e dos sites que ela vê. No proxy, o `/events` precisa de buffering desligado. Integrações com chave de API podem usar o mesmo `/events` ou consultar `GET /networks/{id}`.

### Sites e ad units

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /sites` | sites da Empresa (ou só os atribuídos); filtros `network`, `approval_status`, `q` | `sites.view` |
| `GET /sites/{id}` | detalhe, com ad units e quem tem o site atribuído | `sites.view` |
| `GET /ad-units` | lista em árvore; filtros `network`, `site`, `status`, `unlinked=true` | `sites.view` |
| `PATCH /ad-units/{id}` | liga ou desliga o ad unit de um site à mão | `sites.assign` |

### Atribuição de sites

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /members/{id}/sites` | sites atribuídos a um membro | `team.view` |
| `PUT /members/{id}/sites` | define a lista inteira de sites do membro | `sites.assign` |
| `GET /sites/{id}/members` | membros que veem o site | `sites.assign` |

O `PUT` com a lista inteira serve para a tela de checkboxes: o frontend manda o estado final, e o backend calcula o que entrou e o que saiu para o AuditLog.

## Painel interno

Tudo em `/api/v1/internal`. Exige papel na Company Groone e 2FA verificado. A Groone nunca entra na Empresa do cliente: as páginas de suporte só leem.

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /internal/clients` | clientes com dono, plano, vagas, networks e status; filtros e busca | `internal.clients.view` |
| `POST /internal/clients` | cadastra cliente: e-mail do dono, vagas e plano; envia o convite de dono | `internal.clients.manage` |
| `GET /internal/clients/{id}` | página de suporte: Empresa, membros, convites, networks | `internal.clients.view` |
| `GET /internal/clients/{id}/sync-runs` | histórico de importações de todas as networks do cliente | `internal.clients.view` |
| `GET /internal/clients/{id}/audit` | AuditLog da Empresa | `internal.clients.view` |
| `PATCH /internal/clients/{id}` | muda vagas e plano; `409` se o novo limite for menor que as vagas usadas | `internal.clients.manage` |
| `POST /internal/clients/{id}/suspend` e `/reactivate` | suspende ou reativa a Empresa (e as sincronizações) | `internal.clients.manage` |
| `POST /internal/clients/{id}/owner` | troca o dono por outro membro da Empresa | `internal.owner.change` |
| `GET /internal/owner-invitations` | convites de dono pendentes ou expirados, com reenviar e cancelar | `internal.clients.view` |
| `GET /internal/networks/unassigned` | fila "MCM sem dono" | `internal.networks.assign` |
| `POST /internal/networks/{id}/assign` | liga uma network MCM a um cliente | `internal.networks.assign` |
| `GET /internal/users?q=` | busca pessoas por e-mail, com as Empresas de cada uma | `internal.users.manage` |
| `POST /internal/users/{id}/disable` e `/enable` | desativa ou reativa uma pessoa em todo o Avant | `internal.users.manage` |
| `POST /internal/users/{id}/reset-mfa` | zera o 2FA | `internal.users.manage` |
| `GET /internal/staff` e `POST /internal/staff/invitations` | equipe Groone e convites para ela | `internal.staff.manage` |

Toda chamada que altera algo aqui grava no AuditLog da Empresa afetada com o autor Groone, e o dono pode ver essas linhas no histórico dele.

## Suporte e operação

| Rota | Faz | Permissão |
| --- | --- | --- |
| `GET /audit` | histórico de ações da Empresa ativa; filtros `actor`, `action`, `from`, `to` | `audit.view` |
| `GET /home` | dados da tela inicial: vagas, networks com problema, convites pendentes | membro |
| `POST /client-errors` | o Vue manda erros de JavaScript para o log (sem dados pessoais) | membro, com limite |
| `GET /health` | o processo está de pé (para o blue-green do Jenkins) | nenhuma |
| `GET /ready` | banco, Redis e RabbitMQ respondem | nenhuma |
| `GET /metrics` | métricas do Prometheus; só acessível pela rede interna das VMs | nenhuma, só rede interna |

Ao todo são 61 rotas neste documento (com as 3 de chaves de API e o /events) e 18 de autenticação, 79 no total.

## Decisões de Pedro (23/10/2026)

| Pergunta | Decisão |
| --- | --- |
| Papel personalizado com permissões que o criador não tem | Não pode |
| Idioma das rotas | Sempre em inglês; só a tela em PT/EN/ES |
| Avisos em tempo real | SSE (EventSource) no lugar de consulta periódica ou WebSocket |
| API pública | A aplicação inteira é API first, com chaves de API desde o MVP |
