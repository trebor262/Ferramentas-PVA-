import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { parseQuando, validar, devido, tick } from './lembretes.mjs';

const L = (o) => ({ id: 'x', numero: '5571999999999', texto: 'oi', ...o });
const quiet = () => {};

test('parseQuando aceita formato válido e rejeita datas impossíveis', () => {
  assert.ok(parseQuando('2026-12-05 09:00'));
  assert.equal(parseQuando('2026-02-31 09:00'), null);
  assert.equal(parseQuando('05/12/2026'), null);
});

test('validar exige exatamente um de quando/hora e número só com dígitos', () => {
  assert.deepEqual(validar(L({ hora: '09:00' })), []);
  assert.ok(validar(L({})).length);
  assert.ok(validar(L({ hora: '09:00', quando: '2026-12-05 09:00' })).length);
  assert.ok(validar(L({ hora: '25:00' })).length);
  assert.ok(validar(L({ hora: '09:00', numero: '+55 71 99999-9999' })).length);
  assert.ok(validar(L({ hora: '09:00', dias: ['xyz'] })).length);
});

test('único: só dispara depois da hora, uma vez, e expira se passou da janela', () => {
  const l = L({ quando: '2026-12-05 09:00' });
  assert.equal(devido(l, new Date(2026, 11, 5, 8, 59), {}), null);
  assert.deepEqual(devido(l, new Date(2026, 11, 5, 9, 1), {}), { acao: 'enviar', chave: 'unico' });
  assert.equal(devido(l, new Date(2026, 11, 5, 9, 1), { x: 'unico' }), null);
  assert.equal(devido(l, new Date(2026, 11, 5, 16, 0), {}).acao, 'expirado');
});

test('recorrente: respeita dias da semana e manda uma vez por dia', () => {
  const l = L({ hora: '09:00', dias: ['seg'] });
  const seg = new Date(2026, 10, 16, 9, 5); // 16/11/2026 é segunda
  const ter = new Date(2026, 10, 17, 9, 5);
  assert.deepEqual(devido(l, seg, {}), { acao: 'enviar', chave: '2026-11-16' });
  assert.equal(devido(l, ter, {}), null);
  assert.equal(devido(l, seg, { x: '2026-11-16' }), null);
  assert.deepEqual(devido(l, new Date(2026, 10, 23, 9, 5), { x: '2026-11-16' }), { acao: 'enviar', chave: '2026-11-23' });
});

test('ativo:false não envia', () => {
  assert.equal(devido(L({ hora: '09:00', ativo: false }), new Date(2026, 10, 16, 10), {}), null);
});

function servidor(status = 200) {
  const recebidos = [];
  const srv = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => { recebidos.push({ url: req.url, key: req.headers['x-api-key'], body: JSON.parse(b) }); res.writeHead(status).end('{}'); });
  });
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok({ srv, recebidos, url: `http://127.0.0.1:${srv.address().port}` })));
}
const cfgDe = (url) => ({ url, apiKey: 'KEY', sessionId: 'sess1', janelaMin: 360, esperaMinS: 0, esperaMaxS: 0 });

test('envia para o endpoint certo, com chave e chatId corretos, sem repetir no ciclo seguinte', async () => {
  const { srv, recebidos, url } = await servidor();
  const estado = {};
  const lembretes = [L({ id: 'a', hora: '09:00', texto: 'Olá "mundo"\ncom quebra' })];
  const agora = new Date(2026, 10, 16, 9, 1);
  assert.equal(await tick({ lembretes, estado, agora, cfg: cfgDe(url), salvar: async () => {}, log: quiet }), 1);
  assert.equal(await tick({ lembretes, estado, agora, cfg: cfgDe(url), salvar: async () => {}, log: quiet }), 0);
  srv.close();
  assert.equal(recebidos.length, 1);
  assert.equal(recebidos[0].url, '/api/sessions/sess1/messages/send-text');
  assert.equal(recebidos[0].key, 'KEY');
  assert.deepEqual(recebidos[0].body, { chatId: '5571999999999@c.us', text: 'Olá "mundo"\ncom quebra' });
});

test('se o envio falha, não marca como enviado e tenta de novo depois', async () => {
  const { srv, url } = await servidor(500);
  const estado = {};
  const lembretes = [L({ id: 'a', hora: '09:00' }), L({ id: 'b', hora: '09:00' })];
  const agora = new Date(2026, 10, 16, 9, 1);
  assert.equal(await tick({ lembretes, estado, agora, cfg: cfgDe(url), salvar: async () => {}, log: quiet }), 0);
  assert.deepEqual(estado, {});
  srv.close();
});

test('modo simulação não chama a API', async () => {
  const { srv, recebidos, url } = await servidor();
  const lembretes = [L({ id: 'a', hora: '09:00' })];
  await tick({ lembretes, estado: {}, agora: new Date(2026, 10, 16, 9, 1), cfg: { ...cfgDe(url), simular: true }, salvar: async () => {}, log: quiet });
  srv.close();
  assert.equal(recebidos.length, 0);
});
