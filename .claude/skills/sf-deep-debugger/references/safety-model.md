# Modelo de segurança — 2 níveis

## Nível 1 — Diagnóstico (padrão, sempre)

**Postura: least-privilege, sem `bypassPermissions`.** Ao contrário de
`apex-test-loop`/`lwc-pattern-generator`/`apex-callouts-developer` (loops autônomos de
várias iterações), esta skill fica no modo padrão do Claude Code — pede confirmação
para qualquer coisa fora de `permissions.allow`, que só libera **leitura**: `sf org
display`, `sf data query` (SOQL de leitura), `sf apex log list`/`get`, `git
status`/`diff`/`log`, e a invocação dos scripts da própria skill.

Diagnóstico nunca precisa de mais que isso. Se em algum ponto parecer necessário rodar
algo para "confirmar" o bug, isso é sinal de estar tentando reproduzir em vez de
diagnosticar com o que já existe — pare e reavalie (ver `SKILL.md`, "Princípio
central").

## Nível 2 — Correção explícita (só quando pedida)

Esta skill **pode** editar o artefato e fazer um deploy mínimo, mas só quando o
usuário pede em palavras claras — nunca por inferência. Duas travas técnicas, não só
uma promessa em prosa:

### 1. Escrita no artefato vira `ask`, nunca silenciosa
`Write`/`Edit` em `force-app/` (ou pasta de metadado deployável equivalente) não está
em `permissions.allow` nem seria coberto por um `deny` de `guard.mjs` — o guard devolve
`ask`. A confirmação da ferramenta, nesse momento, É o pedido explícito do usuário se
tornando ação. Se a skill tentar escrever ali sem o usuário ter pedido a correção,
o próprio prompt de confirmação já é a rede de segurança.

### 2. Deploy só é permitido escopado + sem teste
`guard.mjs` classifica todo `sf project deploy`:

| Situação | Decisão |
|---|---|
| Sem `--test-level` explícito | `deny` — nunca presume `NoTestRun` por omissão |
| `--test-level` diferente de `NoTestRun` (RunLocalTests, RunAllTestsInOrg, etc.) | `deny` — teste fica para depois da homologação |
| Sem escopo estreito (`--source-dir`/`--metadata`/`--manifest`) | `deny` |
| `--source-dir force-app` inteiro (mesmo com `NoTestRun`) | `deny` |
| Escopado ao artefato + `--test-level NoTestRun` | `ask` — é o quick deploy que o Nível 2 permite |

Isso encode tecnicamente a regra "corrige rápido, valida rápido, teste fica para
depois" — não é só uma instrução em prosa que a skill poderia interpretar mal sob
pressa.

### 3. Teste nunca, em nenhum nível
`sf apex run test` / `sf apex test run` são `deny` incondicional em `guard.mjs`,
independente do nível. Esta skill não homologa — ela diagnostica rápido e, se pedida,
aplica e valida a subida do fix. Homologação com teste é sempre um passo humano
posterior, tipicamente de outra skill (`apex-test-loop`).

### 4. Comandos mutáveis de dados/org continuam `deny` incondicional
`sf data create/update/delete/upsert`, `sf org delete`, `sf project delete` — nenhum
nível libera isso. Esta skill corrige código-fonte, nunca dado ou a org em si.

## Comandos encadeados

Todas as regras acima usam regex sem âncora — um comando encadeado
(`sf data query ... && sf project deploy ...`) é pego mesmo que o `permissions.deny`
do `settings.json` (que casa só o início do comando) não alcance.

## Teste

```bash
node --test .claude/skills/sf-deep-debugger/tests/*.test.mjs
```

## Limitação honesta

Matching por texto/caminho não é fronteira criptográfica — um wrapper exótico ou
substituição de comando pode, em tese, escapar. O modo padrão sem `bypassPermissions`
continua sendo a primeira linha de defesa real.
