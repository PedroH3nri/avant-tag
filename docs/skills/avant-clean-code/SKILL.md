---
name: avant-clean-code
description: Use sempre que escrever ou mudar código em qualquer repositório do Avant. Nomes claros, um comentário de 1 ou 2 linhas por função e nada de comentário ao lado do código.
---

# Clean code no Avant

Regra obrigatória do Pedro (2026-10-24), igual nos cinco repositórios. Todo o código foi
reescrito no padrão em 2026-10-24, e o CI reprova o PR que deixar qualquer arquivo fora dele.

## As regras

1. **Nomes claros.** O nome diz o que a coisa é, sem precisar de comentário: `membership`,
   `site_ids`, `seats_used`, nunca `m`, `ids2`, `tmp`, `data`, `x`. Nada de nome de uma letra
   só, nem em laço ou callback (`for site in sites`, `members.map((member) => ...)`). Só `_`
   pode, para o que é descartado.
2. **Um comentário curto por função.** Toda função, método e componente tem um comentário de
   1 ou, no máximo, 2 linhas dizendo **o que** ela faz (o porquê só quando não é óbvio).
   - Python: docstring logo abaixo do `def`: `"""Convida uma pessoa para a Empresa ativa."""`
   - TypeScript e Vue: comentário logo acima: `/** Troca a Empresa ativa e volta ao início. */`
   - Shell: `# Sobe o par de containers ocioso.` logo acima da função.
   - Dunders do Python (`__init__`, `__enter__`) e assinaturas `@overload` ficam de fora.
3. **Nada de comentário ao lado do código.** Nem de variável, nem de campo, nem de linha:
   ```python
   seat_limit: int | None  # vazio na Groone        <- proibido
   ```
   Se precisa explicar, o nome está ruim: renomeie. Se ainda precisa, o comentário vai numa
   linha própria acima. Só `# noqa`, `# type:` e `# pragma:` (e `// @ts-expect-error`) podem
   ficar ao lado, porque são instruções para ferramentas.
4. **Clean code no resto.** Funções pequenas que fazem uma coisa; sem código morto ou
   comentado; sem números mágicos (constante com nome); retorno cedo em vez de `if` aninhado;
   sem duplicar regra que já existe em outro lugar.

## Como o CI confere

- Python (core, api, worker): `uv run python scripts/clean_code.py`, para todo o `src/`.
- Painel (web): `pnpm clean-code` (`scripts/clean-code.mjs`), para todo o `src/`.
- Infra: não tem CI; confira à mão os scripts de `scripts/` antes do merge.

Código gerado (migrations do Alembic, `src/components/ui` do shadcn-vue) e testes ficam fora da
checagem automática, mas seguem as regras de nome e de comentário ao lado quando forem escritos
ou mudados.
