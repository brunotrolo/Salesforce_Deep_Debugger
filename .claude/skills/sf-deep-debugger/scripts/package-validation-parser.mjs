#!/usr/bin/env node
// package-validation-parser.mjs
// ---------------------------------------------------------------------------
// Extrator DETERMINISTICO de falhas de validação de pacote/deploy (Metadata API).
// Mesma filosofia do log-parser.mjs irmão: o SCRIPT mede/classifica de forma
// mecânica (inclusive a única parte que não é julgamento: "este componente está
// ou não na lista do pacote declarado"); o AGENTE julga causa raiz de tudo que
// sobra. Nunca chama `sf`, nunca acessa rede, nunca decide se um fix vai
// resolver o deploy — só estrutura o que já foi informado.
//
// Formatos de erro aceitos, em ordem de confiança:
//   1) JSON: array de componentFailures (ou { componentFailures: [...] }), no
//      formato de `sf project deploy report --json`.
//   2) Texto livre, uma falha por linha, convenção "Tipo:Nome: problema" — ex.:
//      "ApexClass:AccountServiceHelper: Dependent class is invalid".
//   3) Texto livre tabular (saída humana do `sf project deploy report`), 3+
//      colunas separadas por 2+ espaços, cuja 1a coluna bate com um tipo de
//      componente Salesforce conhecido.
// Qualquer linha que não bater com confiança em nenhum dos 3 formatos NUNCA é
// classificada por palpite — vai para `naoParseado`, para leitura manual.
//
// Uso:
//   node package-validation-parser.mjs --errors <arquivo> --package <arquivo>
//
// `--package` aceita um artefato por linha ou separados por vírgula, no
// formato "Tipo:Nome" (ex.: "ApexClass:AccountService").
//
// Requisitos: Node 18+. Zero dependências externas.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';

const KNOWN_TYPES = new Set([
  'ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent',
  'CustomObject', 'CustomField', 'CustomMetadata', 'CustomLabel',
  'Flow', 'FlowDefinition', 'Layout', 'PermissionSet', 'PermissionSetGroup',
  'LightningComponentBundle', 'AuraDefinitionBundle', 'ValidationRule',
  'RecordType', 'WorkflowRule', 'Profile', 'StaticResource', 'NamedCredential',
  'ExternalCredential', 'Queue', 'Group',
]);

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

// --- Normalização de tipo/nome para o membership check -----------------------
function normType(t) {
  return String(t || '').replace(/\s+/g, '').toLowerCase();
}
function keyOf(tipo, nome) {
  return `${normType(tipo)}::${String(nome || '').trim()}`;
}

// --- Parsing das falhas --------------------------------------------------------
function parseJsonFailures(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null; // não é JSON — tenta os formatos de texto
  }
  const arr = Array.isArray(data) ? data : data?.componentFailures;
  if (!Array.isArray(arr)) return null;
  return arr.map((f) => ({
    tipo: f.componentType || f.type || 'Desconhecido',
    nome: f.fullName || f.fileName || f.name || 'Desconhecido',
    problema: f.problem || f.problemType || 'Sem descrição no JSON',
    linhaOriginal: JSON.stringify(f),
  }));
}

// Convenção documentada: "Tipo:Nome: problema" — uma falha por linha.
const CONVENTION_RE = /^([A-Za-z]+)\s*:\s*([^\s:][^:]*)\s*:\s*(.+)$/;

// Tabular (saída humana do `sf project deploy report`): 3+ colunas separadas
// por 2+ espaços, 1a coluna é um tipo de componente conhecido.
const TABULAR_RE = /^(\S+)\s{2,}(\S+)\s{2,}(.+)$/;

function parseTextFailures(text) {
  const falhas = [];
  const naoParseado = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const conv = line.match(CONVENTION_RE);
    if (conv && KNOWN_TYPES.has(conv[1])) {
      falhas.push({ tipo: conv[1], nome: conv[2].trim(), problema: conv[3].trim(), linhaOriginal: line });
      continue;
    }
    const tab = line.match(TABULAR_RE);
    if (tab && KNOWN_TYPES.has(tab[1])) {
      falhas.push({ tipo: tab[1], nome: tab[2].trim(), problema: tab[3].trim(), linhaOriginal: line });
      continue;
    }
    naoParseado.push(line);
  }
  return { falhas, naoParseado };
}

function parsePackageList(text) {
  const items = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const set = new Set();
  const invalidas = [];
  for (const item of items) {
    const m = item.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
    if (!m) {
      invalidas.push(item);
      continue;
    }
    set.add(keyOf(m[1], m[2].trim()));
  }
  return { set, invalidas };
}

// ===========================================================================
// MAIN
// ===========================================================================
const errorsPath = arg('errors');
const packagePath = arg('package');

if (typeof errorsPath !== 'string' || typeof packagePath !== 'string') {
  emit({ error: 'Informe --errors <arquivo> e --package <arquivo>.' }, 2);
}
if (!existsSync(errorsPath)) emit({ error: `Arquivo de erros não encontrado: ${errorsPath}` }, 2);
if (!existsSync(packagePath)) emit({ error: `Arquivo de pacote não encontrado: ${packagePath}` }, 2);

const errorsText = readFileSync(errorsPath, 'utf8');
const packageText = readFileSync(packagePath, 'utf8');

const { set: pacoteSet, invalidas: pacoteInvalidas } = parsePackageList(packageText);

let falhasBrutas;
let naoParseado = [];
const viaJson = parseJsonFailures(errorsText);
if (viaJson) {
  falhasBrutas = viaJson;
} else {
  const r = parseTextFailures(errorsText);
  falhasBrutas = r.falhas;
  naoParseado = r.naoParseado;
}

const falhas = falhasBrutas.map((f) => {
  const noPacote = pacoteSet.has(keyOf(f.tipo, f.nome));
  return {
    ...f,
    classificacao: noPacote ? 'precisa_diagnostico' : 'faltando_no_pacote',
  };
});

const resumo = {
  faltando: falhas.filter((f) => f.classificacao === 'faltando_no_pacote').length,
  precisaDiagnostico: falhas.filter((f) => f.classificacao === 'precisa_diagnostico').length,
  naoParseado: naoParseado.length,
};

const warnings = [];
if (!falhas.length && !naoParseado.length) {
  warnings.push('Nenhuma falha reconhecida no arquivo de erros — confirme o formato (JSON de componentFailures ou "Tipo:Nome: problema" por linha).');
}
if (pacoteInvalidas.length) {
  warnings.push(`${pacoteInvalidas.length} linha(s) do arquivo de pacote não bateram no formato "Tipo:Nome" e foram ignoradas: ${pacoteInvalidas.join('; ')}`);
}

emit({ mode: 'package-validation', falhas, naoParseado, resumo, warnings });
