# Redação de PII antes de persistir qualquer conteúdo de log

Esta skill lê logs de **produção real**. Um debug log ou um registro de `LogEntry__c`
pode conter CPF, e-mail, telefone, endereço, saldo ou qualquer outro dado de cliente que
tenha passado por variável, `System.debug()` ou payload de callout. O relatório de
incidente em `docs/incidents/` é um arquivo **versionado em git** — o que entra ali fica
lá permanentemente, inclusive se depois for editado (histórico de commit).

## Regra

**Toda linha de log citada literalmente no relatório de incidente passa por esta
checklist antes da escrita.** Não é opcional, não é "só se parecer sensível" — é
sistemático, porque um dado sensível não anunciado é indistinguível de um dado comum até
alguém procurar.

## Padrões a redigir (substituir por marcador, nunca simplesmente apagar)

| Padrão | Exemplo real | Substituir por |
|---|---|---|
| CPF | `123.456.789-00` | `[CPF REDACTED]` |
| CNPJ | `12.345.678/0001-00` | `[CNPJ REDACTED]` |
| E-mail | `joao.silva@dominio.com` | `[EMAIL REDACTED]` |
| Telefone BR | `(11) 98765-4321` | `[TELEFONE REDACTED]` |
| Valor monetário associado a cliente | `Amount: 15234.50` (em contexto de conta/saldo real) | `[VALOR REDACTED]` |
| Nome completo de pessoa física | em `Contact.Name`, `Account.Name` (pessoa física) | `[NOME REDACTED]` |
| Qualquer Id de registro (`0015g...`) mantém-se — **não é PII por si só**, mas não cite o registro junto com o nome/CPF do mesmo cliente na mesma linha do relatório | — | manter o Id, redigir o que o acompanha |

**Regra prática:** se a linha do log tem um identificador de negócio (CPF, e-mail,
nome) ao lado do dado técnico que você precisa citar (linha, exceção, status code),
mantenha o dado técnico e substitua só o identificador — não precisa (nem deve) apagar
a linha inteira, isso destruiria a evidência.

## O que NÃO precisa de redação

- Nome de classe, método, variável, linha de código — não é dado de cliente.
- Id técnico de registro (`001...`, `a0X...`) sozinho, sem nome/CPF/e-mail ao lado.
- Mensagem de exceção do sistema (`System.NullPointerException: ...`) — é metadado
  técnico, não dado de cliente.
- Endpoint de callout (`https://api.exemplo.com/...`) — a menos que a própria URL
  incorpore um identificador de cliente na query string (`?cpf=123...`), caso em que o
  valor da query string segue a mesma regra da tabela acima.

## Verificação antes de escrever

Antes de gravar `docs/incidents/<slug>.md`, releia cada linha de log citada
literalmente e pergunte: "se este arquivo vazasse hoje, algum dado aqui identificaria
uma pessoa real?" Se sim e ainda não foi redigido, redija antes de salvar — não depois.

Isso não é opcional mesmo em ambiente de teste/sandbox: dado de sandbox costuma ser
cópia de produção (full copy sandbox), então o mesmo cuidado se aplica.
