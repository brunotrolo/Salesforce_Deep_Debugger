#!/usr/bin/env bash
# verify-commands.sh — self-test FAIL-CLOSED do log-parser.mjs.
# ---------------------------------------------------------------------------
# Roda o parser contra um log sintético de verdade CONHECIDA (fixtures/incident.log
# + expected.json) e falha com exit 1 em qualquer divergência — incluindo contador
# zero, que NUNCA é sucesso silencioso aqui (mesma regra fail-closed do
# sf-archaeologist: um comando de extração quebrado retorna zero sem erro, e zero é
# indistinguível de "o log realmente não tem isso" até você provar com um fixture
# de verdade conhecida).
#
# Nota de projeto: uma versão anterior deste script usava `python3 -c` com aspas
# duplas escapadas dentro de bash -- as aspas quebravam silenciosamente, os dois
# lados do check comparavam string vazia contra string vazia, e o script imprimia
# "OK" e saía 0 sem ter checado nada. É o mesmo bug de classe (comando de
# verificação quebrado retorna vazio sem erro) que este próprio self-test existe
# para prevenir no log-parser -- pegou a si mesmo primeiro. Reescrito em Node puro
# (sem aspas aninhadas) para eliminar a classe do bug, não só a instância.
#
# Rode isto ANTES de usar a skill contra um log real, e sempre que editar
# log-parser.mjs.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

FAIL=0
check() {
  local label="$1" got="$2" want="$3"
  if [ -z "$got" ] || [ -z "$want" ]; then
    echo "  FALHA $label — valor vazio (comando de verificação quebrado, não um match real)"
    FAIL=1
  elif [ "$got" = "$want" ]; then
    echo "  OK   $label ($got)"
  else
    echo "  FALHA $label — obtido: $got | esperado: $want"
    FAIL=1
  fi
}

node ../scripts/log-parser.mjs --log fixtures/incident.log > /tmp/ddbg-selftest-out.json

read -r linesScanned exceptions limitUsage callouts dml soql userDebug status0 status1 <<NODEOUT
$(node -e '
const d = require("/tmp/ddbg-selftest-out.json");
const out = [
  d.linesScanned,
  d.exceptions.length,
  d.limitUsage.length,
  d.callouts.length,
  d.dml.length,
  d.soql.length,
  d.userDebug.length,
  d.callouts[0] && d.callouts[0].statusCode,
  d.callouts[1] && d.callouts[1].statusCode,
];
console.log(out.map((v) => (v === undefined || v === null ? "null" : v)).join(" "));
')
NODEOUT

read -r wLinesScanned wExceptions wLimitUsage wCallouts wDml wSoql wUserDebug wStatus0 wStatus1 <<NODEOUT
$(node -e '
const d = require("./fixtures/expected.json");
const out = [
  d.linesScanned, d.exceptions, d.limitUsage, d.callouts, d.dml, d.soql, d.userDebug,
  d.calloutStatusCodes[0], d.calloutStatusCodes[1],
];
console.log(out.map((v) => (v === undefined || v === null ? "null" : v)).join(" "));
')
NODEOUT

check "linesScanned"             "$linesScanned" "$wLinesScanned"
check "exceptions (contagem)"    "$exceptions"   "$wExceptions"
check "limitUsage (contagem)"    "$limitUsage"   "$wLimitUsage"
check "callouts (contagem)"      "$callouts"     "$wCallouts"
check "dml (contagem)"           "$dml"          "$wDml"
check "soql (contagem)"          "$soql"         "$wSoql"
check "userDebug (contagem)"     "$userDebug"    "$wUserDebug"
check "statusCode do 1o callout" "$status0"      "$wStatus0"
check "statusCode do 2o callout" "$status1"      "$wStatus1"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "== Resultado: todos os checks OK =="
  echo "log-parser.mjs validado contra fixture de verdade conhecida. Pode prosseguir."
  exit 0
else
  echo "== Resultado: FALHAS encontradas =="
  echo "NÃO confie no log-parser.mjs até corrigir — um contador errado aqui produz"
  echo "um diagnóstico de incidente errado sobre dado de produção real."
  exit 1
fi
