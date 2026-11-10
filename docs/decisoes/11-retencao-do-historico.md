# 11. Retenção do histórico e limpeza confiável

**Estado:** em vigor desde a core v0.83.0 (core#229), ajustada na v0.83.2 (core#272).

## O que é apagado e quando

A limpeza diária do avant-worker (`purge` em `maintenance.py`) apaga em lotes:

| Tabela | Fica por | Observação |
| --- | --- | --- |
| `sessions` | 30 dias depois de vencer ou ser encerrada | |
| `password_resets` | 7 dias depois de vencer | |
| `audit_logs` | 365 dias | |
| `alert_events` | 90 dias | só disparos fechados |
| `schedule_deliveries` | 90 dias | |
| `network_sync_runs` | 30 dias | a mais recente de cada (network, tipo) fica sempre |
| `gam_tool_runs` | 180 dias | só execuções terminadas |

## A auditoria deixa de ser imutável depois de um ano

O `avant_app` continua sem `DELETE` em `audit_logs` e `network_sync_runs`. A retenção delas passa
por duas funções do `avant_owner` (`SECURITY DEFINER`):

- **Prazo mínimo:** as funções nunca apagam o que for mais novo que o prazo mínimo, qualquer que
  seja a data pedida. Antes desse prazo, a auditoria continua imutável para o app.
- **Sem RLS:** as funções são do dono das tabelas, que ignora o RLS, então apagam de todas as
  Empresas.
- **Só a limpeza confiável:** elas exigem `app.bypass_rls = on`, que só o Unit of Work confiável
  liga. Uma sessão de Empresa que as chame por engano recebe erro. Isso não é barreira contra quem
  controla o código do app, que pode ligar o bypass, como no resto do RLS (`db/uow.py`).

## A última sincronização fica

A tela da network mostra a sincronização mais recente de cada tipo (`latest`) e o último erro.
Para uma network parada há mais de 30 dias, apagar tudo deixaria a tela em "nenhuma
sincronização", por isso a mais recente de cada (network, tipo) nunca é apagada.

`schedule_deliveries` e `alert_events` têm o mesmo efeito em menor grau (o último envio de um
agendamento pausado há mais de 90 dias, o último disparo de um alerta). São só exibição, e o
agendamento guarda `last_sent_at`, então ficam como estão.
