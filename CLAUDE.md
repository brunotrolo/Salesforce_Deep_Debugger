# CLAUDE.md

**As regras deste repositório estão em [`AGENTS.md`](AGENTS.md). Leia-o antes de qualquer
mudança.** Fonte única, vendor-neutral — este arquivo não as duplica, para não divergir.

O essencial, em três linhas:

1. Este repositório **é uma skill**, não um projeto Salesforce. O que se entrega é o
   conteúdo de `.claude/`.
2. **Por padrão só diagnostica** (nunca aplica fix, nunca faz deploy). Corrige e faz um
   quick deploy escopado/sem teste só com pedido explícito — `guard.mjs` reforça isso
   tecnicamente (`ask`/`deny` conforme o caso), não só em prosa.
3. Um resultado sem evidência suficiente é pergunta, não conclusão — nos três níveis:
   ao investigar o incidente, ao editar esta skill, e ao confiar no `log-parser.mjs`
   sem o self-test rodado. Agilidade é parte da especificação: nunca reproduz
   executando, vai direto ao que foi declarado.

## Específico do Claude Code

- **Skill invocável:** `.claude/skills/sf-deep-debugger/SKILL.md` está um nível abaixo
  de `skills/`, então vira comando `/`. Não há subagentes (`.claude/agents/`) neste
  repositório — os 2 níveis (diagnóstico / correção explícita) rodam no mesmo agente,
  orquestrados pelo próprio `SKILL.md`.
- **`allowed-tools` no frontmatter, não `tools:`** — este é o campo de skill, não de
  subagente. `tools:` seria ignorado em silêncio aqui.
- **`.claude/rules/karpathy-guidelines.md`** não tem `paths:`, então carrega sempre.
- **`settings.json` não usa `bypassPermissions`**, ao contrário de várias skills irmãs
  deste arsenal — decisão deliberada, documentada em
  `.claude/skills/sf-deep-debugger/references/safety-model.md`: esta skill lê dado de
  produção real, o custo de um comando não-intencional é maior que nas skills que só
  tocam código-fonte estático.
- **O hook `PreToolUse` do `guard.mjs` roda de verdade**: intercepta `Bash|Write|Edit`,
  nega incondicionalmente mutação de dados/org e qualquer `sf apex run test`, e decide
  `ask`/`deny` para escrita em `force-app/` e para deploy conforme escopo/nível de
  teste (ver `references/safety-model.md`). Se você mexer nele ou no `settings.json`,
  rode `node --test .claude/skills/sf-deep-debugger/tests/*.test.mjs` antes de dar por
  pronto — e note que `settings.json` não pode ter `Bash(sf project deploy *)` na
  `deny` list, ou anula o `ask` condicional do guard antes de ele decidir.
