# Karpathy Guidelines — aplicadas à investigação de incidente de produção

Diretrizes comportamentais para reduzir erros comuns de LLM em código, derivadas das
[observações de Andrej Karpathy](https://x.com/karpathy/status/2015883857489522876) sobre
armadilhas de LLM em programação.

Origem: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
(MIT). As quatro seções abaixo estão **na íntegra**, em tradução fiel; cada uma traz depois
um bloco `Neste projeto` que contextualiza a diretriz para investigar um incidente já
ocorrido em produção — a contextualização acrescenta, nunca substitui nem relaxa a
orientação original.

**Tradeoff:** estas diretrizes privilegiam cautela sobre velocidade. Para tarefas triviais, use bom senso.

---

## 1. Pense Antes de Codar

**Não presuma. Não esconda confusão. Exponha tradeoffs.**

Antes de implementar:
- Declare suas premissas explicitamente. Se estiver incerto, pergunte.
- Se existem múltiplas interpretações, apresente-as — não escolha silenciosamente.
- Se existe uma abordagem mais simples, diga. Discorde quando for o caso.
- Se algo está obscuro, pare. Nomeie o que está confuso. Pergunte.

> **Neste projeto.** É a etapa de causa raiz do Nível 1 inteira: **um resultado sem evidência suficiente é uma
> pergunta, não uma conclusão.** A skill declara explicitamente um de três desfechos —
> causa raiz confirmada, hipóteses concorrentes, ou evidência insuficiente — e nunca
> força o primeiro quando só tem evidência para o terceiro. "Provavelmente é isso" não é
> um veredito aceitável quando o log não prova.
>
> O risco específico aqui é que **a causa raiz errada vira um fix aplicado em
> produção**. Um palpite convincente sobre por que algo quebrou, sem a linha de log que
> prova, custa mais do que não ter diagnóstico nenhum — parece confiável e não é. Se o
> log não prova, é pergunta, não premissa.

---

## 2. Simplicidade Primeiro

**O mínimo de código que resolve o problema. Nada especulativo.**

- Nenhuma funcionalidade além do que foi pedido.
- Nenhuma abstração para código de uso único.
- Nenhuma "flexibilidade" ou "configurabilidade" que não foi solicitada.
- Nenhum tratamento de erro para cenários impossíveis.
- Se você escreveu 200 linhas e dava para fazer em 50, reescreva.

Pergunte a si mesmo: "Um engenheiro sênior diria que isto está complicado demais?" Se sim, simplifique.

> **Neste projeto.** O fix candidato do Nível 2 é sempre o **mínimo que a causa raiz
> confirmada exige** — nunca uma oportunidade para "melhorar" o método enquanto está
> ali. Um `null check` a mais não pedido, um retry genérico "para o futuro", uma
> refatoração do método inteiro porque já estava sendo lido: nada disso rastreia à
> causa raiz do incidente, e tudo isso é mudança não revisada indo junto com o fix
> real.
>
> Vale também para o relatório: uma seção "Prevenção" com uma lista de dez melhorias
> arquiteturais é ruído — a prevenção deste incidente específico, e só ela.

---

## 3. Mudanças Cirúrgicas

**Toque apenas no que precisa. Limpe apenas a sua própria bagunça.**

Ao editar código existente:
- Não "melhore" código adjacente, comentários ou formatação.
- Não refatore coisas que não estão quebradas.
- Siga o estilo existente, mesmo que você fizesse diferente.
- Se notar código morto não relacionado, mencione — não apague.

Quando suas mudanças criam órfãos:
- Remova imports/variáveis/funções que **as suas** mudanças tornaram inúteis.
- Não remova código morto pré-existente a menos que peçam.

O teste: toda linha alterada deve ser rastreável diretamente ao pedido do usuário.

> **Neste projeto.** Esta diretriz tem consequência técnica direta aqui, não só
> disciplinar: por padrão (Nível 1, diagnóstico) o fix candidato nunca é aplicado in
> loco — só aparece como diff na resposta. Se o usuário pede a correção explicitamente
> (Nível 2), `guard.mjs` ainda exige confirmação (`ask`, nunca silenciosa) para
> `Write`/`Edit` em `force-app/`, e o deploy só é liberado escopado ao artefato do fix,
> nunca ao projeto inteiro (ver `references/safety-model.md`). Isso não é conveniência
> de fluxo: é a garantia técnica de que "mudança cirúrgica" não depende só de a skill
> se comportar bem, porque uma mudança direta em código de produção, feita por engano
> ou por excesso de confiança na causa raiz, é o pior cenário possível para esta skill
> especificamente.
>
> Vale também para o escopo da investigação: o incidente é **UM** sintoma. Se durante a
> investigação você notar outro problema não relacionado no mesmo arquivo, reporte —
> não expanda o incidente para cobri-lo.

---

## 4. Execução Orientada a Objetivo

**Defina critérios de sucesso. Itere até verificar.**

Transforme tarefas em objetivos verificáveis:
- "Adicione validação" → "Escreva testes para entradas inválidas, depois faça-os passar"
- "Corrija o bug" → "Escreva um teste que o reproduz, depois faça-o passar"
- "Refatore X" → "Garanta que os testes passam antes e depois"

Para tarefas multi-etapa, declare um plano breve:
```
1. [Passo] → verificar: [checagem]
2. [Passo] → verificar: [checagem]
3. [Passo] → verificar: [checagem]
```

Critérios de sucesso fortes permitem iterar de forma independente. Critérios fracos
("faça funcionar") exigem esclarecimento constante.

> **Neste projeto.** As 4 fases (Intake → Triagem → Causa Raiz → Fix + Relatório) são
> esse plano, e o critério de sucesso da etapa de causa raiz é explícito e verificável: não "parece
> que é isso", mas um dos três desfechos nomeados, cada um com seu próprio padrão de
> evidência exigido.
>
> O ponto que merece nome próprio: **o `log-parser.mjs` tem self-test com verdade
> conhecida** (`selftest/verify-commands.sh`) exatamente porque um script de extração
> quebrado tende a devolver zero ou um número plausível sem erro — indistinguível de
> "o log realmente não tinha isso" até alguém provar contra um fixture. Confiar no
> parser sem essa prova é o caso clássico de critério fraco vestido de forte: "o script
> rodou sem erro" não é o mesmo que "o script extraiu certo".

---

*Diretrizes derivadas de observações de Andrej Karpathy, via
[multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills),
licença MIT. Os blocos `Neste projeto` são contextualização própria deste repositório.*
