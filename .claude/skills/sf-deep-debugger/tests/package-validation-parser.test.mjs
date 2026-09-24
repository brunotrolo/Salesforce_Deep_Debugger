// Rodar: node --test .claude/skills/sf-deep-debugger/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(import.meta.dirname, '..', 'scripts', 'package-validation-parser.mjs');

function run(errorsContent, packageContent) {
  const dir = mkdtempSync(join(tmpdir(), 'ddbg-pv-'));
  const errorsFile = join(dir, 'errors.txt');
  const packageFile = join(dir, 'package.txt');
  writeFileSync(errorsFile, errorsContent, 'utf8');
  writeFileSync(packageFile, packageContent, 'utf8');
  const out = execFileSync('node', [SCRIPT, '--errors', errorsFile, '--package', packageFile], {
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

test('JSON componentFailures: componente fora do pacote vira faltando_no_pacote', () => {
  const r = run(
    JSON.stringify({
      componentFailures: [{ componentType: 'ApexClass', fullName: 'Helper', problem: 'Dependent class is invalid' }],
    }),
    'ApexClass:AccountService'
  );
  assert.equal(r.falhas.length, 1);
  assert.equal(r.falhas[0].classificacao, 'faltando_no_pacote');
});

test('JSON: componente presente no pacote vira precisa_diagnostico', () => {
  const r = run(
    JSON.stringify({ componentFailures: [{ componentType: 'ApexClass', fullName: 'AccountService', problem: 'Compile error' }] }),
    'ApexClass:AccountService'
  );
  assert.equal(r.falhas[0].classificacao, 'precisa_diagnostico');
});

test('texto na convencao Tipo:Nome: problema e parseado com confianca', () => {
  const r = run('ApexClass:Helper: Dependent class is invalid', 'ApexClass:AccountService');
  assert.equal(r.falhas.length, 1);
  assert.equal(r.falhas[0].tipo, 'ApexClass');
  assert.equal(r.falhas[0].nome, 'Helper');
  assert.equal(r.naoParseado.length, 0);
});

test('texto tabular (saida humana do sf) e reconhecido pela 1a coluna', () => {
  const r = run('ApexTrigger  AccountTrigger  Invalid type: Helper', 'ApexTrigger:AccountTrigger');
  assert.equal(r.falhas.length, 1);
  assert.equal(r.falhas[0].nome, 'AccountTrigger');
});

test('linha ambigua nunca e classificada por palpite, vai para naoParseado', () => {
  const r = run('isso aqui nao é um formato reconhecido de jeito nenhum', 'ApexClass:AccountService');
  assert.equal(r.falhas.length, 0);
  assert.equal(r.naoParseado.length, 1);
});

test('membership check funciona nos dois sentidos (varias linhas)', () => {
  const r = run(
    'ApexClass:Faltando1: problema\nApexClass:AccountService: problema2\nApexClass:Faltando2: problema3',
    'ApexClass:AccountService'
  );
  assert.equal(r.resumo.faltando, 2);
  assert.equal(r.resumo.precisaDiagnostico, 1);
});

test('arquivo de pacote com linha invalida gera warning mas nao trava', () => {
  const r = run('ApexClass:AccountService: problema', 'isso nao e Tipo:Nome\nApexClass:AccountService');
  assert.equal(r.falhas[0].classificacao, 'precisa_diagnostico');
  assert.ok(r.warnings.some((w) => /não bateram no formato/.test(w)));
});

test('arquivo de erros inexistente falha com exit code != 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ddbg-pv-'));
  const packageFile = join(dir, 'package.txt');
  writeFileSync(packageFile, 'ApexClass:X', 'utf8');
  assert.throws(() => {
    execFileSync('node', [SCRIPT, '--errors', '/nao/existe.txt', '--package', packageFile], { encoding: 'utf8' });
  });
});
