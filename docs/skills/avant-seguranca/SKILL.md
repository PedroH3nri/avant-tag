---
name: avant-seguranca
description: Use ao criar ou mudar rota, caso de uso, tabela, tarefa, tela ou script em qualquer repositório do Avant. As 20 regras de segurança (dados sensíveis, backdoor, isolamento entre Empresas e exploit) e a checagem antes do PR.
---

# Segurança no Avant

Regras aprovadas pelo Pedro em 19/11/2026 (decisão `docs/decisoes/18-seguranca.md` no
avant-core, milestone M13 Segurança). Valem para o código de hoje e para toda feature nova,
iguais nos seis repositórios. Quem quebra uma regra explica no PR por quê.

## Dados sensíveis

1. **Segredo nunca volta.** Senha, token, chave e segredo de 2FA ficam como hash (o que só se
   confere) ou cifrados (o que o Avant precisa usar). O valor puro aparece uma vez, na criação,
   e nunca em resposta, log, erro, evento do SSE ou payload de tarefa.
2. **Dado fiscal, bancário e contato de terceiros** (CPF/CNPJ, conta, leads do reward) só sai
   com permissão própria e nunca em lista. Fora da tela que precisa dele, vai mascarado.
3. **Resposta é um DTO com os campos listados**, nunca a entidade inteira. Campo novo em DTO
   de lista pede a pergunta: quem vê isso precisa disso?
4. **Log sem corpo de pedido**, sem `Authorization`, cookie ou query de OAuth. Cliente HTTP com
   log de URL desligado quando a URL leva chave.
5. **Nada de segredo no repositório nem na imagem**: só nas VMs, em arquivos `0600`. Segredo
   vazado é trocado, não só apagado. O backup do Postgres é cifrado (dados fiscais e bancários
   ficam em texto no banco, decisão de 19/11).

## Acesso e backdoor

6. **Toda rota declara o acesso**: `require`, `require_session`, `require_staff` ou
   `require_staff_member`. Rota pública entra na lista fechada com o motivo. O caso de uso no
   core confere de novo a permissão fina e a Company Groone.
7. **Não existe caminho escondido**: nada de senha mestra, usuário fixo, flag que pula login ou
   2FA, rota de debug ou impersonação. Suporte que age por outra pessoa passa pelo painel
   interno, com permissão, 2FA e auditoria.
8. **CLI que cria acesso** (`avant-bootstrap`, `avant-seed-demo`) tem trava de ambiente e roda
   uma vez. Comando novo do tipo segue a mesma regra.
9. **Mudança de acesso grava auditoria** (papel, permissão, dono, 2FA, chave, convite, equipe
   Groone), com quem fez.
10. **Dependência nova com versão presa** e `pip-audit`/`pnpm audit` limpos. GitHub Action
    presa por SHA.

## Isolamento entre Empresas

11. **Tabela com dado de Empresa** tem `company_id`, RLS e política na mesma migration, com
    teste. Tabela sem `company_id` entra na lista de exceções com o motivo; tabela só do painel
    interno tem RLS só por bypass (skill `avant-migration-rls`).
12. **`uow(company_id)` é o padrão.** `trusted_uow()` só para login, sessão, convite, painel
    interno, rotas públicas e tarefas que varrem todas as Empresas, sempre com o motivo na
    docstring e o recorte de Empresa feito no core.
13. **A Empresa vem da sessão ou da chave**, nunca do caminho, do corpo ou de cabeçalho do
    cliente. Id recebido de fora é buscado dentro da Empresa; se não for dela, é 404 (não 403).
14. **Chave de cache, canal do Redis, nome de arquivo e tarefa** levam a Empresa (ou um id que
    só existe nela) e são lidos depois da checagem de acesso.
15. **Rota nova com id tem teste de outra Empresa (404) e sem permissão (403).** Rota interna
    tem teste com pessoa da equipe sem a permissão e com cliente.

## Exploit

16. **SQL só por SQLAlchemy ou `text()` com parâmetros.** f-string em SQL só com constante do
    código.
17. **URL vinda do usuário** passa pelo filtro de SSRF do worker: sem IP privado, sem redirect
    para fora, com tempo e tamanho máximos.
18. **Nada de `v-html`, `innerHTML` ou `eval` com dado de fora**, no painel, na tag e no
    reward. Script e imagem externos só de host conferido.
19. **Upload confere o tipo real** pelo conteúdo e o tamanho, e nunca usa o nome do arquivo no
    disco. CSV exportado escapa célula que começa com `=`, `+`, `-` ou `@`.
20. **Rota pública ou cara tem limite de taxa** (login, 2FA, reset, relatório, exportação,
    beacon). Rota pública com CORS aberto não lê cookie e não devolve dado de Empresa.

## Antes do PR

- [ ] Rota nova ou mudada: acesso declarado (regra 6), teste sem permissão e com id de outra
      Empresa (regra 15).
- [ ] DTO novo ou campo novo: nada de hash, token ou segredo; dado fiscal, bancário ou contato
      só com permissão e fora de lista (regras 1 a 3).
- [ ] Tabela nova: RLS ou entrada na lista de exceções (regra 11).
- [ ] `trusted_uow()` novo: motivo na docstring e recorte no core (regra 12).
- [ ] Log, evento ou tarefa nova: sem segredo nem PII (regras 1 e 4).
- [ ] Busca de URL, upload, exportação ou HTML vindo de fora: regras 17 a 19.
- [ ] Nenhum caminho de acesso novo fora do login, da chave de API e do painel interno
      (regra 7).

Achou um problema de segurança fora do que está mexendo? Abra uma issue na milestone M13
Segurança com o label `segurança`. Dado sensível saindo hoje é corrigido na hora.
