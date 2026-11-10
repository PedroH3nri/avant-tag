# Comissão da equipe Groone

Oct 27, 2026 · @Pedro

## Resumo

As regras de comissão ficam no **papel da Equipe Groone** (Pedro, 27/10): ao cadastrar o papel, define-se se conta por cliente, network ou site, o percentual, a duração em dias e os dias de espera para começar e, quando conta por cliente, o papel para onde o cliente vai no fim do prazo. A base é sempre o revshare da Groone, como no Genius. No Genius só o percentual é editável e o prazo de 30 dias está fixo no código.

Quem recebe é o **responsável Groone do cliente** (`account_manager_id`, que já existe no cadastro do cliente). A comissão é calculada todo dia, como no Genius, e fecha no dia 15 do mês seguinte, depois das deduções do GAM. Isso é diferente da comissão de funcionários dos clientes (grupos, core#54) e da indicação entre Empresas (2%). **Os 7 pontos em Decisões estão respondidos (27/10)**.

## Como o Genius faz hoje

No Genius o percentual fica em `users.comissao`, um por pessoa, e o prazo é de 30 dias fixos no código (`EmployeeCommissionSync`, `addDays(30)`).

| Ponto | Genius |
| --- | --- |
| Quem recebe | Usuários com papel 8 (comercial interno) ou 10 (comercial externo), ligados ao publisher por `mcm_publishers.id_user` |
| Percentual | `users.comissao`, único por pessoa |
| Prazo | 30 dias fixos a partir do início (o intervalo inclui os dois extremos, então dá 31 dias de relatório) |
| Início do prazo (comercial interno) | Data de retenção do site (`mcm_sites.retention_date`) ou criação da network (`mcm_admanager.created_at`) |
| Início do prazo (comercial externo) | Criação do publisher (`mcm_publishers.created_at`) |
| Base | `earnings` do relatório do Ad Manager do dia, a receita da Groone na network |
| Cálculo | Todo dia, a cada hora e de novo às 03:00 para os dois últimos dias, em `employee_commissions` com status `DRAFT` |
| Deduções | Dia 15: dedução do `Mcm_Earnings` × revshare × percentual da pessoa (`employee_deductions`) |
| Fechamento | Dia 15: recalcula o mês com o percentual atual da pessoa e marca `VALIDATED`; depois vira `ISSUED` na nota |

Dois problemas para não repetir: o fechamento usa o percentual de hoje, então mudar o percentual de alguém muda o mês passado ainda aberto. E a dedução também usa o percentual de hoje.

## Proposta

A proposta é guardar as **regras de comissão no papel** da Equipe Groone. Quem tem o papel segue as regras dele, e elas são congeladas em cada prazo no dia em que ele começa.

**Regras no papel** (Pedro, 27/10). Ao criar ou editar um papel da Equipe Groone, dá para ligar "Recebe comissão" e preencher:

- **Contar por:** cliente, network ou site. É o que abre um prazo de comissão.
- **Percentual que vai receber:** de 0,01% a 100%, com duas casas.
- **Dias para começar a contar:** o prazo começa X dias depois do evento.
- **Dias recebendo a comissão:** de 1 a 3650, ou vazio para comissão sem prazo.
- **Transferir para o papel** (só quando conta por cliente): quando o prazo acaba, o cliente passa para uma pessoa de outro papel, por exemplo do comercial externo para o interno.

A base não é um campo: é sempre o revshare da Groone, a fatia do contrato ativo na receita bruta da network, igual ao earnings do Genius.

| Contar por | O prazo começa em | Uso típico |
| --- | --- | --- |
| Cliente | Cadastro do cliente, ou a reativação dele quando volta para a Groone, + X dias | Comercial externo, e o interno que trouxe o cliente de volta |
| Network | Reativação da network que tinha saído da Groone com o cliente ainda na Groone, + X dias | Comercial interno |
| Site | Aprovação do site no GAM, ou a reativação dele, + X dias | Comercial interno que recuperou um site |

Exemplo: papel "Comercial externo", conta por cliente, 5%, começa depois de 7 dias, recebe por 30 dias, transfere para "Comercial interno". Cliente cadastrado em 1/11: comissão de 8/11 a 7/12, e em 8/12 o responsável do cliente passa a ser alguém do papel "Comercial interno".

Para isso o Avant precisa guardar as datas de reativação do cliente, da network e do site. Hoje só guarda o status atual. Reativação (retenção) só conta se o cliente, a network ou o site ficou pelo menos 30 dias inativo (Pedro, 27/10); menos que isso não abre prazo novo. Na transferência, o cliente vai para a pessoa do papel escolhido com menos clientes vinculados, igual no Genius.

**Pessoa e papel.** A pessoa recebe comissão pelas regras do papel dela na Equipe Groone; papel sem "Recebe comissão" não gera nada. Se precisar, um percentual ou uma duração próprios da pessoa sobrepõem os do papel, como no Genius, onde o percentual é por pessoa.

**Quem recebe.** Recebe o responsável Groone do cliente (`account_manager_id`, que já existe no cadastro). Se o responsável mudar, quem já tinha prazos abertos continua com eles, e o novo responsável só ganha os prazos que começarem depois.

**Mudança de regra.** Quando o prazo de um cliente, network ou site começa, o sistema grava a data de início. Mudar as regras do papel vale também para os prazos em andamento, do dia da mudança em diante (Pedro, 27/10): o novo percentual entra nos dias seguintes e a nova duração recalcula o fim. Cada dia já calculado guarda o percentual usado, então os dias anteriores e o mês fechado não mudam. O Genius, ao contrário, recalcula o mês aberto inteiro com o percentual de hoje.

**Cálculo e fechamento.**

1. Todo dia o worker calcula a comissão de cada dia dentro do prazo, com a receita daquele dia. Fica como rascunho.
2. No dia 15, depois da sincronização do `Mcm_Earnings`, aplica a dedução do mês anterior na mesma proporção e fecha o mês como validado.
3. A equipe financeira marca como paga.

**Telas.** As telas previstas são três:

- As regras ficam no cadastro do papel em Papéis e permissões da Equipe Groone (seção "Comissão"), e o ajuste por pessoa fica na Equipe Groone.
- Cada pessoa vê a própria comissão em "Minha comissão": prazos abertos com a data de fim, valor do mês e histórico.
- O financeiro vê a comissão de todo mundo por mês.

## Decisões em aberto

São sete perguntas, cada uma com a minha recomendação.

| # | Pergunta | Recomendação |
| --- | --- | --- |
| 1 | Quando o prazo começa a contar? | Respondida: o papel escolhe contar por cliente, network ou site, com X dias de espera. |
| 2 | O que é a "retenção de site" do Genius (`mcm_sites.retention`) e ela deve existir no Avant? | Respondida na prática: no Avant ela vira a reativação da network ou do cliente. Vale para cliente, network e site, e só depois de pelo menos 30 dias inativo. |
| 3 | Base da comissão: receita da Groone (revshare) ou receita total da network? | Respondida: sempre o revshare da Groone, como no Genius, menos a parte dela nas deduções do GAM. |
| 4 | Mudar as regras do papel muda os prazos que já estão correndo? | Respondida: muda, do dia da mudança em diante. Os dias anteriores e os meses fechados não mudam. |
| 5 | Vale ter faixas, por exemplo 10% nos primeiros 30 dias e 5% até o dia 90? | Respondida: não. Um percentual só por papel. |
| 6 | Um cliente pode ter mais de um comercial recebendo, por exemplo interno e externo juntos? | Respondida: não. Um só, o responsável do cliente, como no Genius. |
| 7 | Quem vê e edita? | Respondida: aprovada. Permissões novas: `internal.commissions.manage` para as regras dos papéis e o ajuste por pessoa, `internal.commissions.view` para o financeiro. Cada pessoa sempre vê a própria comissão. |

## Como implementar

O trabalho fica em quatro repositórios, sob o milestone M6 Grupos e comissão, e começa depois das respostas acima.

**Tabelas novas** (schema `metrics` para os valores; só a Company Groone usa, então sem RLS por Empresa):

| Tabela | Campos principais |
| --- | --- |
| `role_commission_rules` | role\_id (papel da Company Groone), counts\_by (client, network, site), transfer\_to\_role\_id (só para client), percentage, duration\_days (vazio = sem prazo), start\_offset\_days |
| `staff_commission_settings` | user\_id, percentage e duration\_days próprios (vazios = do papel) |
| `commission_windows` | user\_id, counts\_by, company\_id, network\_id e site\_id conforme o tipo, starts\_at, ends\_at (recalculado se a duração do papel mudar) |
| `staff_commissions_daily` | window\_id, date, percentage usado no dia, base\_micros, commission\_micros, status (`draft`, `validated`, `issued`, `paid`) |
| `staff_commission_deductions` | window\_id, month, deduction\_micros |

**Issues previstas:**

1. avant-core: regras de comissão no papel, ajuste por pessoa, datas de reativação do cliente, da network e do site, transferência do cliente no fim do prazo, abertura dos prazos, cálculo diário, dedução e fechamento, e as duas permissões novas.
2. avant-worker: tarefa diária (a cada hora o dia de hoje, e às 03:00 os dois dias anteriores) e fechamento no dia 15 depois do `Mcm_Earnings`.
3. avant-api: rotas em `/internal/commissions` (pessoas, prazos, mês), regras no cadastro de papéis, e `/auth/me/commissions`.
4. avant-web: protótipo primeiro, depois a seção Comissão no cadastro do papel, o ajuste da pessoa na Equipe Groone, "Minha comissão" e a visão do financeiro.

Depois de aprovado, a decisão vira `docs/decisoes/09-comissao-da-equipe-groone.md` nos cinco repositórios.

## Atualização com o Pedro (29/10/2026)

Esta seção vale sobre o que está acima onde houver diferença.

**Comissão**

- As regras continuam **só no papel** da Equipe Groone. Não há ajuste por pessoa: quem precisa de regra diferente ganha um papel próprio. Sai a tabela `staff_commission_settings`.
- **Deduções:** no fechamento do dia 15, a parte da Groone nas deduções do GAM do mês recebe o mesmo percentual e é abatida da comissão do mês. Quando o percentual mudou no meio do mês, a dedução é rateada pela base de cada dia, com o percentual daquele dia (cada dia guarda o seu, então nada usa o percentual de hoje).
- Exemplo: revshare da Groone de US$ 1.000 no mês, parte da Groone nas deduções de US$ 50, 10% → comissão de 100 − 5 = US$ 95.
- A comissão é paga mesmo sem bater a meta.
- **Situações (Pedro, 29/10):** `draft` (em aberto, calculada todo dia) → `validated` (fechada no dia 15, já com a dedução) → `issued` (emitida: o financeiro marca quando lança na nota, como o ISSUED do Genius) → `paid` (paga). `paid` existe desde já, mas só será marcada pelo pagamento da invoice, que é uma funcionalidade futura; ninguém marca paga à mão.

**Metas (só no painel interno, nunca nas Empresas cliente)**

- **Meta do papel:** um modelo mensal (um valor por mês, numa moeda), no papel da Equipe Groone, com a escolha "por pessoa" (cada uma recebe o valor inteiro) ou "dividida" (valor ÷ pessoas ativas com o papel). Não há meta por pessoa nem por grupo.
- **Régua da meta do papel:** o revshare da Groone dos clientes de que a pessoa é responsável (`account_manager_id`), menos a parte da Groone nas deduções quando o mês fecha. Durante o mês, o realizado é o revshare até ontem, com a projeção até o fim do mês.
- **Meta da Empresa Groone:** uma meta mensal da Groone inteira, medida pela **receita da Groone** (o revshare) somada de todos os clientes, menos a parte dela nas deduções quando o mês fecha (Pedro, 29/10: "meta da Groone é sempre levando em conta a receita da Groone"). Não passa para ninguém.
- A meta serve para ver o desempenho de cada pessoa e da Groone no mês; não condiciona a comissão.

**Tabelas que mudam**

| Tabela | Campos principais |
| --- | --- |
| `role_commission_rules` | como acima, mais `goal_template_id` e `goal_mode` (`per_member`, `split`) |
| `goal_templates` | nome, moeda, um valor por mês (da Company Groone) |
| `company_goal` | a meta da Empresa Groone: `goal_template_id` |
