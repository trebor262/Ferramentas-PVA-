#!/usr/bin/env node
// Agendador de lembretes para o OpenWA. Sem dependências (Node 18+).
//
// Uso:
//   OPENWA_API_KEY=... OPENWA_SESSION_ID=... node lembretes.mjs [--arquivo lembretes.json] [--uma-vez] [--simular]
//
//   --uma-vez   avalia a agenda uma única vez e sai (útil para cron/teste)
//   --simular   não envia nada, só mostra o que seria enviado
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const pad = (n) => String(n).padStart(2, '0');
const dataChave = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "2026-11-20 09:00" (horário local) -> Date, ou null se inválido. */
export function parseQuando(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(String(str));
  if (!m) return null;
  const [, a, mo, d, h, mi] = m.map(Number);
  const dt = new Date(a, mo - 1, d, h, mi, 0, 0);
  return dt.getMonth() === mo - 1 && dt.getHours() === h ? dt : null;
}

/** Retorna lista de erros (vazia se o lembrete é válido). */
export function validar(l) {
  const erros = [];
  if (!l || typeof l !== 'object') return ['lembrete inválido'];
  if (!l.id || typeof l.id !== 'string') erros.push('falta "id"');
  if (!/^\d{10,15}$/.test(String(l.numero ?? ''))) erros.push('"numero" deve ter só dígitos com DDI+DDD (ex.: 5571999999999)');
  if (!l.texto || typeof l.texto !== 'string') erros.push('falta "texto"');
  if (Boolean(l.quando) === Boolean(l.hora)) erros.push('use exatamente um: "quando" (único) ou "hora" (recorrente)');
  if (l.quando && !parseQuando(l.quando)) erros.push('"quando" deve ser "AAAA-MM-DD HH:MM"');
  if (l.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(l.hora)) erros.push('"hora" deve ser "HH:MM"');
  if (l.dias && (!Array.isArray(l.dias) || l.dias.some((d) => !DIAS.includes(d)))) erros.push(`"dias" aceita: ${DIAS.join(', ')}`);
  return erros;
}

/**
 * Decide o que fazer com um lembrete agora.
 * Retorna null (nada), { acao: 'enviar'|'expirado', chave }.
 * `chave` é gravada no estado para não repetir: "unico" ou a data (AAAA-MM-DD) do dia.
 */
export function devido(l, agora, estado, janelaMin = 360) {
  if (l.ativo === false) return null;
  let alvo, chave;
  if (l.quando) {
    alvo = parseQuando(l.quando);
    chave = 'unico';
  } else {
    if (!(l.dias ?? DIAS).includes(DIAS[agora.getDay()])) return null;
    const [h, m] = l.hora.split(':').map(Number);
    alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m, 0, 0);
    chave = dataChave(agora);
  }
  if (!alvo || estado[l.id] === chave || agora < alvo) return null;
  // Se o agendador ficou parado por muito tempo, não manda lembrete velho.
  return { acao: (agora - alvo) / 60000 > janelaMin ? 'expirado' : 'enviar', chave };
}

export async function enviarTexto(cfg, numero, texto) {
  const r = await fetch(`${cfg.url}/api/sessions/${cfg.sessionId}/messages/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': cfg.apiKey },
    body: JSON.stringify({ chatId: `${numero}@c.us`, text: texto }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
}

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));

/** Uma passada pela agenda. Para no primeiro erro de envio (tenta de novo no próximo ciclo). */
export async function tick({ lembretes, estado, agora = new Date(), cfg, salvar, log = console.log }) {
  let enviados = 0;
  for (const l of lembretes) {
    const erros = validar(l);
    if (erros.length) { log(`[ignorado] ${l?.id ?? '?'}: ${erros.join('; ')}`); continue; }
    const d = devido(l, agora, estado, cfg.janelaMin);
    if (!d) continue;
    if (d.acao === 'expirado') {
      log(`[expirado] ${l.id}: passou da janela de ${cfg.janelaMin} min, não enviado`);
      estado[l.id] = d.chave; await salvar(estado); continue;
    }
    if (cfg.simular) { log(`[simulação] enviaria para ${l.numero}: ${l.texto}`); continue; }
    if (enviados > 0) await dormir(cfg.esperaMinS * 1000 + Math.random() * (cfg.esperaMaxS - cfg.esperaMinS) * 1000);
    try {
      await enviarTexto(cfg, l.numero, l.texto);
    } catch (e) {
      log(`[erro] ${l.id}: ${e.message}. Vou tentar de novo no próximo ciclo.`);
      break;
    }
    estado[l.id] = d.chave; await salvar(estado); enviados++;
    log(`[enviado] ${l.id} -> ${l.numero}`);
  }
  return enviados;
}

async function main() {
  const args = process.argv.slice(2);
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  const arq = args.includes('--arquivo') ? args[args.indexOf('--arquivo') + 1] : path.join(aqui, 'lembretes.json');
  const arqEstado = path.join(path.dirname(arq), 'estado.json');
  const cfg = {
    url: process.env.OPENWA_URL ?? 'http://localhost:2785',
    apiKey: process.env.OPENWA_API_KEY,
    sessionId: process.env.OPENWA_SESSION_ID,
    janelaMin: Number(process.env.JANELA_ATRASO_MIN ?? 360),
    esperaMinS: Number(process.env.ESPERA_MIN_S ?? 20),
    esperaMaxS: Number(process.env.ESPERA_MAX_S ?? 60),
    simular: args.includes('--simular'),
  };
  if (!cfg.simular && (!cfg.apiKey || !cfg.sessionId)) {
    console.error('Defina OPENWA_API_KEY e OPENWA_SESSION_ID (ou use --simular).'); process.exit(1);
  }
  if (!existsSync(arq)) { console.error(`Arquivo não encontrado: ${arq}\nCopie lembretes.exemplo.json para lembretes.json e edite.`); process.exit(1); }

  const estado = existsSync(arqEstado) ? JSON.parse(await readFile(arqEstado, 'utf8')) : {};
  const salvar = (e) => writeFile(arqEstado, JSON.stringify(e, null, 2));
  do {
    // Relê a agenda a cada ciclo: dá para editar o arquivo sem reiniciar.
    const lembretes = JSON.parse(await readFile(arq, 'utf8'));
    await tick({ lembretes, estado, cfg, salvar });
    if (args.includes('--uma-vez')) return;
    await dormir(30_000);
  } while (true);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
