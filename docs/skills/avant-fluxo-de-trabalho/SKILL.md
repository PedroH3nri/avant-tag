---
name: avant-fluxo-de-trabalho
description: Use no começo de qualquer tarefa no Groone Avant. Mostra como achar a issue, criar a branch, rodar as checagens, entregar na pre-develop, promover para a develop com revisão e fechar a issue.
---

# Fluxo de trabalho do Groone Avant

Toda demanda é uma issue com milestone no repositório certo. Nada de trabalho sem issue: se o pedido não tem uma, crie a issue antes (título em português, contexto, checklist de "pronto quando", milestone).

## 1. Entender

1. Leia `docs/contexto.md` (produto, decisões, estado) e o `CLAUDE.md` deste repositório.
2. Ache a issue: `gh issue list --repo PedroH3nri/<repo> --milestone "<milestone>"` e `gh issue view <N> --repo PedroH3nri/<repo>`.
3. Se a issue tem "Issues irmãs", a ordem é avant-core, depois avant-api e avant-worker, por fim avant-web. Não comece a tela antes da rota, nem a rota antes do caso de uso.
4. Decisão que muda o objetivo é do Pedro: pergunte uma vez, com recomendação, e siga com a recomendada enquanto ele não responde (se der para desfazer).

## 2. Fazer

```bash
git fetch origin pre-develop:refs/remotes/origin/pre-develop
git checkout -B feat/<assunto> origin/pre-develop    # ou fix/<assunto>
```

Todo código segue a `avant-clean-code` (obrigatória). Siga também as skills do tipo de mudança deste repositório (veja `docs/skills/README.md`) e as do superpowers: `test-driven-development` para código, `systematic-debugging` para bug, `verification-before-completion` antes de dizer que terminou.

## 3. Checar

```bash
pnpm lint && pnpm clean-code && pnpm typecheck && pnpm test && pnpm build
```

Nunca rode o Prettier nos arquivos existentes.

## 4. Entregar

- Commit em português, terminando com `Closes #N`.
- PR para `pre-develop` pela API REST (o `gh pr create` pode falhar por causa do GraphQL):

```bash
gh api repos/PedroH3nri/<repo>/pulls -f base=pre-develop -f head=<branch> \
  -f title="<título>" -F body=@corpo.md --jq '.number, .head.sha'
```

- Corpo do PR: `Closes #N`, o que muda e como foi testado.
- Merge na `pre-develop` quando as checagens e o CI passam: a feature pronta entra ali sem revisão.
- Promoção `pre-develop` → `develop` num PR próprio: revisão de código por um revisor de contexto novo (`requesting-code-review`) sobre o diff inteiro, que pode ter trabalho de outra sessão, e CI verde. Sem vulnerabilidade nem erro (nada crítico ou importante), o merge na `develop` está autorizado (Pedro, 03/11); se houver, corrija com teste na `pre-develop` e revise de novo. `main` e produção são sempre do Pedro.
- O `gh api` mescla mesmo com a CI vermelha: espere `gh pr checks <N> --watch` passar antes de qualquer merge.
- O branch padrão é `main`, então o `Closes #N` não fecha a issue: feche à mão depois que a mudança chegar à `develop`.

```bash
gh api -X PATCH repos/PedroH3nri/<repo>/issues/<N> -f state=closed -f state_reason=completed
```

- Marque os itens do checklist da issue que ficaram prontos e, se sobrou algo, abra uma issue nova com o que falta.

## Nunca

- Segredo no repositório, em issue ou em PR. Os valores ficam só nas VMs.
- Pular, desligar ou marcar como flaky um teste para o CI passar.
- Push direto em `pre-develop`, `develop` ou `main`, ou merge em `main`.
