// Política do odin-guard para esta skill (ADR 0027 do Odin). Substitui o hook PreToolUse quando a skill roda pelo Odin:
// o guard carrega este módulo depois do `odin ensure sf-deep-debugger` e aplica as mesmas regras do guard.mjs.
// Função pura: nenhuma E/S. Mesmo comportamento no Windows (os caminhos são normalizados em classifyWrite).
import { classifyCommand, classifyWrite } from '../guard.mjs';

export default function politica(evento) {
  const entrada = evento?.tool_input ?? {};
  const r = evento?.tool_name === 'Bash' ? classifyCommand(entrada.command)
    : evento?.tool_name === 'Write' || evento?.tool_name === 'Edit' ? classifyWrite(entrada.file_path ?? entrada.path)
      : { blocked: false };
  return r.blocked ? { decisao: r.decision === 'deny' ? 'negar' : 'perguntar', motivo: r.why } : null;
}
