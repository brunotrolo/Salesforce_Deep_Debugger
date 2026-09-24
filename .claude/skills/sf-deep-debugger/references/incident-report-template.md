# Template de resposta / relatório de incidente

Toda resposta desta skill — no chat e, se salva, em
`docs/incidents/<AAAA-MM-DD>-<slug-curto>.md` — segue esta estrutura. Nunca omita uma
seção do Nível 1; se não há dado para ela, escreva explicitamente "não disponível"
(nunca deixe em branco, que é indistinguível de "esqueceu de preencher"). "Achados
adicionais" e o De-Para são as únicas seções condicionais — omita inteiras quando não
se aplicam, nunca invente algo para preenchê-las.

```markdown
# <título curto e específico do que foi declarado>

- **Categoria:** <uma das 6 de references/failure-taxonomy.md>
- **Componente(s):** <classe/Flow/LWC, arquivo:linha>
- **Jornada/domínio:** <se docs/archaeologist/CAPABILITIES_MAP.md existir e mapear isso; senão "não disponível">

## Evidência

<Linhas de log/código citadas literalmente, JÁ REDIGIDAS conforme
references/pii-redaction.md se vierem de log real.>

## Resposta ao que foi pedido

**Desfecho:** Confirmada | Hipóteses concorrentes | Evidência insuficiente

<Exatamente o que foi declarado — nada mais amplo. Se Hipóteses concorrentes: cada
uma, ordenada por força de evidência, com o que falta para confirmar — incluindo, se
usados, os "porquês" percorridos até a evidência se esgotar. Se Evidência
insuficiente: o que falta exatamente e como obter.>

### Se Confirmada — sugestão de correção (De-Para)

**Como está** (`<arquivo>:<linha inicial>-<linha final>`):
```apex
<trecho exato do código hoje>
```

**Como precisa ficar:**
```apex
<trecho corrigido — só a mudança que a causa raiz exige, nada além>
```

**Diff equivalente** (mesma mudança, formato aplicável por ferramenta):
```diff
<diff mínimo>
```

Isto é uma sugestão em texto — nenhum arquivo foi tocado, nenhum deploy aconteceu.
Aplicar é sempre um passo separado, só sob pedido explícito (ver seção seguinte).

## Achados adicionais (não solicitados)

<OMITIR ESTA SEÇÃO INTEIRA se não houve nada além do que foi pedido. Se houve: liste
separado, sinalizado como não solicitado, nunca corrigido junto com a resposta
principal — mesmo que pareça relacionado.>

## Correção aplicada (Nível 2 — só se explicitamente pedida)

<OMITIR se o desenvolvedor não pediu a aplicação. Quando pedida, o código aplicado é
BYTE A BYTE o mesmo "Como precisa ficar" já mostrado acima — nunca uma nova derivação
no momento de aplicar.>

**Quick deploy:** `sf project deploy start --metadata <Tipo>:<Nome> --test-level NoTestRun`
(ex.: `--metadata ApexClass:LogEntryEventBuilder`; pede confirmação — nunca roda
sozinho). Valida que o fix subiu; não substitui homologação.

**Teste:** não incluído. Homologação com teste de cobertura é um passo posterior,
depois da confirmação do desenvolvedor de que o quick deploy resolveu — normalmente
outra skill (`apex-test-loop`), fora do escopo desta.

## Recorrência

<Se salvo em docs/incidents/: resultado da busca por incidentes anteriores na mesma
classe/método. Se é o primeiro, diga isso. Se há recorrência, cite os incidentes
anteriores por nome de arquivo.>
```

## Exemplo completo (causa raiz Confirmada, sem pedido de correção)

```markdown
# NPE em AccountService.getPrimaryContact ao processar Account sem Contact vinculado

- **Categoria:** 2. Exceção não tratada (NPE / DML / tipo)
- **Componente(s):** `AccountService.cls:42`
- **Jornada/domínio:** não disponível

## Evidência

`14:02:10.400 (912000000)|EXCEPTION_THROWN|[42]|System.NullPointerException: Attempt to de-reference a null object`
— debug log fornecido pelo usuário.

## Resposta ao que foi pedido

**Desfecho:** Confirmada

A linha 42 acessa `contacts[0].Email` sem checar se `contacts` (retorno de
`[SELECT Id, Email FROM Contact WHERE AccountId = :acc.Id]`) veio vazio. Para uma
Account sem Contact vinculado, a query retorna lista vazia e `contacts[0]` lança NPE
— consistente com a linha do `EXCEPTION_THROWN`.

### Se Confirmada — sugestão de correção (De-Para)

**Como está** (`AccountService.cls:40-43`):
```apex
List<Contact> contacts = [SELECT Id, Email FROM Contact WHERE AccountId = :acc.Id];
String email = contacts[0].Email;
return email;
```

**Como precisa ficar:**
```apex
List<Contact> contacts = [SELECT Id, Email FROM Contact WHERE AccountId = :acc.Id];
if (contacts.isEmpty()) {
    return null;
}
return contacts[0].Email;
```

**Diff equivalente:**
```diff
 List<Contact> contacts = [SELECT Id, Email FROM Contact WHERE AccountId = :acc.Id];
-String email = contacts[0].Email;
-return email;
+if (contacts.isEmpty()) {
+    return null;
+}
+return contacts[0].Email;
```

Isto é uma sugestão em texto — nenhum arquivo foi tocado, nenhum deploy aconteceu.

## Recorrência

Primeiro incidente registrado para `AccountService.cls`.
```
