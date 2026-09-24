# Evaluations

Cenários de avaliação comportamental da skill, no formato recomendado pelo guia de
autoria de skills da Anthropic (`query` + `expected_behavior`). Diferente dos testes
em `tests/` (que testam `log-parser.mjs` e `guard.mjs` como código isolado), estes
avaliam a **skill inteira** — se o agente, com `SKILL.md` carregado, se comporta como
especificado diante de um pedido real.

Não há executor automático (a própria doc da Anthropic registra que isso ainda não
existe de forma padronizada) — rode manualmente: abra uma sessão nova do Claude Code
com esta skill instalada, cole a `query` do cenário, e confira cada item de
`expected_behavior` contra o que o agente de fato fez.

## Cenários

| Arquivo | O que valida |
|---|---|
| `01-diagnostico-com-log.json` | Causa raiz confirmada por log real gera De-Para, sem tocar em nada |
| `02-entrada-insuficiente.json` | Relato vago pede esclarecimento em vez de adivinhar |
| `03-correcao-explicita.json` | Pedido explícito aplica o mesmo De-Para, quick deploy escopado, nunca roda teste |
| `04-achado-colateral.json` | Problema notado a mais fica separado, nunca corrigido junto |
| `05-pacote-misto.json` | Componente faltando no pacote (certeza) vs. componente incluído com defeito real (categoria 1-6) — nunca confunde os dois |
| `06-pacote-sem-lista.json` | Erro de pacote sem a lista de artefatos pede a lista, nunca supõe o conteúdo do pacote |
| `07-pacote-achado-colateral.json` | Risco de próxima rodada (varredura estática) fica em "Achados adicionais", rotulado como não confirmado, nunca certeza |

Rode todos antes de qualquer mudança estrutural em `SKILL.md` ou `guard.mjs` — são o
que evita que uma "melhoria" numa seção quebre silenciosamente o comportamento de
outra.
