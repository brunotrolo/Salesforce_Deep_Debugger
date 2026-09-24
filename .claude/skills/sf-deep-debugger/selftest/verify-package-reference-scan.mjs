#!/usr/bin/env node
// verify-package-reference-scan.mjs — self-test FAIL-CLOSED do
// package-reference-scanner.mjs. Mesma disciplina dos selftests irmãos: fixture
// de verdade conhecida, falha (exit 1) em qualquer divergência, contador zero
// incluído. Node puro, sem aspas de shell aninhadas.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'scripts', 'package-reference-scanner.mjs');
const FIX = join(HERE, 'fixtures', 'package-reference-scan');

let fail = 0;
function check(label, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (got === undefined || got === null || want === undefined || want === null) {
    console.log(`  FALHA ${label} — valor ausente (comando de verificação quebrado, não um match real)`);
    fail = 1;
    return;
  }
  if (g === w) {
    console.log(`  OK   ${label} (${g})`);
  } else {
    console.log(`  FALHA ${label} — obtido: ${g} | esperado: ${w}`);
    fail = 1;
  }
}

const out = execFileSync('node', [
  SCRIPT,
  '--package', join(FIX, 'pacote.txt'),
  '--root', join(FIX, 'force-app'),
], { encoding: 'utf8' });
const got = JSON.parse(out);
const expected = JSON.parse(readFileSync(join(FIX, 'expected.json'), 'utf8'));

check('riscos (contagem)', got.riscos.length, expected.riscos);
check('referencias flagadas (ordem)', got.riscos.map((r) => r.referenciaNome), expected.referenciasFlagged);
check('tiposSemVarredura', got.tiposSemVarredura, expected.tiposSemVarredura);
check('naoEncontrados (contagem)', got.naoEncontrados.length, expected.naoEncontrados);
check('aviso de heuristica presente', typeof got.aviso === 'string' && got.aviso.length > 0, true);

console.log();
if (fail === 0) {
  console.log('== Resultado: todos os checks OK ==');
  console.log('package-reference-scanner.mjs validado contra fixture de verdade conhecida.');
  process.exit(0);
} else {
  console.log('== Resultado: FALHAS encontradas ==');
  console.log('NÃO confie neste script até corrigir — um falso negativo aqui esconde um');
  console.log('risco real; um falso positivo vira ruído que atrapalha o desenvolvedor.');
  process.exit(1);
}
