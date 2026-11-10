# Avant: models do MVP

> Registro da decisão na época em que foi tomada (outubro de 2026). Onde divergir de `docs/contexto.md` ou do código, vale o código.

Oct 22, 2026 · @Pedro

## Visão geral

O MVP tem 18 models em cinco grupos: identidade, empresa e equipe, acesso, GAM e suporte. Tudo gira em torno da **Company** (Empresa): quase toda tabela tem `company_id`, e é por ele que o Row Level Security do Postgres isola um cliente do outro.

&#91;embedded content: models do MVP · 16 em 5 grupos\]

Um User entra numa Company por uma Membership; a Company é dona das networks, e cada network traz seus sites e ad units do GAM.

Decisões que já valem para este desenho:

- Uma tabela única de usuários para equipe Groone e clientes. A equipe Groone é membro de uma Company especial, marcada com `is_internal`.
- Um cliente tem uma Company. Uma pessoa pode ser membro de várias.
- Convite por e-mail vale 1 dia e ocupa vaga até ser aceito ou cancelado.
- Permissões no estilo artesaos/defender, sempre dentro de uma Company.
- O GAM usa uma conta de serviço Groone. Networks, sites e ad units são importados.

Convenções de todas as tabelas: `id` UUID v7, `created_at` e `updated_at` em UTC. Exclusão é lógica (`deleted_at`) só onde o texto disser; nas demais, o registro muda de status.

## Identidade

### User

Uma linha por pessoa, interna ou cliente. O e-mail é único e é a chave do login e do convite.

| Campo | Tipo | Nota |
| --- | --- | --- |
| email | citext, único | minúsculas, sem duplicar |
| name | text |  |
| locale | pt, en ou es | idioma do painel |
| status | active, disabled | disabled bloqueia o login em todas as Companies |
| email\_verified\_at | timestamp | preenchido ao aceitar o convite |
| last\_login\_at | timestamp |  |
| totp\_secret | text cifrado | 2FA; obrigatório para a equipe Groone, opcional para clientes |

O que pode fazer:

- Entrar com senha ou Google e escolher em qual Company trabalhar.
- Editar nome, idioma e senha, e ligar ou desligar o login Google.
- Ver as Companies de que é membro e sair de uma (menos a que é dono).
- Ser desativado só pelo painel interno.

### UserCredential

As formas de login de um User. Separar da tabela de usuários permite senha e Google para a mesma pessoa.

| Campo | Tipo | Nota |
| --- | --- | --- |
| user\_id | FK User |  |
| provider | password, google | um de cada por usuário |
| secret\_hash | text | hash Argon2 da senha; vazio no Google |
| provider\_subject | text | id da conta Google (`sub`); único por provider |
| last\_used\_at | timestamp |  |

O que pode fazer:

- A credencial de senha nasce quando a pessoa aceita o convite e define a senha.
- A credencial Google só pode ser ligada depois disso, com o mesmo e-mail.
- Trocar ou recuperar a senha atualiza o hash e encerra as outras sessões.
- O último login de um usuário não pode ser removido. Toda conta tem senha; o Google é ligado depois, logado, em Configurações.

## Empresa e equipe

### Company

A Empresa de um cliente, ou a Groone. O limite de vagas e o dono só mudam pelo painel interno.

| Campo | Tipo | Nota |
| --- | --- | --- |
| name | text |  |
| slug | text, único | usado na URL |
| owner\_user\_id | FK User | o dono; muda só no painel interno |
| seat\_limit | int | vagas de funcionários, definido pela Groone |
| is\_internal | bool | true só na Company Groone |
| plan | groone\_network, external | rede Groone (grátis) ou cliente de fora (pago) |
| status | active, suspended | suspended bloqueia o acesso de todos os membros |
| accent\_color | text | cor do sistema da Empresa |
| settings | JSONB | preferências que ainda não viraram coluna |

O que pode fazer:

- Ser criada pelo cliente, com o nome que ele escolhe, ao aceitar o convite de dono. O limite de vagas e o plano vêm do convite.
- Ter o nome, a cor e as preferências editados pelo dono ou por quem tem `company.edit`.
- Contar vagas: membros ativos mais convites pendentes, sempre até `seat_limit`.
- Ser suspensa ou reativada só pela Groone. Suspensa, as sincronizações do GAM das suas networks também param.

### Membership

Liga um User a uma Company com um papel. É o que dá acesso.

| Campo | Tipo | Nota |
| --- | --- | --- |
| company\_id | FK Company |  |
| user\_id | FK User | único por Company |
| role\_id | FK Role | um papel só por membro; vazio para o dono |
| status | active, suspended, removed | removed libera a vaga |
| invited\_by | FK User |  |
| joined\_at | timestamp |  |

O que pode fazer:

- Ter o papel trocado por quem tem `team.manage`.
- Ser suspensa (sem acesso, mantém a vaga) ou removida (libera a vaga).
- O dono não pode ser removido nem rebaixado pelo painel do cliente.

### Invitation

O convite por e-mail. Vale 1 dia e ocupa vaga enquanto está pendente. Tem dois tipos: owner (criado pela Groone, sem Company ainda, e leva seat\_limit e plan para a Company que o cliente vai criar) e team (criado dentro de uma Company, leva role\_id).

| Campo | Tipo | Nota |
| --- | --- | --- |
| company\_id | FK Company |  |
| email | citext | único entre os pendentes da Company |
| role\_id | FK Role | papel que a pessoa recebe |
| token\_hash | text | só o hash vai para o banco |
| status | pending, accepted, canceled, expired |  |
| expires\_at | timestamp | criado + 1 dia |
| invited\_by | FK User |  |
| accepted\_at | timestamp |  |

O que pode fazer:

1. Ser criado por quem tem `team.invite`, se houver vaga. O Resend envia o e-mail.
2. Ser reenviado só enquanto está pendente: gera um token novo e renova `expires_at`. Convite expirado não volta; é preciso criar outro.
3. Ser cancelado: libera a vaga.
4. Ser aceito: se o e-mail não tem User, cria User e credencial de senha; se já tem, só cria a Membership.
5. Expirar: uma tarefa do Celery marca `expired` e libera a vaga.

## Acesso

O módulo `core.access` responde uma pergunta: "este membro pode fazer X nesta Company?". Ele soma as permissões do papel, aplica as permissões diretas do membro e ignora as vencidas.

### Permission

O catálogo fixo, definido no código e sincronizado no deploy. O cliente não cria permissões, só combina as existentes.

| Campo | Tipo | Nota |
| --- | --- | --- |
| key | text, único | ex.: `team.invite`, `network.connect`; aceita curinga `team.*` |
| group | text | agrupa na tela de papéis |
| scope | client, internal | internal só vale na Company Groone |
| label | jsonb | nome em PT, EN e ES |

### Role

Papel dentro de uma Company. Os predefinidos são iguais para todos; os personalizados são da Company.

| Campo | Tipo | Nota |
| --- | --- | --- |
| company\_id | FK Company, opcional | vazio = papel predefinido do sistema |
| key | text | ex.: `traffic_manager`, `finance`, `marketing` |
| name | jsonb | nome em PT, EN e ES |
| is\_system | bool | predefinidos não podem ser editados nem apagados |

O que pode fazer:

- Dono e quem tem `roles.manage` criam, editam e apagam papéis personalizados, combinando só permissões do catálogo predefinido.
- Um papel em uso não pode ser apagado; antes é preciso mover os membros.
- Não existe papel de dono: o dono é o `owner_user_id` da Company, tem todas as permissões e vê todos os sites.
- Na Company Groone ficam os papéis internos: Admin, Comercial e Marketing. Admin Groone é o superusuário.

### RolePermission

Tabela de ligação: `role_id` e `permission_key`. A matriz de permissões por papel predefinido continua adiada; o modelo já a suporta.

### MemberPermission

Exceção para uma pessoa, que vence o papel.

| Campo | Tipo | Nota |
| --- | --- | --- |
| membership\_id | FK Membership |  |
| permission\_key | text |  |
| effect | allow, deny | deny tira uma permissão que o papel dá |
| expires\_at | timestamp, opcional | permissão temporária |
| granted\_by | FK User |  |

O frontend recebe a lista final em `GET /me/permissions` e usa `v-can` para esconder botões. A regra que vale é sempre a do backend.

## GAM

### Network

Uma network do Google Ad Manager ligada a uma Company. O `network_code` é único no sistema: uma network tem um dono só.

| Campo | Tipo | Nota |
| --- | --- | --- |
| company\_id | FK Company | dono: escolhido pela Groone ou o cliente que cadastrou |
| network\_code | text, único | ex.: 21987654321 |
| display\_name | text | vem do GAM |
| connection\_type | mcm, service\_account | MCM conecta sozinho; o resto segue o passo a passo |
| status | pending, connected, error, disconnected |  |
| last\_error | text | mensagem mostrada ao lado do problema |
| last\_checked\_at | timestamp |  |
| added\_by | FK User |  |

O que pode fazer:

- Ser criada pelo cliente (`network.connect`) com o network code e o botão "Testar conexão", ou pela Groone ao aceitar o MCM.
- Testar a conexão: confere se a conta de serviço Groone é administradora.
- Disparar a importação de sites e ad units, na conexão e depois em agenda.
- Ser desconectada: para as sincronizações e mantém o histórico.
- Ter o dono trocado só pelo painel interno.

### Site

Um site da network, importado do GAM. O cliente não cria nem apaga sites no Avant.

| Campo | Tipo | Nota |
| --- | --- | --- |
| network\_id | FK Network |  |
| company\_id | FK Company | copiado para o RLS |
| gam\_site\_id | text | único por network |
| domain | text |  |
| approval\_status | text | status de aprovação do GAM |
| synced\_at | timestamp |  |

### AdUnit

Um bloco de anúncio importado, com hierarquia (um ad unit pode ter pai).

| Campo | Tipo | Nota |
| --- | --- | --- |
| network\_id | FK Network |  |
| company\_id | FK Company | copiado para o RLS |
| gam\_ad\_unit\_id | text | único por network |
| parent\_id | FK AdUnit, opcional |  |
| name | text |  |
| ad\_unit\_code | text |  |
| status | active, inactive, archived | como no GAM |
| synced\_at | timestamp |  |

Site e AdUnit só são lidos pelo cliente. Quando somem do GAM, ficam `archived` em vez de apagados, para não perder o histórico de métricas depois.

### NetworkSyncRun

O registro de cada importação feita pelo Celery: `network_id`, `kind` (test, sites, ad\_units), `status` (running, ok, failed), `started_at`, `finished_at`, contagens e erro. É o que a tela de networks mostra como "última sincronização".

### SiteAssignment

Quais sites cada funcionário enxerga. O dono das networks, ou quem tem `sites.assign`, atribui sites a membros; o membro só recebe relatórios, métricas e avisos desses sites.

| Campo | Tipo | Nota |
| --- | --- | --- |
| company\_id | FK Company | para o RLS |
| membership\_id | FK Membership | o funcionário |
| site\_id | FK Site | único com membership\_id |
| assigned\_by | FK User |  |
| created\_at | timestamp |  |

Como funciona:

- Cada Role ganha o campo `site_scope`: `all` (vê todos os sites da Company) ou `assigned` (só os atribuídos). Todos os papéis predefinidos vêm com `assigned`; só o dono vê tudo. O dono pode criar um papel personalizado com `all` para quem deve ver todos os sites. A atribuição é sempre por site, nunca por network inteira.
- Um MemberPermission pode trocar o escopo de uma pessoa sem mudar o papel dela.
- Membro com `assigned` e nenhum site atribuído não vê dado de site nenhum.
- Site novo importado do GAM chega sem atribuição: só quem tem `all` vê até alguém atribuir.
- Ao remover o membro, as atribuições dele são apagadas; ao arquivar o site, elas ficam para o histórico.
- O filtro vale no backend e no banco: a política de RLS das tabelas por site (métricas, relatórios) cruza `site_id` com as atribuições do usuário da sessão.
- Para o recorte por site valer também nos ad units, o AdUnit ganha `site_id` (opcional), ligado pela hierarquia ou pelo nome no GAM.

Permissões novas no catálogo: `sites.view`, `sites.assign` e `reports.view`. Atribuir sites gera linha no AuditLog (`site.assigned`, `site.unassigned`).

## Suporte

### Session

Uma sessão de login, com cookie httpOnly no navegador e o hash do token no banco.

| Campo | Tipo | Nota |
| --- | --- | --- |
| user\_id | FK User |  |
| active\_company\_id | FK Company | a Empresa escolhida no seletor da navbar |
| token\_hash | text |  |
| ip, user\_agent | text | mostrados em "sessões ativas" |
| mfa\_verified\_at | timestamp | exigido para abrir o painel interno |
| expires\_at, revoked\_at | timestamp |  |

O que pode fazer: trocar a Company ativa (só entre as que a pessoa é membro), ser encerrada pela própria pessoa e ser encerrada em massa ao trocar a senha ou desativar o User.

### PasswordReset

Token de recuperação de senha: `user_id`, `token_hash`, `expires_at` (1 hora) e `used_at`. Usa uma vez só.

### AuditLog

Registro do que foi feito, por quem, em qual Company. Só recebe linhas novas, nunca edita.

| Campo | Tipo | Nota |
| --- | --- | --- |
| company\_id | FK Company |  |
| actor\_user\_id | FK User |  |
| action | text | ex.: `invite.sent`, `role.changed`, `network.connected`, `owner.changed` |
| target\_type, target\_id | text, UUID | o registro afetado |
| changes | JSONB | antes e depois |
| ip | text |  |

Toda ação feita pela equipe Groone dentro de uma Company de cliente gera uma linha, além das ações de equipe e de network do próprio cliente.

### ApiKey

Chave de API de um membro, porque o Avant é API first. Detalhes no [documento dos endpoints](https://claude.ai/artifact/YWMmSvEW9xbVuG5gnbvd5Y).

| Campo | Tipo | Nota |
| --- | --- | --- |
| company\_id | FK Company | a Empresa ativa da chave |
| membership\_id | FK Membership | dono da chave; removido ou suspenso, a chave para |
| name | text |  |
| prefix | text | 8 primeiros caracteres, para reconhecer |
| secret\_hash | text | o valor só aparece na criação |
| permissions | text\[\] | igual ou menor que as do membro |
| expires\_at | timestamp | até 1 ano |
| last\_used\_at, revoked\_at | timestamp |  |

## Decisões de Pedro (22/10/2026)

| Pergunta | Decisão |
| --- | --- |
| Dono: campo ou papel? | Só o campo owner\_user\_id; não há papel de dono |
| Papéis por membro | Um só |
| Permissões dos papéis personalizados | Só as do catálogo predefinido |
| Convite expirado | Exige um convite novo |
| 2FA | Obrigatório para a equipe Groone, opcional para clientes |
| Company suspensa | As sincronizações do GAM param |
| Network em mais de uma Company | Não; uma network pertence a uma Company só |
| Atribuição de sites | Só por site |
| Quem vê todos os sites | Só o dono; ele pode criar um papel personalizado com acesso a todos |

Nenhuma pergunta em aberto nos models. A matriz de permissões de cada papel predefinido continua adiada.
