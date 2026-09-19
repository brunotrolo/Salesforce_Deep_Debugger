# AGENTS.md — Salesforce Deep Debugger

Instruções para qualquer agente de código que trabalhe **neste repositório**.
Vendor-neutral por design (Claude Code, Cursor, Codex e afins). `CLAUDE.md` aponta para
cá para que exista uma única fonte de verdade.

## O que é este repositório

Este repositório **é uma skill**, não um projeto Salesforce. O que se entrega é o
conteúdo de `.claude/` — a skill `sf-deep-debugger`, suas referências, scripts e
self-test — instalado dentro do projeto de outra pessoa.

A skill diagnostica **rapidamente** um bug/inconsistência declarado por um
desenvolvedor (exceção Apex, erro de Flow, falha de callout, erro de FLS/sharing, erro
de LWC) a partir do relato dele, de log ou de mensagem de exceção — classifica o tipo
de falha e localiza a causa raiz **com evidência**, nunca reproduzindo por execução.
Fecha o ponto cego do arsenal de skills Salesforce deste autor: `apex-test-loop` e
`fsc-deploy-gate` param no deploy; esta skill começa exatamente onde elas param.
Agilidade é parte da especificação: vai direto ao que foi declarado, sem survey amplo.

**Fronteira com o `sf-archaeologist`** (irmão deste arsenal, instalável no mesmo
projeto): este agente **consome** a documentação que o Archaeologist já produz
(`docs/archaeologist/CAPABILITIES_MAP.md`, jornadas) quando existir — nunca a regenera,
nunca a edita. São ritmos de trabalho incompatíveis na mesma skill: o Archaeologist é
investigação pesada e deliberada (survey de org inteira); este é resposta pontual e
rápida a "isso quebrou, por quê".

## Disciplina comportamental

`.claude/rules/karpathy-guidelines.md` vale para o trabalho **neste repositório** tanto
quanto para a execução da skill:

1. **Pense antes de codar** — um resultado sem evidência suficiente é pergunta, não
   conclusão. Causa raiz errada vira fix errado aplicado em produção.
2. **Simplicidade primeiro** — o fix candidato é o mínimo que a causa raiz confirmada
   exige, nunca uma oportunidade de "melhorar" o método enquanto está ali. O mesmo vale
   para a investigação: vá direto ao componente declarado, nunca um survey amplo "para
   garantir".
3. **Mudanças cirúrgicas** — reforçado tecnicamente: `guard.mjs` pede confirmação
   explícita (`ask`) para qualquer escrita desta skill em `force-app/`, e só libera
   deploy escopado ao artefato do fix, sem teste. O fix é sempre mínimo, nunca uma
   correção mais ampla que a causa raiz exige.
4. **Execução orientada a objetivo** — "o script rodou sem erro" não é "o script
   extraiu certo"; por isso o `log-parser.mjs` tem self-test com verdade conhecida. E
   "reproduzir executando" não é objetivo desta skill em nenhuma fase — o critério de
   sucesso do diagnóstico é evidência já existente, não execução nova.

## Regras inegociáveis

### 1. Por padrão só diagnostica; corrige só com pedido explícito, e sempre rápido
Sem pedido explícito de correção, a skill nunca escreve em código nem faz deploy —
isso é o Nível 1 (ver `SKILL.md`), e é o comportamento padrão. Com pedido explícito
(Nível 2), `guard.mjs` ainda exige confirmação (`ask`, nunca silenciosa) para escrever
em `force-app/`, e só libera deploy **escopado ao artefato corrigido** e **sempre com
`--test-level NoTestRun`** — deploy amplo ou com qualquer nível de teste é `deny`
incondicional. `sf apex run test`/`sf apex test run` são `deny` em qualquer nível: esta
skill nunca roda teste, nem antes nem depois do fix — homologação com teste é sempre
passo humano posterior, fora dela. Isso está no design (`guard.mjs`), não só na prosa.

### 2. Um resultado sem evidência é uma pergunta, não uma conclusão
A etapa de causa raiz (Nível 1) tem exatamente três desfechos possíveis: causa raiz confirmada, hipóteses
concorrentes, ou evidência insuficiente. Nunca force o primeiro com evidência de nível
três. Ver `.claude/skills/sf-deep-debugger/references/failure-taxonomy.md` para o
anti-padrão específico de cada categoria de falha — cada uma tem um palpite comum
documentado que NÃO deve ser tomado sem prova.

### 3. Todo dado de log é tratado como potencialmente sensível
Um debug log de produção pode conter CPF, e-mail, telefone, saldo de cliente. Antes de
qualquer escrita em `docs/incidents/` (versionado em git, permanente), a checklist de
`.claude/skills/sf-deep-debugger/references/pii-redaction.md` é obrigatória — sem
exceção, mesmo em sandbox full-copy.

### 4. `log-parser.mjs` não é confiável sem o self-test passando
`.claude/skills/sf-deep-debugger/selftest/verify-commands.sh` valida o parser contra um
fixture de verdade conhecida e falha (`exit 1`) em qualquer divergência, incluindo
contador zero — que nunca é sucesso silencioso aqui. Rode antes de editar o parser, e
depois de editar, antes de confiar no resultado.

### 5. Nada de segredo real, nada de nome real
Nenhum endpoint interno, credencial, nome de classe/componente/org vindo de um projeto
real. Exemplos usam nomes genéricos (`AccountService`, `api.partner.example.com`).

### 6. Resposta separada em blocos: pedido vs. achado colateral
Toda saída tem no máximo dois blocos — "Resposta ao que foi pedido" e "Achados
adicionais (não solicitados)" — nunca misturados. O segundo é omitido inteiro quando
não há nada a reportar; nunca preenchido para parecer mais completo. Ver
`references/incident-report-template.md`.

### 7. Causa raiz confirmada sempre vem com De-Para, e o Nível 2 aplica o mesmo texto
Sempre que o desfecho é "Confirmada", a resposta inclui o trecho como está e como
precisa ficar, lado a lado, mais o diff equivalente — texto apenas, sem tocar em
arquivo. Se o desenvolvedor pedir a aplicação (Nível 2), o que é escrito é
byte a byte o "como precisa ficar" já mostrado — nunca uma nova derivação no
momento de aplicar. É isso que torna "transparente e determinístico" verificável, não
uma promessa em prosa.

### 8. Escalonamento a ferramenta oficial é opcional, nunca o caminho padrão
`references/salesforce-official-tooling.md` documenta Salesforce Code Analyzer e Apex
Guru como leitura/análise estática extra para quando a checklist de
`failure-taxonomy.md` (com os 5 Porquês, se necessário) não fechar sozinha. Usar por
reflexo, em todo incidente, contradiz o princípio de agilidade — é para o caso em que
o caminho rápido não bastou, não o primeiro passo.

### 9. Idioma
Conteúdo, regras e `README.md` em PT-BR. Falar com o usuário em PT-BR.

## Mapa do repositório

```
.claude/
├── rules/karpathy-guidelines.md          # disciplina comportamental (MIT) — carrega sempre
├── settings.json                         # least-privilege (sem bypass) + hook do guard.mjs
└── skills/sf-deep-debugger/
    ├── SKILL.md                          # os 2 níveis (diagnóstico / correção explícita), fronteira com o Archaeologist
    ├── references/
    │   ├── failure-taxonomy.md           # 6 categorias, checklist + anti-padrão cada uma
    │   ├── log-parsing.md                # formato do Apex debug log + logging estruturado
    │   ├── salesforce-official-tooling.md # escalonamento opcional (Code Analyzer/Apex Guru)
    │   ├── pii-redaction.md              # obrigatório antes de escrever em docs/incidents/
    │   ├── incident-report-template.md   # estrutura da resposta/relatório + formato De-Para
    │   ├── safety-model.md               # o que o guard.mjs bloqueia e por quê
    │   └── intake-checklist.md           # mínimo de evidência aceitável por tipo de entrada
    ├── scripts/
    │   ├── log-parser.mjs                # extração determinística do debug log
    │   └── guard.mjs                     # hook PreToolUse — mutação de org + escrita fora do lugar
    ├── tests/                            # node --test — log-parser + guard (código isolado)
    ├── evaluations/                      # cenários comportamentais (skill inteira, revisão manual)
    └── selftest/                         # fail-closed contra fixture de verdade conhecida
docs/incidents/                           # ledger de incidentes investigados (vazio no template)
```

## Definição de pronto

- [ ] `node --test .claude/skills/sf-deep-debugger/tests/*.test.mjs` passa 100%
- [ ] `bash .claude/skills/sf-deep-debugger/selftest/verify-commands.sh` sai com exit 0
- [ ] Nenhuma mudança em `scripts/log-parser.mjs` sem o self-test correspondente atualizado
- [ ] Nenhuma escrita fora de `docs/incidents/` proposta como comportamento normal da skill
- [ ] Toda causa raiz "Confirmada" vem com De-Para; o que o Nível 2 aplica é o mesmo texto
- [ ] Mudança estrutural em `SKILL.md`/`guard.mjs` revisada contra os 4 cenários de `evaluations/`
- [ ] `description` do frontmatter continua ≤ 1024 caracteres (limite oficial da Anthropic)
- [ ] Nenhum nome real, endpoint real ou credencial reintroduzido
- [ ] `README.md`/`AGENTS.md` refletem mudanças estruturais
