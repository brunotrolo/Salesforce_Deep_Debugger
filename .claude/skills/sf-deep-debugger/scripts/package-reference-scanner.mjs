#!/usr/bin/env node
// package-reference-scanner.mjs
// ---------------------------------------------------------------------------
// Varredura ESTÁTICA e LOCAL: para cada artefato de um pacote, procura
// referências a outros componentes que NÃO estão na lista declarada do
// pacote — candidatos a falhar na PRÓXIMA rodada de validação (o Salesforce
// valida de forma incremental e para na primeira leva de erros; corrigir só
// o que foi apontado não garante que não há mais coisa faltando).
//
// Isto é heurística, não um resolvedor de dependências real: nunca sabe se um
// componente referenciado já existe no org de destino (só a org sabe). Por
// isso todo achado aqui é sempre "risco não confirmado", nunca "erro certo" —
// use exclusivamente no bloco "Achados adicionais" da skill, nunca na
// resposta principal, e nunca para "corrigir" o pacote sozinho.
//
// Cobre hoje: ApexClass/ApexTrigger (referência a outra classe via
// constructor/chamada estática/extends/implements) e LightningComponentBundle
// (import de @salesforce/apex/Classe.metodo). Outros tipos aparecem em
// `tiposSemVarredura`, nunca fingidos como cobertos.
//
// Uso:
//   node package-reference-scanner.mjs --package <arquivo> --root <force-app>
//
// Requisitos: Node 18+. Zero dependências externas, zero rede.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}
function emit(obj, code = 0) {
  console.log(JSON.stringify(obj, null, 2));
  process.exit(code);
}

const SUPPORTED_TYPES = new Set(['ApexClass', 'ApexTrigger', 'LightningComponentBundle']);

// Ruído comum: tipos padrão/Apex nativo que nunca são "referência a outro
// componente do pacote" — nunca reportar como risco.
const NOISE_IDENTIFIERS = new Set([
  'String', 'Integer', 'Boolean', 'Object', 'List', 'Map', 'Set', 'Id',
  'Datetime', 'Date', 'Decimal', 'Double', 'Long', 'Blob', 'Exception',
  'Database', 'Schema', 'Test', 'System', 'JSON', 'Http', 'HttpRequest',
  'HttpResponse', 'Trigger', 'Type', 'Void', 'Iterator', 'Comparable',
]);

function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function findApexFile(allFiles, name, ext) {
  return allFiles.find((f) => basename(f) === `${name}.${ext}`);
}
function findLwcFile(allFiles, name) {
  return allFiles.find((f) => f.replace(/\\/g, '/').endsWith(`/lwc/${name}/${name}.js`));
}

function parsePackageList(text) {
  const items = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const list = [];
  for (const item of items) {
    const m = item.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
    if (m) list.push({ tipo: m[1], nome: m[2].trim() });
  }
  return list;
}

function scanApexReferences(source, ownName) {
  const refs = [];
  const lines = source.split(/\r?\n/);
  const patterns = [
    { re: /\bnew\s+([A-Z][A-Za-z0-9_]*)\s*\(/g, tag: 'new' },
    { re: /\bextends\s+([A-Z][A-Za-z0-9_]*)/g, tag: 'extends' },
    { re: /\bimplements\s+([A-Z][A-Za-z0-9_]*)/g, tag: 'implements' },
    { re: /\b([A-Z][A-Za-z0-9_]*)\.[a-zA-Z_][A-Za-z0-9_]*\s*\(/g, tag: 'static-call' },
  ];
  lines.forEach((line, idx) => {
    for (const { re, tag } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const nome = m[1];
        if (nome === ownName || NOISE_IDENTIFIERS.has(nome)) continue;
        refs.push({ nome, evidencia: line.trim().slice(0, 160), linha: idx + 1, via: tag });
      }
    }
  });
  return refs;
}

function scanLwcReferences(source) {
  const refs = [];
  const lines = source.split(/\r?\n/);
  const re = /from\s+['"]@salesforce\/apex\/([\w.]+)\.\w+['"]/;
  lines.forEach((line, idx) => {
    const m = line.match(re);
    if (m) refs.push({ nome: m[1].split('.').pop(), evidencia: line.trim().slice(0, 160), linha: idx + 1, via: 'apex-import' });
  });
  return refs;
}

// ===========================================================================
// MAIN
// ===========================================================================
const packagePath = arg('package');
const root = arg('root');

if (typeof packagePath !== 'string' || typeof root !== 'string') {
  emit({ error: 'Informe --package <arquivo> e --root <diretorio force-app>.' }, 2);
}
if (!existsSync(packagePath)) emit({ error: `Arquivo de pacote não encontrado: ${packagePath}` }, 2);
if (!existsSync(root)) emit({ error: `Diretório raiz não encontrado: ${root}` }, 2);

const pacote = parsePackageList(readFileSync(packagePath, 'utf8'));
const pacoteChaves = new Set(pacote.map((p) => `${p.tipo.toLowerCase()}::${p.nome}`));
const allFiles = walk(root);

const riscos = [];
const tiposSemVarredura = new Set();
const naoEncontrados = [];

for (const { tipo, nome } of pacote) {
  if (!SUPPORTED_TYPES.has(tipo)) {
    tiposSemVarredura.add(tipo);
    continue;
  }

  let file;
  let refs = [];
  if (tipo === 'ApexClass') {
    file = findApexFile(allFiles, nome, 'cls');
    if (file) refs = scanApexReferences(readFileSync(file, 'utf8'), nome);
  } else if (tipo === 'ApexTrigger') {
    file = findApexFile(allFiles, nome, 'trigger');
    if (file) refs = scanApexReferences(readFileSync(file, 'utf8'), nome);
  } else if (tipo === 'LightningComponentBundle') {
    file = findLwcFile(allFiles, nome);
    if (file) refs = scanLwcReferences(readFileSync(file, 'utf8'));
  }

  if (!file) {
    naoEncontrados.push({ tipo, nome });
    continue;
  }

  for (const ref of refs) {
    // Referência a um Apex existe como ApexClass OU ApexTrigger — checa os dois.
    const emPacote =
      pacoteChaves.has(`apexclass::${ref.nome}`) || pacoteChaves.has(`apextrigger::${ref.nome}`);
    if (!emPacote) {
      riscos.push({
        origemTipo: tipo,
        origemNome: nome,
        referenciaNome: ref.nome,
        evidencia: ref.evidencia,
        linha: ref.linha,
        via: ref.via,
      });
    }
  }
}

const warnings = [];
if (naoEncontrados.length) {
  warnings.push(
    `${naoEncontrados.length} artefato(s) do pacote não encontrados em ${root} — varredura de referência pulada para eles: ` +
      naoEncontrados.map((a) => `${a.tipo}:${a.nome}`).join(', ')
  );
}

emit({
  mode: 'package-reference-scan',
  riscos,
  tiposSemVarredura: [...tiposSemVarredura],
  naoEncontrados,
  resumo: { riscos: riscos.length },
  warnings,
  aviso: 'Heurística estática local — nunca confirma se um componente referenciado já existe no org de destino. Sempre reportar como risco não confirmado, nunca como erro certo.',
});
