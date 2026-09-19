#!/usr/bin/env node
// guard.mjs — hook PreToolUse desta skill.
// ---------------------------------------------------------------------------
// Modelo de dois níveis (ver references/safety-model.md):
//
//   NÍVEL 1 — Diagnóstico (padrão, sempre). Nunca muta a org, nunca roda teste
//   (local, sandbox ou produção — diagnóstico usa só o que já foi declarado/logado,
//   nunca reproduz executando algo), nunca escreve fora de docs/incidents/.
//
//   NÍVEL 2 — Correção explícita (só quando o usuário pede). Mesmo aqui:
//     - Escrever no artefato de código (Write/Edit em force-app/ ou equivalente)
//       vira `ask` (nunca silencioso) — a confirmação da ferramenta É o "pedido
//       explícito" se tornando ação.
//     - Deploy só é permitido ESCOPADO ao artefato corrigido e SEM rodar teste
//       (a deploy "quick" que só valida que o fix subiu) — deploy amplo, sem
//       escopo, ou que rode qualquer nível de teste continua `deny`: o quick
//       deploy existe para validar a correção o mais rápido possível, não para
//       homologar. Homologação com teste é sempre um passo humano posterior,
//       fora desta skill.
//     - `sf apex run test` / `sf apex test run` — SEMPRE `deny`, nos dois níveis,
//       sem exceção. Esta skill nunca roda teste, nem antes nem depois do fix;
//       isso é sempre outra skill/outro passo, depois da homologação humana.
//
// Comandos são checados por regex SEM âncora — um comando encadeado
// (`a && sf project deploy ...`) passa pelos prefixos de `permissions.deny` do
// settings.json sem tocá-los, e a intenção aqui é justamente pegar isso.
//
// LIMITAÇÃO honesta (mesma dos guards irmãos deste arsenal): matching por
// texto/caminho não é fronteira criptográfica.
// ---------------------------------------------------------------------------

// --- Nunca, em nenhum nível -------------------------------------------------
const ALWAYS_DENY_RULES = [
  { re: /\bsf\b[\s\S]*\bdata\b[\s\S]*\b(create|update|delete|upsert)\b/, why: 'sf data create/update/delete/upsert (muta registros na org) — fora do escopo desta skill em qualquer nível' },
  { re: /\bsf\b[\s\S]*\borg\b[\s\S]*\bdelete\b/, why: 'sf org delete (apaga uma org)' },
  { re: /\bsf\b[\s\S]*\bproject\b[\s\S]*\bdelete\b/, why: 'sf project delete (apaga código-fonte)' },
  {
    re: /\bsf\b[\s\S]*\bapex\b[\s\S]*\b(run\s+test|test\s+run)\b/,
    why: 'sf apex run test / test run — esta skill NUNCA roda teste, em nenhuma fase. Diagnóstico não reproduz executando; homologação com teste é passo humano posterior, fora desta skill.',
  },
];

// --- Regras de DEPLOY: permitido só como "quick deploy" escopado, sem teste --
const DEPLOY_RE = /\bsf\b[\s\S]*\bproject\b[\s\S]*\bdeploy\b/;
// Qualquer nível de teste (RunLocalTests, RunAllTestsInOrg, RunSpecifiedTests) na
// deploy contradiz "sem teste até homologação" — só NoTestRun é aceitável aqui, e
// AUSÊNCIA da flag é tratada como "não sei o nível" -> nunca presumir NoTestRun.
const TEST_LEVEL_FLAG_RE = /--test-level[= ]\s*["']?(\w+)["']?/i;
// Escopo estreito: aponta para um caminho/manifesto específico, nunca o projeto
// inteiro nem a raiz de force-app sem subpasta.
const NARROW_SCOPE_RE = /--(source-dir|metadata|manifest)[= ]\s*\S+/i;
const WHOLE_FORCE_APP_RE = /--source-dir[= ]\s*["']?force-app\/?["']?(\s|$)/i;

export function classifyCommand(cmd) {
  const c = String(cmd || '');
  const lower = c.toLowerCase();

  for (const r of ALWAYS_DENY_RULES) {
    if (r.re.test(lower)) return { blocked: true, decision: 'deny', why: r.why };
  }

  if (DEPLOY_RE.test(lower)) {
    const testLevelMatch = c.match(TEST_LEVEL_FLAG_RE);
    const testLevel = testLevelMatch ? testLevelMatch[1] : null;

    if (testLevel !== 'NoTestRun') {
      return {
        blocked: true,
        decision: 'deny',
        why:
          'Deploy sem --test-level NoTestRun explícito. O quick deploy desta skill existe só ' +
          'para validar que o fix subiu, o mais rápido possível — rodar teste aqui contradiz ' +
          '"testes ficam para depois da homologação". Se precisa rodar teste, isso é um passo ' +
          'humano separado, fora desta skill.',
      };
    }
    if (!NARROW_SCOPE_RE.test(c) || WHOLE_FORCE_APP_RE.test(c)) {
      return {
        blocked: true,
        decision: 'deny',
        why:
          'Deploy sem escopo estreito (--source-dir/--metadata/--manifest apontando só para o ' +
          'artefato corrigido) ou apontando para force-app/ inteiro. O quick deploy é sempre só ' +
          'o artefato do fix, nunca o projeto inteiro.',
      };
    }
    // Escopado + NoTestRun: é o "quick deploy" que o Nível 2 permite — ainda assim
    // `ask`, nunca silencioso, porque é mutação real de org.
    return {
      blocked: true,
      decision: 'ask',
      why:
        'Quick deploy escopado (--test-level NoTestRun, caminho estreito) — confirme que isto é ' +
        'a correção explicitamente pedida antes de prosseguir. Homologação com teste continua ' +
        'sendo um passo humano posterior.',
    };
  }

  return { blocked: false };
}

// Pastas de metadado deployável que, por padrão (Nível 1), esta skill não escreve.
// (?:^|[\\/]) evita casar um path que só CONTÉM a substring por coincidência
// (ex.: "meu-force-app-backup/notas.md" não deveria disparar isso).
const DEPLOYABLE_SOURCE_RE = /(^|[\\/])force-app([\\/]|$)/i;
const INCIDENTS_DIR_RE = /(^|[\\/])docs[\\/]incidents([\\/]|$)/i;

export function classifyWrite(filePath) {
  const p = String(filePath || '').replace(/\\/g, '/');
  if (INCIDENTS_DIR_RE.test(p)) return { blocked: false }; // relatório de diagnóstico — sempre permitido
  if (DEPLOYABLE_SOURCE_RE.test(p)) {
    return {
      blocked: true,
      decision: 'ask',
      // 'ask', não 'deny': por padrão o diagnóstico nunca chega aqui — mas se o
      // usuário pediu explicitamente a correção (Nível 2), a confirmação da
      // ferramenta É o pedido explícito virando ação. Nunca silencioso.
      why:
        `Escrita direta em código-fonte deployável (${filePath}). Esta skill só edita ` +
        'artefato quando o usuário pediu EXPLICITAMENTE a correção (Nível 2) — confirme que ' +
        'é esse o caso antes de prosseguir. Diagnóstico nunca deveria chegar até aqui.',
    };
  }
  return { blocked: false };
}

function respond(decision, reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    })
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(raw);
      const toolName = payload?.tool_name;
      const input = payload?.tool_input || {};

      if (toolName === 'Bash') {
        const r = classifyCommand(input.command);
        if (r.blocked) {
          respond(r.decision, r.why);
          return process.exit(0);
        }
      }
      if (toolName === 'Write' || toolName === 'Edit') {
        const path = input.file_path || input.path;
        const r = classifyWrite(path);
        if (r.blocked) {
          respond(r.decision, r.why);
          return process.exit(0);
        }
      }
    } catch {
      // Payload malformado: fica fora do caminho em vez de bloquear por bug do guard.
    }
    process.exit(0);
  });
}
