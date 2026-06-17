// Coletor Claude — endpoint OAuth oficial (validado na Fase 0.1).
// Lê o accessToken de ~/.claude/.credentials.json A CADA chamada (token rotaciona,
// a própria CLI renova). Min 180s entre chamadas reais (risco de 429) — cacheia o resto.
const fs = require('fs');
const os = require('os');
const path = require('path');

const CREDS = path.join(os.homedir(), '.claude', '.credentials.json');
const URL = 'https://api.anthropic.com/api/oauth/usage';
const UA = process.env.CLAUDE_UA || 'claude-cli/1.0.0 (external, cli)';
const MIN_INTERVAL = 180000;

let cache = { at: 0, data: null };
let lastAttempt = 0; // gate: nunca bate no endpoint mais de 1x/MIN_INTERVAL (mesmo em erro → evita 429)

function readToken() {
  const c = JSON.parse(fs.readFileSync(CREDS, 'utf8'));
  if (!c.claudeAiOauth || !c.claudeAiOauth.accessToken) throw new Error('sem accessToken');
  return c.claudeAiOauth.accessToken;
}

function shape(u) {
  const tool = { tool: 'claude', label: 'Claude Code', windows: [], confidence: 'live' };
  if (u.five_hour) tool.windows.push({ name: '5h', pct: u.five_hour.utilization, resets_at: u.five_hour.resets_at });
  if (u.seven_day) tool.windows.push({ name: '7d', pct: u.seven_day.utilization, resets_at: u.seven_day.resets_at });
  if (u.extra_usage && u.extra_usage.is_enabled) {
    tool.extra = {
      used_credits: u.extra_usage.used_credits,
      monthly_limit: u.extra_usage.monthly_limit,
      currency: u.extra_usage.currency,
      pct: u.extra_usage.utilization,
    };
  }
  return tool;
}

async function collect() {
  const now = Date.now();
  if (cache.data && now - cache.at < MIN_INTERVAL) {
    return { ...cache.data, confidence: 'cached' };
  }
  // gate de segurança: não repetir a chamada real antes de MIN_INTERVAL, nem em erro
  if (now - lastAttempt < MIN_INTERVAL) {
    if (cache.data) return { ...cache.data, confidence: 'stale' };
    return { tool: 'claude', label: 'Claude Code', windows: [], confidence: 'cooldown',
             error: 'aguardando intervalo (≥180s) antes de tentar de novo' };
  }
  lastAttempt = now;
  try {
    const token = readToken();
    const res = await fetch(URL, {
      headers: {
        Authorization: 'Bearer ' + token,
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': UA,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = shape(await res.json());
    cache = { at: now, data };
    return data;
  } catch (e) {
    if (cache.data) return { ...cache.data, confidence: 'stale', error: String(e.message || e) };
    return { tool: 'claude', label: 'Claude Code', windows: [], confidence: 'error', error: String(e.message || e) };
  }
}

module.exports = { collect };
