# Taxonomia de falhas — checklist de diagnóstico por categoria

Cada categoria tem: **sinal no log/mensagem** (como reconhecer), **checklist de
diagnóstico** (o que verificar, em ordem, antes de declarar causa raiz) e **anti-padrão
comum** (o palpite errado mais frequente — o que NÃO concluir sem prová-lo).

## Conteúdo

0. Falha de validação de pacote/Metadata API (pré-triagem — ver seção 0 abaixo)
1. Governor limit
2. Exceção não tratada (NPE / DML / tipo)
3. Callout externo (timeout / 4xx / 5xx)
4. Permissão (FLS / sharing / CRUD)
5. Erro de Flow
6. Erro de LWC (console / Lightning error)

## 0. Falha de validação de pacote/Metadata API (pré-triagem)

Não é uma categoria como as 6 abaixo: não tem checklist de causa raiz próprio. Um
`componentFailure` de deploy/validação de pacote sempre se resolve de uma de duas
formas — e qual delas é decidido por conferência exata de lista, não por julgamento:

**Sinal:** o desenvolvedor cola o erro de um deploy/change set rejeitado
(`sf project deploy report --json`, texto da tela do Setup, ou saída humana do
`sf project deploy report`) junto com a lista de artefatos que fazem parte do
pacote.

**Processo:**
1. **Intake exige as duas evidências** — o erro E a lista de artefatos do pacote. Sem a
   lista, **pare e pergunte** (ver `references/intake-checklist.md`) — é impossível
   dizer honestamente "isso faltou no pacote" sem saber o que já está nele.
2. Rode `scripts/package-validation-parser.mjs --errors <arquivo> --package <arquivo>`.
   Ele classifica cada falha, por conferência exata de lista (não é julgamento):
   - **`faltando_no_pacote`** — o componente citado no erro NÃO está na lista do
     pacote. Causa raiz decidida pelo script; não precisa da checklist de nenhuma
     categoria abaixo.
   - **`precisa_diagnostico`** — o componente ESTÁ na lista, então o erro é um
     defeito real dentro de um artefato incluído, não uma dependência ausente.
     Aplique a categoria correspondente (1-6) a cada um desses, exatamente como já
     faz para um bug único — inclusive os 3 desfechos possíveis e os 5 Porquês se
     necessário.
3. Rode também `scripts/package-reference-scanner.mjs --package <arquivo> --root
   <force-app>` — varredura estática local que aponta referências a componentes fora
   da lista do pacote que o Salesforce ainda não reclamou (a validação é
   incremental e para na primeira leva de erros). **Isso é sempre risco não
   confirmado, nunca certeza** — vai só em "Achados adicionais", nunca na resposta
   principal, nunca corrigido/incluído no pacote sozinho.
4. Acima de ~15 itens em `precisa_diagnostico`: resuma o padrão predominante em vez
   de rodar o checklist completo em cada um, e declare isso explicitamente — não é
   risco de loop (a lista é finita), é risco de estourar o orçamento de contexto
   numa lista muito grande.

**Anti-padrão comum:** assumir que toda falha citando outro componente significa
"faltou no pacote" sem checar se ele já está na lista declarada — nesse caso o erro
é um defeito real dentro de um artefato incluído (categoria 1-6), não uma
dependência ausente. A conferência de lista do script existe exatamente para não
depender de leitura apressada disso.

## 1. Governor limit

**Sinal:** `System.LimitException`, `Too many SOQL queries: 101`, `Too many DML
statements: 151`, `Apex CPU time limit exceeded`, `Too many query rows: 50001`.

**Checklist:**
1. A linha `LIMIT_USAGE_FOR_NS` do log mostra o contador no momento do estouro — qual
   limite, quanto foi usado, quanto era o teto.
2. O estouro ocorre dentro de um loop? Procure `SOQL`/`DML` sem agrupamento
   (`for (... ) { [SELECT ...] }` ou `for (...) { update x; }`).
3. Se não há SOQL/DML em loop óbvio, suspeite de **bulk real**: o código pode estar
   correto para 1 registro e quebrar só acima de N — confirme o volume do trigger/batch
   que disparou o erro (quantos registros no `Trigger.new`/no lote do Batch/Queueable).
4. CPU time: procure processamento síncrono pesado (regex complexo, serialização grande,
   chamada recursiva) — não é sempre SOQL/DML.

**Anti-padrão comum:** concluir "SOQL em loop" só porque há um SOQL dentro de um método
chamado a partir de um loop — confirme que o SOQL está *dentro* do corpo do loop, não
que o método é *chamado por* um loop (uma função bem escrita com SOQL fora do loop,
chamada dentro de um loop, não estoura).

## 2. Exceção não tratada (NPE / DML / tipo)

**Sinal:** `System.NullPointerException`, `System.DmlException`,
`System.TypeException`, `System.ListException: List index out of bounds`.

**Checklist:**
1. Linha exata do `EXCEPTION_THROWN` no log → arquivo:linha no código.
2. Para NPE: qual variável é null na linha indicada? Rastreie de onde ela deveria ter
   sido populada (retorno de SOQL vazio, campo relacionado null, resultado de callout
   não tratado).
3. Para DmlException: a mensagem inclui a razão exata (validation rule, required field
   missing, trigger de outro objeto). Leia a mensagem completa — geralmente já é a causa
   raiz, não só o sintoma.
4. Confirme se existe `try/catch` capturando e mascarando a exceção original mais acima
   na pilha — nesse caso a linha do log pode ser um *rethrow* genérico, não a origem.

**Anti-padrão comum:** corrigir só o sintoma (`if (x != null)`) sem entender por que `x`
chegou null — isso silencia o erro sem resolver a causa; documente ambos no relatório.

## 3. Callout externo (timeout / 4xx / 5xx)

**Sinal:** `System.CalloutException: Read timed out`, `Unauthorized endpoint`,
resposta HTTP 4xx/5xx num `HttpResponse`.

**Checklist:**
1. `CALLOUT_REQUEST`/`CALLOUT_RESPONSE` no log: qual endpoint, qual status code, qual
   corpo de resposta (se logado).
2. 401/403 → sempre credencial/token, nunca "bug de código" — verifique Named
   Credential / External Credential / expiração de token, não o Apex.
3. 4xx (exceto 401/403) → payload de request provavelmente não confere com o contrato
   esperado pela API remota — compare contra a spec/documentação da integração, se
   existir (`apex-callouts-developer` deste mesmo arsenal documenta o contrato quando a
   integração foi migrada por ele).
4. 5xx ou timeout → provavelmente não é bug seu; documente como "falha do sistema
   externo" e verifique se existe retry/circuit breaker — se não existe, é a
   recomendação de prevenção do relatório, não um fix de código imediato.
5. Nunca assuma qual foi o payload enviado sem o log de `CALLOUT_REQUEST` — se não foi
   logado, é evidência insuficiente (desfecho 3 da etapa de causa raiz), não motivo para supor.

**Anti-padrão comum:** tratar todo erro de callout como "bug no Apex" — a maioria dos
erros de callout em produção é do lado do sistema externo ou da credencial, não do
código que monta o request.

## 4. Permissão (FLS / sharing / CRUD)

**Sinal:** `System.SecurityException: Insufficient permissions`,
`INSUFFICIENT_ACCESS_OR_READONLY`, registro que deveria aparecer mas não aparece para um
usuário específico (sharing silencioso — sem exceção, só resultado vazio).

**Checklist:**
1. O código roda `without sharing` ou `with sharing`? Isso muda a interpretação de "não
   apareceu": `with sharing` respeitando regra de compartilhamento é comportamento
   correto, não bug — confirme qual era o esperado antes de tratar como defeito.
2. FLS: o código usa `Security.stripInaccessible` ou verifica `isAccessible()` antes do
   acesso? Se não, e o erro é de campo específico, é ausência de enforcement — mas
   confirme que o *usuário* de fato não tem o campo no seu Profile/Permission Set antes
   de propor mudança de código (pode ser configuração, não bug).
3. Reproduza a checagem de permissão do usuário específico (Profile + Permission Sets
   atribuídos) antes de concluir — "deveria ter acesso" sem checar é palpite.

**Anti-padrão comum:** tratar "sharing funcionando como configurado" como bug de código.
Sharing e FLS são comportamento de plataforma — o "erro" às vezes é a configuração, e a
recomendação correta é mudar o Permission Set, não o Apex.

## 5. Erro de Flow

**Sinal:** fault message do Flow (`FlowException`, "Element X failed"), Flow Interview
travado ou finalizado com erro.

**Checklist:**
1. A fault message do Flow geralmente cita o elemento exato e a mensagem de erro
   subjacente (muitas vezes uma `DmlException` de um Create/Update Records element,
   propagada de volta).
2. Trate a causa subjacente citada na fault message com a categoria correspondente
   (ex.: se é uma validation rule, é categoria 2 — DML — não uma categoria de Flow
   separada).
3. Verifique ordem de execução se múltiplos Flows/triggers tocam o mesmo objeto no mesmo
   contexto — um Flow pode falhar por efeito colateral de outra automação que rodou
   antes dele no mesmo transaction.

**Anti-padrão comum:** tratar o Flow como a causa raiz quando ele só está propagando o
erro de uma validation rule ou de um required field — a fault message quase sempre diz
isso, mas é fácil parar de ler no nome do elemento em vez da mensagem completa.

## 6. Erro de LWC (console / Lightning error)

**Sinal:** erro no console do navegador, `LWC1101`/`LWC1133` etc., toast de erro
genérico na tela, `LightningElement` que não renderiza.

**Checklist:**
1. Erro de `@wire`/chamada Apex imperativa: o erro do console geralmente embrulha a
   `AuraHandledException`/mensagem do Apex — trate a causa Apex subjacente com a
   categoria correspondente (2, 3 ou 4).
2. Erro puramente de front-end (binding, getter lançando exceção, propriedade
   `undefined`): confirme se é regressão de uma mudança recente no componente (histórico
   de commits do arquivo) antes de supor causa em dado do servidor.
3. Erro de `LightningElement` genérico (`LWC1133: attribute "x" is ambiguous`) costuma
   ser erro de template/build, não de dado em runtime — não confunda com bug de lógica.

**Anti-padrão comum:** propor fix no LWC quando a causa raiz é a `AuraHandledException`
do Apex por trás do `@wire` — sempre desembrulhe até a exceção original antes de decidir
em qual camada o fix pertence.
