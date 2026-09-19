# `docs/incidents/` — ledger de incidentes investigados

Cada arquivo aqui é uma resposta salva do Nível 1/2 do `sf-deep-debugger`, seguindo
`.claude/skills/sf-deep-debugger/references/incident-report-template.md`. Nome do
arquivo: `<AAAA-MM-DD>-<slug-curto>.md`.

**Por que isso é um ledger e não um arquivo por caso descartado depois:** a skill
sempre busca aqui primeiro por incidentes anteriores na mesma classe/método antes de
declarar um novo. É como o skill detecta recorrência — um sintoma que se repete é o
sinal mais forte de que um fix anterior não corrigiu a causa raiz, ou de que existe um
padrão estrutural (não um bug pontual). Sem o histórico, cada investigação recomeça do
zero e a recorrência passa despercebida.

**Todo conteúdo aqui já passou pela checklist de
`.claude/skills/sf-deep-debugger/references/pii-redaction.md`** antes de ser
commitado — este diretório é versionado em git, então nenhum dado real de cliente deve
chegar até aqui sem redação.

Vazio no template deste repositório — populado conforme incidentes reais forem
investigados no projeto onde esta skill for instalada.
