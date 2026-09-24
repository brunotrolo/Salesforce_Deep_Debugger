#!/usr/bin/env node
// verify-package-validation.mjs — self-test FAIL-CLOSED do package-validation-parser.mjs.
// Mesma disciplina do verify-commands.sh irmão (log-parser): roda contra fixture de
// verdade CONHECIDA e falha (exit 1) em qualquer divergência, incluindo contador
// zero — nunca sucesso silencioso. Escrito em Node puro (sem aspas de shell
// aninhadas) desde o início, para não repetir o bug de classe já documentado
// naquele selftest.
//
// Rode antes de confiar no script, e sempre que editá-lo.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'scripts', 'package-validation-parser.mjs');
const FIX = join(HERE, 'fixtures', 'package-validation');

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
  '--errors', join(FIX, 'errors.txt'),
  '--package', join(FIX, 'pacote.txt'),
], { encoding: 'utf8' });
const got = JSON.parse(out);
const expected = JSON.parse(readFileSync(join(FIX, 'expected.json'), 'utf8'));

check('falhas (contagem total)', got.falhas.length, expected.falhas);
check('faltando_no_pacote (contagem)', got.resumo.faltando, expected.faltando);
check('precisa_diagnostico (contagem)', got.resumo.precisaDiagnostico, expected.precisaDiagnostico);
check('naoParseado (contagem)', got.naoParseado.length, expected.naoParseado);
check('nomes extraidos (ordem)', got.falhas.map((f) => f.nome), expected.nomes);
check('classificacoes (ordem)', got.falhas.map((f) => f.classificacao), expected.classificacoes);

console.log();
if (fail === 0) {
  console.log('== Resultado: todos os checks OK ==');
  console.log('package-validation-parser.mjs validado contra fixture de verdade conhecida.');
  process.exit(0);
} else {
  console.log('== Resultado: FALHAS encontradas ==');
  console.log('NÃO confie neste script até corrigir — uma classificação errada aqui diz');
  console.log('"faltou no pacote" quando na verdade é um defeito real, ou vice-versa.');
  process.exit(1);
}
