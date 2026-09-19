# Self-test do `sf-deep-debugger`

`verify-commands.sh` roda o `log-parser.mjs` contra `fixtures/incident.log` — um log
sintético e agnóstico, com verdade conhecida registrada em `fixtures/expected.json` —
e falha (`exit 1`) em qualquer divergência, **incluindo contador zero**, que nunca é
sucesso silencioso aqui.

## Rodar

```bash
bash .claude/skills/sf-deep-debugger/selftest/verify-commands.sh
```

## Por que existe

Um comando de extração quebrado (regex errada, delimitador mal escapado, campo com
nome trocado) tende a **retornar zero ou um valor plausível sem emitir erro** — e isso
é indistinguível de "o log realmente não tinha isso" até alguém provar com uma
verdade conhecida. Nesta skill o custo de errar é maior que o normal: o diagnóstico
final vira input para uma decisão sobre um sistema de produção real.

Rode isto antes de usar a skill pela primeira vez num projeto e sempre que editar
`scripts/log-parser.mjs`.
