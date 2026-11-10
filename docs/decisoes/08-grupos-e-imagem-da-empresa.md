# Avant: grupos na Empresa e imagem da Empresa

> Registro da decisão na época em que foi tomada (outubro de 2026). Onde divergir de `docs/contexto.md` ou do código, vale o código.

Oct 26, 2026 · @Pedro

Doc de origem: https://claude.ai/artifact/AoxAu9E4XNQhCCmaxVjLRe. Milestone: **M6 Grupos e comissão**.

## Resumo

Um cliente tem uma Empresa, e a Empresa pode ter vários grupos de funcionários. Todo grupo nasce com pelo menos uma pessoa, conferida antes de criar e atribuída no momento da criação. O grupo carrega comissão e meta mensal, que os membros herdam. Grupo não mexe em papel nem em permissão e não ocupa vaga. Toda Empresa também pode ter uma imagem (ícone), trocada pelo cliente e pela equipe Groone.

A comissão do grupo é a do funcionário. Ela não tem relação com a comissão de indicação entre Empresas (2%, em `company_profiles`), que não muda.

## Decisões do Pedro (26/10)

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Pessoa em vários grupos? | Um grupo por pessoa. |
| 2 | Último membro sai da Empresa | O grupo fica inativo e o cliente escolhe se exclui. Adicionar alguém reativa. |
| 3 | Base da comissão | % × (receita − (revshare Groone + custo)) dos sites que o funcionário controla. |
| 4 | Meta | Escolha no grupo: "meta por funcionário" ou "meta dividida pelos funcionários do grupo". |
| 5 | O grupo dá sites? | Não. O grupo só tem funcionários vinculados, por enquanto. |
| 6 | Permissão própria para comissão e meta? | Sim: `groups.compensation`. |
| 7 | A Empresa Groone usa grupos? | Sim, para projetos de comissão de um mês específico, como as bonificações (`employee_tasks`) do Genius. Falta detalhar. |
| 8 | Milestone | Novo: M6 Grupos e comissão. |

## Modelo de dados

| Tabela | Colunas | Observação |
|---|---|---|
| `member_groups` (nova) | id, company_id, name, description, status, commission_percentage, goal_template_id, goal_mode, created_by, created_at | Nome único por Empresa. Status `active` ou `inactive`. Comissão e meta vazias = herda da Empresa. `goal_mode`: `per_member` ou `split`. |
| `group_members` (nova) | id, company_id, group_id, membership_id, added_by, added_at | Índice único em `membership_id` (um grupo por pessoa). Aponta para `memberships`. |
| `goal_templates` (nova) | id, company_id, name, currency, um valor por mês | Como `goal_templates` do Genius. |
| `company_images` (nova) | company_id, content, content_type, sha256, updated_by, updated_at | WebP 256×256. |
| `companies` (muda) | default_commission_percentage, default_goal_template_id | Padrão da Empresa. |
| `memberships` (muda) | commission_percentage, goal_template_id | Exceção do membro. |

Todas com `company_id` e RLS. Uma constraint trigger `DEFERRABLE INITIALLY DEFERRED` recusa, no commit, grupo ativo sem membro.

## Regras

1. Criar exige pelo menos um membro ativo ou suspenso da Empresa, na mesma transação (`GroupNeedsMember`). O dono pode entrar; convite pendente não.
2. Tirar o último membro pela tela do grupo é recusado (409); a tela oferece "Excluir grupo".
3. Membro que sai da Empresa sai do grupo. Se o grupo ficar vazio, vira inativo (`group.deactivated`, motivo `last_member_left`).
4. Membro suspenso continua no grupo.
5. Excluir grupo é sempre permitido; os membros voltam ao padrão da Empresa.
6. Permissões: `groups.view`, `groups.manage`, `groups.compensation`. O dono tem todas; nenhum papel predefinido recebe `groups.compensation`.
7. Auditoria: `group.created`, `group.updated`, `group.member_added`, `group.member_removed`, `group.deactivated`, `group.deleted`.

## Herança de comissão e meta

Vale o primeiro valor preenchido, calculado na hora da consulta: exceção do membro, depois o grupo, depois o padrão da Empresa; sem nenhum, sem comissão ou meta. A tela mostra a origem do valor.

- Comissão: % × (receita − (revshare Groone + custo)) dos sites atribuídos ao membro (`site_assignments`), com o revshare do contrato ativo. Ainda aberto: custos são da Empresa inteira; a proposta é ratear o custo do mês pela fatia de faturamento de cada site.
- Meta: modelo mensal; `per_member` dá o valor inteiro a cada um, `split` divide pelos membros ativos do grupo.
- No fechamento do mês, percentual e meta ficam congelados no registro da comissão.

## Imagem da Empresa

- Guardada no Postgres. A API aceita PNG, JPEG ou WebP de até 2 MB, corta em quadrado e grava em WebP 256×256.
- Quem troca: o cliente (`company.edit`), a equipe Groone para qualquer cliente (`internal.clients.manage`) e a Empresa Groone pelo caminho do cliente.
- Rotas: `GET/PUT/DELETE /company/image` e `/internal/clients/{id}/image`, com `ETag` e URL versionada.
- Aparece no seletor de Empresa, no topo da sidebar e na lista de clientes. Sem imagem, fica a inicial do nome sobre a cor da Empresa.

## Telas

Grupos ficam numa aba de Equipe (`/equipe/grupos`); a sidebar não muda. Diálogo "Novo grupo" com seletor de membros obrigatório, página do grupo e compensação na página do membro. Protótipo primeiro (avant-web#58).

## Issues

- avant-core: #53 grupos, #54 comissão e meta herdadas, #55 imagem, #56 cálculo da comissão, #57 projetos de comissão do mês
- avant-api: #50 rotas de grupos e compensação, #51 rotas da imagem
- avant-web: #58 protótipo, #59 telas de grupos, #60 imagem
- avant-worker: #31 tarefa diária da comissão
