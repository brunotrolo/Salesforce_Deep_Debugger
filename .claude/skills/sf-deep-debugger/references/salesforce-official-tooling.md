# Ferramentas oficiais Salesforce — escalonamento opcional

Este arquivo existe para o caso em que a checklist de `failure-taxonomy.md` **não**
chega a uma causa raiz confirmada com o que já está disponível. Não é passo padrão —
usar isso por reflexo contradiz o princípio central desta skill (agilidade). Só chegue
aqui depois de aplicar a checklist da categoria e, se aplicável, os 5 Porquês, sem
resultado.

Todas as ferramentas abaixo são **leitura/análise estática**, sem mutação de org e sem
execução de teste — coerente com o Nível 1 (diagnóstico).

## Salesforce Code Analyzer (PMD + Graph Engine)

Scan estático pontual no arquivo específico do incidente — mais rápido que ler a
classe inteira à procura de um antipadrão conhecido, e determinístico (a mesma
entrada sempre produz o mesmo achado).

```bash
sf code-analyzer run --target force-app/main/default/classes/<Classe>.cls --rule-selector Security,Performance
```

Já está no `permissions.allow` desta skill (mesmo comando usado pela `apex-test-loop`
irmã). Regras mais relevantes por categoria de `failure-taxonomy.md`:

| Categoria | Regra a procurar no output |
|---|---|
| 1. Governor limit | `AvoidSoqlInLoops`, `AvoidDmlStatementsInLoops`, `OperationWithLimitsInLoop` |
| 4. Permissão (FLS/sharing) | `ApexCRUDViolation`, `ApexSharingViolations` |

Um achado do Code Analyzer não é automaticamente a causa raiz deste incidente
específico — é um sinal a mais para a checklist. Trate como evidência, não como
veredito pronto: confirme que a linha apontada pela regra é a mesma que a
`EXCEPTION_THROWN`/comportamento relatado aponta, não só "a classe tem esse
antipadrão em algum lugar".

## Apex Guru (se licenciado no org)

Análise de performance mais profunda que o Code Analyzer para padrões de governor
limit em volume real de produção — mas depende de licença/feature habilitada, nem
toda org tem. Se disponível, é mencionado ao usuário como opção, nunca assumido:

```bash
sf apexguru scan --file force-app/main/default/classes/<Classe>.cls
```

Se o comando falhar por falta de licença, isso não é erro desta skill — declare
"ferramenta não disponível neste org" e continue com o que a checklist já deu.

## Confirmar um risco de referência de pacote (opcional, nunca padrão)

`scripts/package-reference-scanner.mjs` (categoria 0 de `failure-taxonomy.md`) só
sabe dizer "este componente é referenciado mas não está na lista do pacote" — nunca
sabe se ele já existe no org de destino, porque isso só a própria org sabe. Se o
desenvolvedor tem uma org autenticada à mão e quer confirmar em vez de só
suspeitar, uma consulta pontual e **read-only** resolve isso:

```bash
sf data query --query "SELECT Id FROM ApexClass WHERE Name = '<Nome>'" --target-org <alias> --json
# ou, para outros tipos de metadado:
sf sobject describe --sobject <Nome> --target-org <alias> --json
```

Transforma "risco não confirmado" em "confirmado: falta também no destino, incluir
no pacote" ou "falso positivo, já existe lá". Mesmo padrão das ferramentas acima:
opcional, nunca o caminho padrão — só quando o desenvolvedor quiser mais certeza
que a varredura estática sozinha dá. Nunca dispare isso por padrão; a varredura
estática (rápida, sem rede) já é o suficiente para o relatório na maioria dos casos.

## O que esta skill NUNCA invoca sozinha

`sf apex log tail` (observação de log ao vivo) não é usado por esta skill — é
bloqueante/contínuo, o oposto de "instantâneo". Se o desenvolvedor já está rodando um
tail e cola o trecho relevante, isso é intake normal (debug log colado); a skill nunca
inicia o tail por conta própria.
