// Preflight de autenticação — roda no start do servidor (e exposto em /api/auth).
// Checagens LOCAIS apenas (lê expiração das credenciais; sem rede, sem risco de 429).
// Não formata texto: devolve chaves i18n (detailKey/hintKey) resolvidas no app/CLI.
const fs = require('fs');
const os = require('os');
const path = require('path');

const H = os.homedir();
const LOCALES_DIR = path.join(__dirname, '..', 'locales');

function jwtExpMs(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function iso(ms) {
  return ms ? new Date(ms).toISOString() : '?';
}

function checkClaude() {
  const r = { name: 'claude', label: 'Claude Code' };
  try {
    const c = JSON.parse(fs.readFileSync(path.join(H, '.claude', '.credentials.json'), 'utf8'));
    const o = c.claudeAiOauth || {};
    if (!o.accessToken) return { ...r, ok: false, detailKey: 'noToken', hintKey: 'claudeLogin' };
    if (o.expiresAt && o.expiresAt <= Date.now()) {
      return { ...r, ok: false, detailKey: 'expired', detailVars: { expiresAt: iso(o.expiresAt) }, hintKey: 'claudeRenew' };
    }
    return { ...r, ok: true, detailKey: 'valid', detailVars: { expiresAt: iso(o.expiresAt) } };
  } catch (e) {
    return { ...r, ok: false, detailKey: 'error', detailVars: { message: String(e.message || e) }, hintKey: 'claudeLogin' };
  }
}

function checkCodex() {
  const r = { name: 'codex', label: 'OpenAI Codex' };
  try {
    const a = JSON.parse(fs.readFileSync(path.join(H, '.codex', 'auth.json'), 'utf8'));
    const tok = a.tokens && a.tokens.access_token;
    if (!tok) return { ...r, ok: false, detailKey: 'noToken', hintKey: 'codexLogin' };
    const exp = jwtExpMs(tok);
    if (exp && exp <= Date.now()) {
      return { ...r, ok: false, detailKey: 'expired', detailVars: { expiresAt: iso(exp) }, hintKey: 'codexRenew' };
    }
    return { ...r, ok: true, detailKey: 'validWithMode', detailVars: { expiresAt: iso(exp), mode: String(a.auth_mode) } };
  } catch (e) {
    return { ...r, ok: false, detailKey: 'error', detailVars: { message: String(e.message || e) }, hintKey: 'codexLogin' };
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
    return { ...r, ok: true, detailKey: hasKey ? 'opencodeReadableWithKey' : 'opencodeReadable' };
  } catch (e) {
    return { ...r, ok: false, detailKey: 'opencodeUnavailable', detailVars: { message: String(e.message || e) }, hintKey: 'opencodeHint' };
  }
}

function checkAll() {
  return [checkClaude(), checkCodex()];
}

// --- Relatório de CLI: resolve as chaves i18n contra um locale de `locales/`. ---
function loadAuthMessages(lang) {
  const tryLoad = (code) => {
    try {
      return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${code}.json`), 'utf8')).auth || null;
    } catch {
      return null;
    }
  };
  return tryLoad(lang) || tryLoad('en') || {};
}

function format(template, vars) {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_m, key) => (vars && vars[key] != null ? vars[key] : ''));
}

function printReport(results, lang = process.env.DASH_LANG || 'en') {
  const messages = loadAuthMessages(lang);
  const t = (key, vars) => format(messages[key] || key, vars);

  console.log('\n── ' + t('reportHeader') + ' ──────────────────');
  let needs = 0;
  for (const r of results) {
    const tag = (r.ok ? t('reportOk') : t('reportAction')).padEnd(4);
    console.log(`  [${tag}] ${r.label.padEnd(13)} ${t(r.detailKey, r.detailVars)}`);
    if (!r.ok && r.hintKey) {
      console.log(`         ↳ ${t(r.hintKey)}`);
      needs++;
    }
  }
  if (needs === 0) console.log('  ' + t('reportAllOk') + ' ✓');
  else console.log('\n  ' + t('reportNeeds', { count: String(needs) }));
  console.log('───────────────────────────────────────────────\n');
}

module.exports = { checkAll, checkClaude, checkCodex, checkOpenCode, printReport };
