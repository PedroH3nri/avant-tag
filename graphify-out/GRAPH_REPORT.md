# Graph Report - avant-tag  (2026-11-13)

## Corpus Check
- 89 files · ~53,322 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 4, .toml 1)

## Summary
- 727 nodes · 1314 edges · 31 communities (29 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `373d8b22`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- tag.ts
- reward.test.ts
- price-rules/index.ts
- loader/index.ts
- package.json
- Avant: models do MVP
- steps
- reward/render.ts
- Groone Avant: contexto do projeto
- Avant: endpoints da API do MVP
- ads/index.ts
- steps
- clean-code.mjs
- compilerOptions
- Arquitetura do MVP do Avant
- Requisitos do novo SaaS AdTech Groone
- Avant: fluxos de login e convite
- 12. Rewards e quiz (plano)
- Review Focus
- updates
- Avant: conexão com o GAM
- Avant: grupos na Empresa e imagem da Empresa
- Avant: repositório e plano do MVP
- Comissão da equipe Groone
- 10. M5 no painel interno da Groone (plano)
- avant-tag
- 11. Retenção do histórico e limpeza confiável
- .oxlintrc.json
- avant-tag
- session-start.sh
- 13. Ad tag

## God Nodes (most connected - your core abstractions)
1. `startAds()` - 24 edges
2. `runTag()` - 22 edges
3. `RewardWidget` - 16 edges
4. `renderReward()` - 16 edges
5. `startReward()` - 15 edges
6. `compilerOptions` - 14 edges
7. `vitest` - 14 edges
8. `Groone Avant: contexto do projeto` - 14 edges
9. `showRewardedAd()` - 13 edges
10. `startCascade()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `O script `g-tag` (repositório `iGroone/G-Tag`)` --references--> `sendBeacon()`  [INFERRED]
  docs/decisoes/13-ad-tag.md → src/core/beacon.ts
- `Rotas (avant-api)` --references--> `sendBeacon()`  [INFERRED]
  docs/decisoes/13-ad-tag.md → src/core/beacon.ts
- `Contrato com a API` --references--> `sendBeacon()`  [INFERRED]
  docs/superpowers/plans/2026-11-10-avant-tag.md → src/core/beacon.ts
- `Rotas (avant-api)` --references--> `sendBeacon()`  [INFERRED]
  docs/decisoes/12-rewards-e-quiz.md → src/core/beacon.ts
- `setup()` --calls--> `startAds()`  [EXTRACTED]
  tests/ads/cascade.test.ts → src/ads/index.ts

## Import Cycles
- None detected.

## Communities (31 total, 2 thin omitted)

### Community 0 - "tag.ts"
Cohesion: 0.05
Nodes (67): vitest, AdsRun, GTAG_SOURCE, GtagWindow, startAnalytics(), cachedConfig(), loadConfig(), localStore() (+59 more)

### Community 2 - "reward.test.ts"
Cohesion: 0.07
Nodes (45): REWARD_CASCADE_ENABLED, REWARD_REBID_ENABLED, AdOutcome, FONT_STACKS, fontStylesheet(), OFFERWALL_SELECTOR, OFFERWALL_WAIT_MS, RenderOptions (+37 more)

### Community 3 - "price-rules/index.ts"
Cohesion: 0.05
Nodes (44): Cascade, CASCADE_KINDS, CASCADE_STALL_MS, startCascade(), clearStall(), finish(), rebid(), tryTargeting() (+36 more)

### Community 4 - "loader/index.ts"
Cohesion: 0.09
Nodes (39): PublicLoader, ADBLOCK_KEY, ADBLOCK_PROBE, detectAdblock(), sessionStore(), channels(), inkFor(), tint() (+31 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (35): description, devDependencies, jsdom@^30.1.3, oxlint@^1.89.0, @types/node@^24.19.2, typescript@~6.0.3, vite@^8.3.5, vitest@^5.0.5 (+27 more)

### Community 6 - "Avant: models do MVP"
Cohesion: 0.07
Nodes (26): Acesso, AdUnit, ApiKey, AuditLog, Avant: models do MVP, Company, Decisões de Pedro (22/10/2026), Empresa e equipe (+18 more)

### Community 7 - "steps"
Cohesion: 0.09
Nodes (24): GITLEAKS_SHA256, GITLEAKS_VERSION, jobs, segredos, test, name, on, pull_request (+16 more)

### Community 8 - "reward/render.ts"
Cohesion: 0.26
Nodes (19): accentGradient(), channels(), luminance(), mix(), shade(), toHex(), fontStack(), answersView() (+11 more)

### Community 9 - "Groone Avant: contexto do projeto"
Cohesion: 0.10
Nodes (17): Arquitetura, Como trabalhar nos repositórios, Dicas de ambiente para o agente, Documentos de decisão, GAM, Groone Avant: contexto do projeto, Identidade visual, Infraestrutura e operação (+9 more)

### Community 10 - "Avant: endpoints da API do MVP"
Cohesion: 0.12
Nodes (16): API first e chaves de API, Atribuição de sites, Avant: endpoints da API do MVP, Catálogo de permissões, Convenções, Convites, Decisões de Pedro (23/10/2026), Empresa (+8 more)

### Community 11 - "ads/index.ts"
Cohesion: 0.05
Nodes (43): Rotas (avant-api), CascadeDeps, LADDER_KINDS, SINGLE_TRY_KINDS, ensureGpt(), GoogleTag, GPT_SOURCE, gptReady() (+35 more)

### Community 12 - "steps"
Cohesion: 0.12
Nodes (16): jobs, tag, name, on, push, workflow_dispatch, permissions, contents (+8 more)

### Community 13 - "clean-code.mjs"
Cohesion: 0.07
Nodes (23): playwright, allComments(), ALLOWED_SIDE_COMMENTS, checkFile(), checkScript(), visit(), commentLines(), leadingComments() (+15 more)

### Community 14 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch, noUncheckedIndexedAccess (+7 more)

### Community 15 - "Arquitetura do MVP do Avant"
Cohesion: 0.14
Nodes (13): Ambientes, deploy e backup, Arquitetura do MVP do Avant, Controle de acesso no estilo do Defender, Decisões e perguntas em aberto, Endpoints da API REST, Estrutura do repositório, Fluxos, Isolamento, autenticação e permissões (+5 more)

### Community 16 - "Requisitos do novo SaaS AdTech Groone"
Cohesion: 0.17
Nodes (11): Conta e equipe, Escopo herdado do Genius, Integrações e onboarding no Google Ad Manager, Modelo de cobrança, MVP, Opções de nome, Perguntas em aberto, Problemas a resolver (+3 more)

### Community 17 - "Avant: fluxos de login e convite"
Cohesion: 0.17
Nodes (11): 2FA, Avant: fluxos de login e convite, Com Google, Com senha, Convite e primeiro acesso, Decisões de Pedro (23/10/2026), Endpoints de autenticação, Escolha da Empresa ativa (+3 more)

### Community 18 - "12. Rewards e quiz (plano)"
Cohesion: 0.20
Nodes (9): 12. Rewards e quiz (plano), Decisões já tomadas com o Pedro, Infra (avant-infra), Modelo (avant-core, domínio novo `rewards/`), O que já existe e o reward usa, Ordem e issues, Respostas do Pedro (09/11), Script do site e telas (avant-web) (+1 more)

### Community 19 - "Review Focus"
Cohesion: 0.17
Nodes (11): avant-tag Implementation Plan, Contrato com a API, Global Constraints, Review Focus, Task 1: base do repositório (avant-tag#1), Task 2: módulo `core` (avant-tag#3), Task 3: módulo `loader` (avant-tag#2), Task 4: módulo `ads` (avant-tag#3) (+3 more)

### Community 20 - "updates"
Cohesion: 0.13
Nodes (14): patterns, update-types, patterns, update-types, actions, dependencias, interval, updates (+6 more)

### Community 21 - "Avant: conexão com o GAM"
Cohesion: 0.20
Nodes (9): Avant: conexão com o GAM, Caminho conta de serviço, Caminho MCM, Decisões de Pedro (23/10/2026), Erros e estados, Fontes, Importação, Resumo (+1 more)

### Community 22 - "Avant: grupos na Empresa e imagem da Empresa"
Cohesion: 0.20
Nodes (9): Avant: grupos na Empresa e imagem da Empresa, Decisões do Pedro (26/10), Herança de comissão e meta, Imagem da Empresa, Issues, Modelo de dados, Regras, Resumo (+1 more)

### Community 23 - "Avant: repositório e plano do MVP"
Cohesion: 0.22
Nodes (8): Avant: repositório e plano do MVP, Decisões de Pedro (23/10/2026), Estrutura de pastas, Pipeline, Plano até 31/12, Primeira semana (23/10 a 02/11), Resumo, Serviços e ferramentas

### Community 24 - "Comissão da equipe Groone"
Cohesion: 0.25
Nodes (7): Atualização com o Pedro (29/10/2026), Comissão da equipe Groone, Como implementar, Como o Genius faz hoje, Decisões em aberto, Proposta, Resumo

### Community 25 - "10. M5 no painel interno da Groone (plano)"
Cohesion: 0.29
Nodes (6): 10. M5 no painel interno da Groone (plano), Escopo proposto, O buraco que vem antes de tudo, O que já existe, Ordem e estimativa, Perguntas para o Pedro

### Community 26 - "avant-tag"
Cohesion: 0.33
Nodes (5): avant-tag, Desenvolvimento, Estrutura, Instalação no site, Versões

### Community 27 - "11. Retenção do histórico e limpeza confiável"
Cohesion: 0.40
Nodes (4): 11. Retenção do histórico e limpeza confiável, A auditoria deixa de ser imutável depois de um ano, A última sincronização fica, O que é apagado e quando

### Community 28 - ".oxlintrc.json"
Cohesion: 0.50
Nodes (3): plugins, rules, $schema

### Community 31 - "13. Ad tag"
Cohesion: 0.12
Nodes (16): 13. Ad tag, Ajustes do protótipo (Pedro, 09/11), Como o Genius faz hoje, Implementação da saúde e das visitas (core#310, 10/11), Infra (avant-infra), Modelo (avant-core, domínio novo `ad_tags/`), O que dá para fazer melhor, O script `g-tag` (repositório `iGroone/G-Tag`) (+8 more)

## Knowledge Gaps
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `tag.ts` to `reward.test.ts`, `price-rules/index.ts`, `loader/index.ts`, `package.json`, `ads/index.ts`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `startAds()` (e.g. with `.display()` and `.enableServices()`) actually correct?**
  _`startAds()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `tag.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._
- **Why does `sendBeacon()` connect `ads/index.ts` to `tag.ts`, `Review Focus`, `13. Ad tag`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Should `reward.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07042253521126761 - nodes in this community are weakly interconnected._
- **Why does `typescript` connect `package.json` to `clean-code.mjs`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Should `price-rules/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05268065268065268 - nodes in this community are weakly interconnected._