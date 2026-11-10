// Checagem de clean code da tag (docs/skills/avant-clean-code): nomes claros, um comentário
// curto por função, nada de comentário ao lado do código. Uso: `pnpm clean-code` confere o src/.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const SOURCE_DIR = 'src'
const ALLOWED_SIDE_COMMENTS = ['// @ts-expect-error', '// @ts-ignore', '// oxlint-', '// eslint-']
const MAX_COMMENT_LINES = 2

/** Lista os arquivos .ts de src/. */
function sourceFiles(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path))
    else if (/\.ts$/.test(name) && !name.endsWith('.d.ts')) files.push(path)
  }
  return files.sort()
}

/** Conta as linhas com texto de um comentário, sem os marcadores. */
function commentLines(comment) {
  return comment
    .replace(/^\/\*\*?|\*\/$/g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*(\*|\/\/)\s?/, '').trim())
    .filter(Boolean).length
}

/** Pega os comentários logo acima de um nó, já como texto. */
function leadingComments(source, node) {
  const ranges = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? []
  return ranges.map((range) => source.text.slice(range.pos, range.end))
}

/** Diz se o nó é uma função com nome: declaração, método ou const com arrow/function. */
function namedFunction(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return { name: node.name.text, anchor: node }
  if (ts.isMethodDeclaration(node) && node.body) return { name: node.name.getText(), anchor: node }
  if (ts.isVariableStatement(node)) {
    const [declaration] = node.declarationList.declarations
    const initializer = declaration?.initializer
    if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
      return { name: declaration.name.getText(), anchor: node }
    }
  }
  return null
}

/** Confere comentário de função, nomes de uma letra e comentários ao lado num arquivo. */
function checkScript(text, problems) {
  const source = ts.createSourceFile('script.ts', text, ts.ScriptTarget.Latest, true)
  const lineOf = (position) => source.getLineAndCharacterOfPosition(position).line + 1

  /** Visita cada nó atrás de funções sem comentário e de nomes de uma letra. */
  function visit(node) {
    const found = namedFunction(node)
    if (found) {
      const comments = leadingComments(source, found.anchor)
      const last = comments.at(-1)
      if (!last) problems.push([lineOf(found.anchor.getStart()), `função ${found.name} sem comentário de 1 ou 2 linhas`])
      else if (commentLines(last) > MAX_COMMENT_LINES) problems.push([lineOf(found.anchor.getStart()), `comentário de ${found.name} passa de 2 linhas`])
    }
    const named =
      (ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name)
        ? node.name
        : null
    if (named && named.text.length === 1 && named.text !== '_') {
      problems.push([lineOf(named.getStart()), `nome '${named.text}' pouco claro`])
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  const lines = text.split('\n')
  for (const [position, comment] of allComments(source)) {
    const { line, character } = source.getLineAndCharacterOfPosition(position)
    const before = lines[line].slice(0, character).trim()
    if (before && !ALLOWED_SIDE_COMMENTS.some((prefix) => comment.startsWith(prefix))) {
      problems.push([line + 1, 'comentário ao lado do código'])
    }
  }
}

/** Junta todos os comentários do script, cada um com a posição em que começa. */
function allComments(source) {
  const comments = new Map()
  const collect = (ranges) => {
    for (const range of ranges ?? []) comments.set(range.pos, source.text.slice(range.pos, range.end))
  }
  const visit = (node) => {
    collect(ts.getLeadingCommentRanges(source.text, node.pos))
    collect(ts.getTrailingCommentRanges(source.text, node.end))
    ts.forEachChild(node, visit)
  }
  visit(source)
  return comments
}

/** Todos os problemas de um arquivo, em ordem de linha. */
function checkFile(path) {
  const problems = []
  checkScript(readFileSync(path, 'utf-8'), problems)
  return problems
    .sort((first, second) => first[0] - second[0])
    .map(([line, message]) => `${relative('.', path)}:${line}: ${message}`)
}

const problems = sourceFiles(SOURCE_DIR).flatMap(checkFile)
console.log(problems.length ? problems.join('\n') : 'clean code ok')
process.exit(problems.length ? 1 : 0)
