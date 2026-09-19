# Formato do Apex debug log e schema de logging estruturado

## Apex debug log (formato nativo)

Um debug log é texto delimitado por `|`, uma linha por evento. Formato geral:

```
TIMESTAMP|EVENT_TYPE|detalhe1|detalhe2|...
```

Exemplo real de uma linha de exceção:
```
09:15:22.123 (123456789)|EXCEPTION_THROWN|[45]|System.NullPointerException: Attempt to de-reference a null object
```

**Cuidado ao usar `rg`/regex sobre log:** o delimitador `|` é **literal**, não
alternação. `grep "METHOD_EXIT|EXCEPTION"` (sem escapar) faz alternação regex (busca
`METHOD_EXIT` OU `EXCEPTION` em qualquer lugar) — o que geralmente é o que você quer para
buscar por tipo de evento, mas se a intenção é casar a estrutura literal
`METHOD_EXIT|algumacoisa|` (dois eventos na mesma linha, delimitados), o `|` precisa ser
escapado (`\|`). Confirme qual dos dois você quer antes de escrever o comando — os dois
retornam resultado sem erro, e o errado retorna silenciosamente vazio ou errado.

### Linhas relevantes para esta skill

| EVENT_TYPE | O que carrega |
|---|---|
| `EXCEPTION_THROWN` | Linha + tipo + mensagem da exceção lançada |
| `FATAL_ERROR` | Erro que encerrou a execução |
| `LIMIT_USAGE_FOR_NS` | Snapshot de uso de governor limits (SOQL, DML, CPU, heap) no ponto do log |
| `CALLOUT_REQUEST` | Endpoint e método HTTP do callout (nem sempre loga o payload — depende do nível de log) |
| `CALLOUT_RESPONSE` | Status code e (se logado) corpo da resposta |
| `USER_DEBUG` | `System.debug()` explícito no código — evidência direta se o dev já instrumentou |
| `DML_BEGIN` / `DML_END` | Operação DML, tipo, quantidade de linhas |
| `SOQL_EXECUTE_BEGIN` / `SOQL_EXECUTE_END` | Query executada e linhas retornadas |

### Nível de log necessário

Um log com nível padrão (`FINE`/`DEBUG`) pode não conter `CALLOUT_REQUEST`/`CALLOUT_RESPONSE`
com corpo completo. Se a etapa de causa raiz precisar do payload exato e o log não tiver, isso é
"evidência insuficiente" (desfecho 3) — a instrução correta é pedir para reproduzir com
um nível de log mais detalhado (`Apex Code: FINEST`, `Callout: FINEST`), nunca supor o
conteúdo do payload.

## Logging estruturado (Nebula Logger ou equivalente)

Se o projeto usa uma solução de logging estruturado (ex.: `LogEntry__c` ou similar,
gravado em objeto customizado consultável via SOQL), prefira consultá-lo — é mais
confiável que pedir para o usuário garimpar um debug log manualmente:

```apex
SELECT Message__c, StackTrace__c, LoggingLevel__c, TransactionId__c, TimestampField__c
FROM LogEntry__c
WHERE CreatedDate = TODAY
ORDER BY TimestampField__c DESC
LIMIT 50
```

Ajuste os nomes de campo ao schema real do projeto (varia por implementação) — nunca
assuma um nome de campo sem confirmar no schema (`sf sobject describe` ou
`Grep` no `force-app/` por `__c` que pareça de logging).

## `log-parser.mjs` — extração determinística

`.claude/skills/sf-deep-debugger/scripts/log-parser.mjs` faz a extração mecânica das
linhas acima num JSON compacto, na mesma filosofia do `pattern-extractor.mjs` da
`lwc-pattern-documenter` irmã: **o script mede, o agente julga**. Uso:

```bash
node .claude/skills/sf-deep-debugger/scripts/log-parser.mjs --log caminho/para/o.log
```

Saída: `exceptions[]`, `limitUsage[]`, `callouts[]`, `dml[]`, `soql[]`,
`userDebug[]` — cada item com a linha completa original preservada (para citação exata
na etapa de causa raiz) e os campos estruturados extraídos.
