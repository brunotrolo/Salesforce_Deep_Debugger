// Rodar: node --test .claude/skills/sf-deep-debugger/tests/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCommand, classifyWrite } from '../scripts/guard.mjs';

// --- Nunca, em nenhum nível --------------------------------------------------
test('bloqueia sf data update mesmo encadeado', () => {
  const r = classifyCommand('sf data query -q "SELECT Id FROM Account" && sf data update record --sobject Account --record-id 001x --values "Name=x"');
  assert.equal(r.blocked, true);
  assert.equal(r.decision, 'deny');
});
test('bloqueia sf org delete', () => {
  assert.equal(classifyCommand('sf org delete -p x').decision, 'deny');
});
test('bloqueia sf apex run test sempre, mesmo sem menção a deploy', () => {
  const r = classifyCommand('sf apex run test -n MyClassTest');
  assert.equal(r.blocked, true);
  assert.equal(r.decision, 'deny');
});
test('bloqueia a variante "apex test run" tambem', () => {
  assert.equal(classifyCommand('sf apex test run --class-names MyClassTest').decision, 'deny');
});

// --- Leitura, nao bloqueia ----------------------------------------------------
test('nao bloqueia leitura de log', () => {
  assert.equal(classifyCommand('sf apex log get -i 07L000000000001').blocked, false);
});
test('nao bloqueia SOQL de leitura', () => {
  assert.equal(classifyCommand('sf data query -q "SELECT Id FROM Account LIMIT 1"').blocked, false);
});

// --- Deploy: so quick deploy escopado + NoTestRun vira 'ask', resto e' 'deny' -
test('quick deploy escopado com NoTestRun vira ask, nao deny silencioso', () => {
  const r = classifyCommand('sf project deploy start --source-dir force-app/main/default/classes/X.cls --test-level NoTestRun');
  assert.equal(r.blocked, true);
  assert.equal(r.decision, 'ask');
});
test('deploy sem --test-level e negado (nunca presume NoTestRun por omissao)', () => {
  const r = classifyCommand('sf project deploy start --source-dir force-app/main/default/classes/X.cls');
  assert.equal(r.decision, 'deny');
});
test('deploy com RunLocalTests e negado (teste fica para depois da homologacao)', () => {
  const r = classifyCommand('sf project deploy start --source-dir force-app/main/default/classes/X.cls --test-level RunLocalTests');
  assert.equal(r.decision, 'deny');
});
test('deploy de force-app inteiro e negado mesmo com NoTestRun', () => {
  const r = classifyCommand('sf project deploy start --source-dir force-app --test-level NoTestRun');
  assert.equal(r.decision, 'deny');
});
test('deploy sem nenhum flag de escopo e negado', () => {
  const r = classifyCommand('sf project deploy start --test-level NoTestRun');
  assert.equal(r.decision, 'deny');
});

// --- Escrita: force-app vira ask (nao deny absoluto, nao silencioso) ----------
test('escrita em force-app vira ask, nao deny absoluto', () => {
  const r = classifyWrite('force-app/main/default/classes/AccountService.cls');
  assert.equal(r.blocked, true);
  assert.equal(r.decision, 'ask');
});
test('permite escrita em docs/incidents sem confirmacao extra', () => {
  assert.equal(classifyWrite('docs/incidents/2026-09-19-npe-accountservice.md').blocked, false);
});
test('nao falso-positiva em pasta que so contem a substring force-app', () => {
  assert.equal(classifyWrite('meu-force-app-backup/notas.md').blocked, false);
});
