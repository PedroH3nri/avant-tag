# Skills deste repositório

Todas as skills que o trabalho em `avant-tag` usa ficam aqui, versionadas com o código. O Claude Code as encontra por `.claude/skills/`, que aponta para esta pasta, e o hook de início de sessão (`.claude/hooks/session-start.sh`) carrega a `using-superpowers`.

| Skill | Quando usar | Origem |
| --- | --- | --- |
| `avant-clean-code` | Sempre que escrever código: nomes claros, comentário de 1 ou 2 linhas por função, nada de comentário ao lado. Obrigatório, conferido no CI. | Avant |
| `avant-fluxo-de-trabalho` | Começo de qualquer tarefa: issue, branch, checagens, PR, merge e fechar a issue. | Avant |
| `using-superpowers` | Carregada no começo de cada sessão pelo hook. Ensina a procurar e usar as skills antes de agir. | superpowers 7.0.1 |
| `brainstorming` | Antes de construir algo novo: tira a especificação da conversa antes do código. | superpowers 7.0.1 |
| `writing-plans` | Depois da especificação aprovada: plano de implementação em passos pequenos e testáveis. | superpowers 7.0.1 |
| `executing-plans` | Para seguir um plano escrito, tarefa por tarefa, com checagem. | superpowers 7.0.1 |
| `subagent-driven-development` | Plano grande executado por subagentes, com revisão de cada tarefa. Só quando o Pedro pedir subagentes. | superpowers 7.0.1 |
| `dispatching-parallel-agents` | Tarefas independentes em paralelo. Só quando o Pedro pedir subagentes. | superpowers 7.0.1 |
| `test-driven-development` | Todo código novo: teste que falha, código mínimo, refatora. | superpowers 7.0.1 |
| `systematic-debugging` | Todo bug ou CI vermelho: achar a causa raiz antes de corrigir. | superpowers 7.0.1 |
| `verification-before-completion` | Antes de dizer que terminou: rodar as checagens e mostrar o resultado. | superpowers 7.0.1 |
| `requesting-code-review` | Antes do merge: revisão do próprio diff. | superpowers 7.0.1 |
| `receiving-code-review` | Ao responder comentários de revisão no PR. | superpowers 7.0.1 |
| `using-git-worktrees` | Trabalho isolado em outra branch sem mexer na atual. | superpowers 7.0.1 |
| `finishing-a-development-branch` | Fechar a branch: checagens, PR, merge. | superpowers 7.0.1 |
| `writing-skills` | Para criar ou melhorar uma skill desta pasta. | superpowers 7.0.1 |
| `diagnosing-superpowers` | Quando uma skill do superpowers não se comporta como deveria. | superpowers 7.0.1 |
| `graphify` | Perguntas sobre a arquitetura e as relações do código: consulte o grafo antes de sair lendo arquivos. | graphify 0.9.95 |

## De onde vêm

| Origem | Fonte | Licença |
| --- | --- | --- |
| Avant | escritas para este projeto | do projeto |
| superpowers 7.0.1 | [obra/superpowers](https://github.com/obra/superpowers) @ `2ce8aa1` | MIT (`_licencas/superpowers-MIT.txt`) |
| graphify 0.9.95 | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) @ `92741d1`, arquivos da instalação para Claude Code | Apache 2.0 (`_licencas/graphify-*.txt`) |

Para atualizar as de terceiros, copie a versão nova por cima da pasta da skill e troque a versão nesta tabela. As skills do Avant são iguais em todos os repositórios quando têm o mesmo nome (`avant-fluxo-de-trabalho`): mude nos cinco juntos.

O superpowers tem telemetria opcional no "visual companion" da `brainstorming`. Ela está desligada em `.claude/settings.json` (`SUPERPOWERS_DISABLE_TELEMETRY`).

## graphify

O grafo já vem versionado em `graphify-out/` (`graph.json` e `GRAPH_REPORT.md`). Para consultar ou atualizar, a ferramenta `graphify` precisa estar instalada na máquina:

```bash
uv tool install graphifyy        # pacote oficial, com dois y
graphify update .                # grafo do código em graphify-out/, local e sem LLM
graphify query "como a Empresa ativa chega ao RLS?"
```
