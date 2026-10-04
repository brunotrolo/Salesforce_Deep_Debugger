# LESSONS.md — lições deste repositório

Append-only. Cada entrada: data, o que aconteceu, e a regra que resultou. Nunca edite
ou remova uma entrada existente — só adicione uma nova no final.

---

## 2026-09-24 — `--source-dir`/`--manifest` não são "escopo estreito" equivalente a `--metadata`

**O que aconteceu:** `NARROW_SCOPE_RE` em `guard.mjs` aceitava `--source-dir`,
`--metadata` ou `--manifest` como escopo estreito suficiente para liberar o quick
deploy de Nível 2 (junto com `--test-level NoTestRun`). Na prática, `--source-dir`
aponta para um diretório (pode conter mais de um artefato) e `--manifest` para um
`package.xml` (pode listar vários componentes) — nenhum dos dois garante "exatamente
UM artefato, o mesmo que o De-Para corrigiu". O quick deploy desta skill nunca tem
closure de dependências a justificar isso (diferente do gate de finalização de outras
skills do arsenal, onde `--source-dir`/`--manifest` continuam corretos para esse caso
diferente) — aqui é sempre um fix conhecido, em um artefato conhecido, então só
`--metadata <Tipo>:<Nome>` é estreito o bastante. `tests/guard.test.mjs` também tinha o
problema espelhado: o próprio teste de "escopo estreito válido" usava
`--source-dir force-app/main/default/classes/X.cls` como exemplo do caminho permitido.

**Correção aplicada:** `NARROW_SCOPE_RE` passou a exigir só `--metadata`. Nova regra
`SOURCE_DIR_OR_MANIFEST_RE` adiciona um branch de `deny` explícito para
`--source-dir`/`--manifest`, com mensagem própria (distinta de "faltou escopo"). O
teste que usava `--source-dir` como exemplo "válido" foi corrigido para
`--metadata ApexClass:LogEntryEventBuilder`. Dois testes novos foram adicionados,
afirmando explicitamente que `--source-dir`/`--manifest` são negados mesmo quando
escopados a um único arquivo e com `NoTestRun` presente — para que a distinção não
regrida silenciosamente numa futura edição do regex.

**Regra resultante:** quando um guard desta skill distingue "escopo estreito" de
"escopo amplo" por flag de CLI, a flag tem que corresponder exatamente a UM artefato —
nunca aceite um diretório ou manifesto como proxy de "um artefato só", mesmo que na
prática costume conter só um. E todo teste que serve de exemplo de "caso válido" tem
que usar o caminho realmente aceito pela regra atual — um teste com exemplo obsoleto é
tão perigoso quanto nenhum teste, porque passa mesmo depois da regra mudar para pior.
