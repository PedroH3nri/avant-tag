#!/usr/bin/env bash
# SessionStart: carrega a skill using-superpowers e lembra onde está o contexto do projeto.
# O que este script imprime entra no contexto da sessão do Claude Code.
set -euo pipefail
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
skill="$root/docs/skills/using-superpowers/SKILL.md"
cat <<'EOF'
<contexto-do-projeto>
Groone Avant. Antes de qualquer tarefa leia docs/contexto.md e o CLAUDE.md deste repositório.
Todo trabalho parte de uma issue com milestone (skill avant-fluxo-de-trabalho).
As skills deste repositório estão em docs/skills/ (também em .claude/skills/). As do superpowers
aparecem sem o prefixo "superpowers:": "superpowers:brainstorming" é a skill "brainstorming".
Se a ferramenta Skill não listar uma skill, leia o SKILL.md dela direto em docs/skills/<nome>/.
</contexto-do-projeto>
EOF
if [ -r "$skill" ]; then
  printf '<skill name="using-superpowers">\n%s\n</skill>\n' "$(<"$skill")"
fi
