# 10. M5 no painel interno da Groone (plano)

**Estado:** proposta de 31/10/2026, execução a partir de segunda, 02/11. As perguntas do fim
precisam da resposta do Pedro; até lá vale a recomendação de cada uma.

Pedido do Pedro (31/10): "vamos iniciar a M5 para o painel interno da equipe GroOne, mas só
monte o planejamento". Isso segue a decisão de 30/10 de fazer primeiro o painel interno; as
funcionalidades do painel do cliente (M6) foram para Pós-MVP.

## O que já existe

- Métricas personalizadas (core#14), construtor de relatórios e relatórios salvos (core#15),
  com miniatura guardada, fixados (até 12 por pessoa) e tela de leitura (core v0.51.0).
- Metas da equipe Groone (decisão 09, core#109): modelo de meta mensal no papel (por pessoa ou
  dividida), meta da Empresa Groone medida pela receita da Groone, tela `/interno/metas`.
- Resultado dos clientes (`/interno/resultados`), que já lê todas as Empresas cliente com
  `bypass_rls`.

## O buraco que vem antes de tudo

O motor de consulta filtra pela Empresa ativa (`company_id == actor.company_id`). Na Company
Groone não há métricas de cliente, então Ad Manager, Page Views, relatórios customizados e
qualquer dashboard da equipe Groone saem vazios. Para a M5 servir ao painel interno, a primeira
entrega é o motor somar todas as Empresas cliente quando a Empresa ativa é a Groone, com as
dimensões "Cliente" e "Responsável" (o `account_manager_id` do cliente). Issues novas:
core#163, api#116, web#141.

## Escopo proposto

| # | Funcionalidade | Issues | No painel interno |
|---|---|---|---|
| 1 | Relatórios sobre todos os clientes | core#163, api#116, web#141 | Base de tudo abaixo |
| 2 | Dashboards | core#16, api#19, web#14 | Vários dashboards da Groone em grade; widgets de relatório salvo, KPI, texto e **progresso de meta** (as metas da decisão 09). Filtros do dashboard: período, clientes, responsável, networks. Modelos: Visão geral da Groone, Por responsável, Por cliente. Um dashboard padrão da Groone e preferência por pessoa |
| 3 | Categoria do site | core#21, api#24, web#19 | Só a categoria, definida pela equipe Groone; vira dimensão e filtro nos relatórios de todos os clientes. O "responsável do site" (membro do cliente) fica para o painel do cliente |
| 4 | Alertas de métrica | core#19, worker#8, api#22, web#17 | Ex.: "receita do cliente X caiu mais de 20% contra a média de 7 dias", "fill rate da network Y abaixo de 60%". Destinatários só da equipe Groone, por e-mail |
| 5 | Envio agendado | core#20, worker#9, api#23, web#18 | Relatório ou dashboard da Groone por e-mail, diário, semanal ou mensal, para pessoas da equipe Groone. Resumo no corpo e CSV anexo; PDF depois |
| 6 | Visões salvas | core#22, api#25, web#20 | Nas tabelas internas: Clientes, Contratos, Resultado dos clientes, Comissões, Invoices |

**Saem da M5 (proposta: Pós-MVP)**

- Páginas de relatório no menu (core#17, api#20, web#15): o menu é imutável (decisão de
  24/10). Dashboards com nome, lista e fixados cobrem o mesmo uso na Groone.
- Metas (core#18, api#21, web#16): a decisão 09 já cobre as metas do painel interno. O que
  falta delas (o widget de progresso) entra nos dashboards. Proposta: fechar as três como
  cobertas pela decisão 09.
- Tema e marca da Empresa (core#23, api#26, web#21) e api#15 (accent nulo): são do cliente; a
  Groone já tem a marca dela.

## Ordem e estimativa

Cada funcionalidade: core (tag nova), depois api e worker, por fim web. Tela nova primeiro no
protótipo (`avant-web/design/`), que o Pedro aprova antes do código.

| Semana | Entrega |
|---|---|
| 02/11 a 04/11 | 1. Relatórios sobre todos os clientes (core, api, web) e protótipo dos dashboards |
| 04/11 a 10/11 | 2. Dashboards (core, api, web), com o widget de meta |
| 10/11 | 3. Categoria do site |
| 11/11 a 14/11 | 4. Alertas (com a tarefa do worker) |
| 16/11 a 19/11 | 5. Envio agendado (com a tarefa do worker) |
| 19/11 a 21/11 | 6. Visões salvas nas tabelas internas |

Regras que continuam valendo: definições em JSONB com `schema_version` validadas no core;
visibilidade `privado`, `Empresa inteira` ou `papéis escolhidos` (aqui, papéis da equipe Groone);
paginação de 10 itens; clean code; textos em PT, EN e ES.

## Perguntas para o Pedro

1. **Quem da equipe vê quais clientes nos relatórios?** Recomendo: permissão interna nova
   `internal.reports.all` vê todos os clientes; sem ela, a pessoa vê só os clientes de que é
   responsável (como a régua das metas).
2. **Onde ficam os dashboards no menu?** Recomendo: o Início da equipe Groone abre o dashboard
   padrão, e um item novo "Dashboards" só da equipe Groone no grupo Relatórios.
3. **Páginas de relatório no menu e Tema e marca para Pós-MVP?** Recomendo que sim.
4. **Fechar as issues de Metas (core#18, api#21, web#16) como cobertas pela decisão 09?**
   Recomendo que sim, com o widget de meta dentro dos dashboards.
5. **Categoria do site:** só a equipe Groone define (recomendo), ou o cliente também, com
   `sites.manage`?
6. **Alertas e envios só por e-mail** no começo (recomendo), ou também um aviso dentro do painel?
7. **M1 Staging (prazo 06/11)** ainda tem avant-infra#4 a #11 abertas: a M5 anda junto, ou a M1
   vem primeiro na semana de 02/11?

Depois das respostas: atualizar as issues (escopo do painel interno, mover as que saem para
Pós-MVP) e a linha da M5 no `docs/contexto.md` dos cinco repositórios.
