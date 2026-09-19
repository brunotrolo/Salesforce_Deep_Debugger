// Rodar: node --test .claude/skills/sf-deep-debugger/tests/*.test.mjs
//
// Testa o log-parser.mjs via subprocesso (não via import) porque o script roda
// sua lógica principal no top-level a partir de argv/stdin — mesmo padrão de
// isolamento usado para os guards das skills irmãs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(import.meta.dirname, '..', 'scripts', 'log-parser.mjs');

function runOnLog(content) {
  const dir = mkdtempSync(join(tmpdir(), 'ddbg-'));
  const file = join(dir, 'sample.log');
  writeFileSync(file, content, 'utf8');
  const out = execFileSync('node', [SCRIPT, '--log', file], { encoding: 'utf8' });
  return JSON.parse(out);
}

test('extrai EXCEPTION_THROWN com numero de linha e detalhe', () => {
  const r = runOnLog('09:00:00.000 (1)|EXCEPTION_THROWN|[42]|System.NullPointerException: x\n');
  assert.equal(r.exceptions.length, 1);
  assert.equal(r.exceptions[0].apexLine, 42);
  assert.match(r.exceptions[0].detail, /NullPointerException/);
});

test('nao confunde milissegundos da timestamp com StatusCode', () => {
  const r = runOnLog(
    '09:15:20.500 (1)|CALLOUT_RESPONSE|[1]|System.HttpResponse[Status=Unauthorized, StatusCode=401]\n'
  );
  assert.equal(r.callouts[0].statusCode, 401);
});

test('CALLOUT_REQUEST sem status vem null, nao inventa numero', () => {
  const r = runOnLog(
    '09:00:00.123 (1)|CALLOUT_REQUEST|[1]|System.HttpRequest[Endpoint=https://x, Method=POST]\n'
  );
  assert.equal(r.callouts[0].statusCode, null);
});

test('extrai LIMIT_USAGE_FOR_NS bruto para o agente ler', () => {
  const r = runOnLog('09:00:00.000 (1)|LIMIT_USAGE_FOR_NS|(default)|Number of SOQL queries: 99 out of 100\n');
  assert.equal(r.limitUsage.length, 1);
  assert.match(r.limitUsage[0].raw, /99 out of 100/);
});

test('extrai USER_DEBUG preservando a mensagem', () => {
  const r = runOnLog('09:00:00.000 (1)|USER_DEBUG|[5]|DEBUG|valor esperado\n');
  assert.equal(r.userDebug[0].message, 'valor esperado');
});

test('log vazio gera warning, nao lanca excecao', () => {
  const r = runOnLog('');
  assert.ok(r.warnings.length >= 1);
  assert.equal(r.exceptions.length, 0);
});

test('log sem exception nem callout de erro avisa para checar o log certo', () => {
  const r = runOnLog('09:00:00.000 (1)|SOQL_EXECUTE_BEGIN|[1]|Aggregations:0|SELECT Id FROM Account\n');
  assert.ok(r.warnings.some((w) => /log correto/.test(w)));
});

test('arquivo inexistente falha com exit code != 0, nunca finge sucesso', () => {
  assert.throws(() => {
    execFileSync('node', [SCRIPT, '--log', '/caminho/que/nao/existe.log'], { encoding: 'utf8' });
  });
});

test('sem --log nem --stdin falha (nao adivinha a fonte)', () => {
  assert.throws(() => {
    execFileSync('node', [SCRIPT], { encoding: 'utf8' });
  });
});
