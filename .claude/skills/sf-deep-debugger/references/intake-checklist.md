# Mínimo de evidência aceitável por tipo de entrada

Antes de avançar para a triagem, confirme que a entrada tem o mínimo abaixo.
Se não tem, **pare e pergunte** pelo que falta — não prossiga com uma entrada
insuficiente supondo que "vai dar pra descobrir no meio do caminho". Um diagnóstico
construído sobre entrada incompleta é pior que nenhum diagnóstico: parece confiável e
não é.

| Tipo de entrada | Mínimo aceitável | Se faltar, pergunte |
|---|---|---|
| Debug log (arquivo ou colado) | Pelo menos uma linha `EXCEPTION_THROWN`, `FATAL_ERROR` ou um `CALLOUT_RESPONSE` com status de erro | "Este log cobre o momento exato da falha? Pode confirmar o nível de log (Apex Code, Callout) usado?" |
| Mensagem de exceção isolada (sem log completo) | O texto completo da mensagem (não paráfrase) | "Pode colar a mensagem exata, sem resumir? E se tiver o debug log completo, melhor ainda." |
| Relato de usuário em linguagem natural ("deu erro na tela X") | Nome da tela/componente + o que o usuário estava tentando fazer + se possível, horário aproximado | "Qual componente/tela exatamente? O que estava sendo feito quando quebrou? Tem o horário aproximado para eu localizar o log?" |
| Payload de Platform Event de erro | O payload completo do evento, não um resumo | "Pode colar o payload JSON completo do evento, sem editar?" |
| Registro de `LogEntry__c` (ou equivalente) | Id do registro OU os campos `Message__c`/`StackTrace__c` completos | "Tem o Id do registro de log, ou os campos de mensagem/stack trace completos?" |
| Erro de validação de pacote/deploy (change set rejeitado) | O erro do Salesforce (JSON de `componentFailures` ou texto colado) **E** a lista de artefatos que fazem parte do pacote | "Pode colar a lista de artefatos (Tipo:Nome, um por linha) que fazem parte deste pacote? Sem ela não dá pra saber com certeza o que faltou incluir." |

## Regra geral

Uma entrada "vaga o suficiente para adivinhar" nunca é suficiente. Exemplo do que NÃO
prosseguir com: *"o sistema deu erro ontem"* — sem componente, sem horário, sem
mensagem. Isso é indistinguível de dezenas de causas diferentes; prosseguir aqui produz
um relatório que parece ter investigado algo, mas na verdade inventou.
