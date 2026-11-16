import { test } from 'node:test';
import assert from 'node:assert/strict';
import politica from '../scripts/politicas/sf-deep-debugger.mjs';

const bash = (command) => politica({ tool_name: 'Bash', tool_input: { command } });
test('política do Odin: nega mutação de dados e teste Apex, em qualquer nível', () => {
  assert.equal(bash('sf data create record -s Account -v "Name=x"').decisao, 'negar');
  assert.equal(bash('sf apex run test --class-names Foo').decisao, 'negar');
  assert.equal(bash('sf org delete scratch -o x').decisao, 'negar');
});
test('política do Odin: deploy só escopado e sem teste; amplo ou com teste é negado', () => {
  assert.equal(bash('sf project deploy start --metadata ApexClass:Foo --test-level NoTestRun').decisao, 'perguntar');
  assert.equal(bash('sf project deploy start --source-dir force-app').decisao, 'negar');
  assert.equal(bash('sf project deploy start --metadata ApexClass:Foo --test-level RunLocalTests').decisao, 'negar');
});
test('política do Odin: escrita em force-app pergunta (também com caminho do Windows); docs/incidents é livre', () => {
  assert.equal(politica({ tool_name: 'Write', tool_input: { file_path: 'force-app/main/default/classes/Foo.cls' } }).decisao, 'perguntar');
  assert.equal(politica({ tool_name: 'Edit', tool_input: { file_path: 'C:\\proj\\force-app\\main\\default\\classes\\Foo.cls' } }).decisao, 'perguntar');
  assert.equal(politica({ tool_name: 'Write', tool_input: { file_path: 'docs/incidents/2026-INC-1.md' } }), null);
});
test('política do Odin: comandos de leitura e outras ferramentas passam; entrada vazia não quebra', () => {
  assert.equal(bash('sf apex log get --number 1'), null); assert.equal(bash('git status'), null);
  assert.equal(politica({ tool_name: 'Read', tool_input: {} }), null); assert.equal(politica(undefined), null);
});
