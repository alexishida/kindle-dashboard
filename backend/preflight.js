// Preflight de autenticação — roda no start do servidor (e exposto em /api/auth).
// Checagens LOCAIS apenas (lê expiração das credenciais; sem rede, sem risco de 429).
const fs = require('fs');
const os = require('os');
const path = require('path');

const H = os.homedir();

function jwtExpMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function checkClaude() {
  const r = { name: 'claude', label: 'Claude Code' };
  try {
    const c = JSON.parse(fs.readFileSync(path.join(H, '.claude', '.credentials.json'), 'utf8'));
    const o = c.claudeAiOauth || {};
    if (!o.accessToken) return { ...r, ok: false, detail: 'sem accessToken', hint: 'rode `claude` para logar' };
    if (o.expiresAt && o.expiresAt <= Date.now()) {
      return { ...r, ok: false, detail: 'token expirado em ' + new Date(o.expiresAt).toISOString(),
               hint: 'rode qualquer comando `claude` (a CLI renova o token sozinha)' };
    }
    return { ...r, ok: true, detail: 'válido até ' + (o.expiresAt ? new Date(o.expiresAt).toISOString() : '?') };
  } catch (e) {
    return { ...r, ok: false, detail: String(e.message || e), hint: 'rode `claude` para logar no PC' };
  }
}

function checkCodex() {
  const r = { name: 'codex', label: 'OpenAI Codex' };
  try {
    const a = JSON.parse(fs.readFileSync(path.join(H, '.codex', 'auth.json'), 'utf8'));
    const tok = a.tokens && a.tokens.access_token;
    if (!tok) return { ...r, ok: false, detail: 'sem access_token', hint: 'rode `codex login`' };
    const exp = jwtExpMs(tok);
    if (exp && exp <= Date.now()) {
      return { ...r, ok: false, detail: 'token expirado em ' + new Date(exp).toISOString(), hint: 'rode `codex login` (ou reabra o app Codex)' };
    }
    return { ...r, ok: true, detail: 'válido até ' + (exp ? new Date(exp).toISOString() : '?') + ' (mode: ' + a.auth_mode + ')' };
  } catch (e) {
    return { ...r, ok: false, detail: String(e.message || e), hint: 'rode `codex login`' };
  }
}

// OpenCode desativado no dashboard (plano Go sem API). Mantido aqui para re-ativar fácil;
// não entra em checkAll() enquanto a fonte estiver desligada.
function checkOpenCode() {
  const r = { name: 'opencode', label: 'OpenCode Go' };
  const dbPath = path.join(H, '.local', 'share', 'opencode', 'opencode.db');
  try {
    fs.accessSync(dbPath, fs.constants.R_OK);
    let hasKey = false;
    try {
      const a = JSON.parse(fs.readFileSync(path.join(H, '.local', 'share', 'opencode', 'auth.json'), 'utf8'));
      hasKey = Object.values(a).some((v) => v && v.key);
    } catch {}
    return { ...r, ok: true, detail: 'DB local legível' + (hasKey ? ' + API key presente' : ' (sem auth.json — só leitura local)') };
  } catch (e) {
    return { ...r, ok: false, detail: 'DB não acessível: ' + String(e.message || e), hint: 'use o OpenCode ao menos 1x para criar o DB' };
  }
}

function checkAll() {
  return [checkClaude(), checkCodex()];
}

function printReport(results) {
  console.log('\n── Preflight de autenticação ──────────────────');
  let needs = 0;
  for (const r of results) {
    const tag = r.ok ? 'OK  ' : 'AÇÃO';
    console.log(`  [${tag}] ${r.label.padEnd(13)} ${r.detail}`);
    if (!r.ok && r.hint) { console.log(`         ↳ ${r.hint}`); needs++; }
  }
  if (needs === 0) console.log('  Tudo autenticado. ✓');
  else console.log(`\n  ${needs} fonte(s) precisam de re-autenticação (veja acima).`);
  console.log('───────────────────────────────────────────────\n');
}

module.exports = { checkAll, printReport };
