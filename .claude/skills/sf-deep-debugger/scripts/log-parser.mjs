#!/usr/bin/env node
// log-parser.mjs
// ---------------------------------------------------------------------------
// Extrator DETERMINISTICO de sinais de um Apex debug log. Filosofia herdada do
// pattern-extractor.mjs (lwc-pattern-documenter): o SCRIPT mede/extrai de forma
// mecanica; o AGENTE julga causa raiz. O script nunca decide categoria de falha
// nem causa raiz — so estrutura o que ja esta no log, preservando a linha original
// para citacao exata na etapa de causa raiz.
//
// Uso:
//   node log-parser.mjs --log <arquivo.log>
//   node log-parser.mjs --stdin              (le o log do stdin)
//
// Requisitos: Node 18+. Zero dependencias externas.
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';

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

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// Cada linha de um Apex debug log e "TIMESTAMP (NANOS)|EVENT_TYPE|resto".
// O delimitador '|' aqui e LITERAL (formato do log, nao regex) — split simples,
// sem regex de alternacao, para nao repetir o erro documentado em log-parsing.md.
function parseLine(line) {
  const parts = line.split('|');
  if (parts.length < 2) return null;
  const eventType = parts[1];
  return { raw: line, eventType, parts };
}

function extractExceptions(lines) {
  const out = [];
  for (const l of lines) {
    const p = parseLine(l);
    if (!p) continue;
    if (p.eventType === 'EXCEPTION_THROWN' || p.eventType === 'FATAL_ERROR') {
      // parts: [ts, EVENT_TYPE, "[linha]", "Tipo: mensagem"]
      const lineNoMatch = (p.parts[2] || '').match(/\[(\d+)\]/);
      out.push({
        raw: p.raw,
        eventType: p.eventType,
        apexLine: lineNoMatch ? Number(lineNoMatch[1]) : null,
        detail: p.parts.slice(3).join('|').trim() || (p.parts[2] || '').trim(),
      });
    }
  }
  return out;
}

function extractLimitUsage(lines) {
  const out = [];
  for (const l of lines) {
    const p = parseLine(l);
    if (!p || p.eventType !== 'LIMIT_USAGE_FOR_NS') continue;
    out.push({ raw: p.raw });
  }
  return out;
}

function extractCallouts(lines) {
  const out = [];
  for (const l of lines) {
    const p = parseLine(l);
    if (!p) continue;
    if (p.eventType === 'CALLOUT_REQUEST' || p.eventType === 'CALLOUT_RESPONSE') {
      // StatusCode vem SEMPRE como "StatusCode=NNN" no HttpResponse — nunca casar
      // qualquer sequência de 3 dígitos na linha (a timestamp em si tem uma:
      // "09:15:20.500 (...)" quase virou um 500 falso na primeira versão deste script).
      const statusMatch = p.raw.match(/StatusCode=(\d{3})/);
      out.push({
        raw: p.raw,
        eventType: p.eventType,
        statusCode: statusMatch ? Number(statusMatch[1]) : null,
      });
    }
  }
  return out;
}

function extractDml(lines) {
  const out = [];
  for (const l of lines) {
    const p = parseLine(l);
    if (!p) continue;
    if (p.eventType === 'DML_BEGIN' || p.eventType === 'DML_END') {
      out.push({ raw: p.raw, eventType: p.eventType });
    }
  }
  return out;
}

function extractSoql(lines) {
  const out = [];
  for (const l of lines) {
    const p = parseLine(l);
    if (!p) continue;
    if (p.eventType === 'SOQL_EXECUTE_BEGIN' || p.eventType === 'SOQL_EXECUTE_END') {
      out.push({ raw: p.raw, eventType: p.eventType });
    }
  }
  return out;
}

function extractUserDebug(lines) {
  const out = [];
  for (const l of lines) {
    const p = parseLine(l);
    if (!p || p.eventType !== 'USER_DEBUG') continue;
    out.push({ raw: p.raw, message: p.parts.slice(4).join('|').trim() });
  }
  return out;
}

// ===========================================================================
// MAIN
// ===========================================================================
const logPath = arg('log');
const useStdin = arg('stdin');

let content;
if (typeof logPath === 'string') {
  if (!existsSync(logPath)) {
    emit({ error: `Arquivo não encontrado: ${logPath}` }, 2);
  }
  content = readFileSync(logPath, 'utf8');
} else if (useStdin) {
  content = readStdin();
} else {
  emit({ error: 'Informe --log <arquivo.log> ou --stdin.' }, 2);
}

const lines = content.split(/\r?\n/).filter(Boolean);

const exceptions = extractExceptions(lines);
const limitUsage = extractLimitUsage(lines);
const callouts = extractCallouts(lines);
const dml = extractDml(lines);
const soql = extractSoql(lines);
const userDebug = extractUserDebug(lines);

const warnings = [];
if (!lines.length) warnings.push('Log vazio ou não reconhecido — confira o caminho/conteúdo.');
if (!exceptions.length && !callouts.some((c) => c.statusCode && c.statusCode >= 400)) {
  warnings.push(
    'Nenhuma EXCEPTION_THROWN/FATAL_ERROR nem callout com status de erro encontrado neste log. ' +
      'Confirme que este é o log correto para o incidente (nível de log pode estar baixo demais ' +
      'para capturar o evento relevante).'
  );
}

emit({
  mode: 'extract',
  linesScanned: lines.length,
  exceptions,
  limitUsage,
  callouts,
  dml,
  soql,
  userDebug,
  warnings,
});
