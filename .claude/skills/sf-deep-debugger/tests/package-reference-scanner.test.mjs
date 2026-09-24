// Rodar: node --test .claude/skills/sf-deep-debugger/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = join(import.meta.dirname, '..', 'scripts', 'package-reference-scanner.mjs');

function run(packageContent, files) {
  const dir = mkdtempSync(join(tmpdir(), 'ddbg-prs-'));
  const packageFile = join(dir, 'package.txt');
  writeFileSync(packageFile, packageContent, 'utf8');
  const root = join(dir, 'force-app');
  mkdirSync(root, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const full = join(root, relPath);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf8');
  }
  const out = execFileSync('node', [SCRIPT, '--package', packageFile, '--root', root], { encoding: 'utf8' });
  return JSON.parse(out);
}

test('referencia a classe fora do pacote vira risco (via new)', () => {
  const r = run('ApexClass:AccountService', {
    'classes/AccountService.cls': 'public class AccountService { void f() { new Helper(); } }',
  });
  assert.equal(r.riscos.length, 1);
  assert.equal(r.riscos[0].referenciaNome, 'Helper');
  assert.equal(r.riscos[0].via, 'new');
});

test('referencia a classe QUE ESTA no pacote nunca vira risco', () => {
  const r = run('ApexClass:AccountService,ApexClass:Helper', {
    'classes/AccountService.cls': 'public class AccountService { void f() { new Helper(); } }',
    'classes/Helper.cls': 'public class Helper {}',
  });
  assert.equal(r.riscos.length, 0);
});

test('tipos padrao (List, String, etc.) nunca viram risco (ruido filtrado)', () => {
  const r = run('ApexClass:AccountService', {
    'classes/AccountService.cls': 'public class AccountService { void f() { List<String> x = new List<String>(); } }',
  });
  assert.equal(r.riscos.length, 0);
});

test('extends conta como referencia', () => {
  const r = run('ApexClass:AccountService', {
    'classes/AccountService.cls': 'public class AccountService extends BaseService { }',
  });
  assert.ok(r.riscos.some((x) => x.referenciaNome === 'BaseService' && x.via === 'extends'));
});

test('import Apex em LWC conta como referencia', () => {
  const r = run('LightningComponentBundle:accountCard', {
    'lwc/accountCard/accountCard.js':
      "import getRecords from '@salesforce/apex/AccountService.getRecords';\nexport default class {}",
  });
  assert.ok(r.riscos.some((x) => x.referenciaNome === 'AccountService' && x.via === 'apex-import'));
});

test('tipo nao suportado (ex.: Flow) aparece em tiposSemVarredura, nunca finge cobertura', () => {
  const r = run('Flow:MinhaFlow', {});
  assert.ok(r.tiposSemVarredura.includes('Flow'));
  assert.equal(r.riscos.length, 0);
});

test('artefato do pacote nao encontrado no disco avisa, nao trava nem inventa', () => {
  const r = run('ApexClass:NaoExiste', {});
  assert.equal(r.naoEncontrados.length, 1);
  assert.ok(r.warnings.some((w) => /não encontrados/.test(w)));
});

test('sempre inclui o aviso de heuristica nao confirmada', () => {
  const r = run('ApexClass:AccountService', { 'classes/AccountService.cls': 'public class AccountService {}' });
  assert.match(r.aviso, /risco não confirmado/);
});
