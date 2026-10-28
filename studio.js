// Студия записи голоса Алисы (ElevenLabs).
// Ключ API хранится только в переменной окружения ELEVEN_KEY на сервере.
// Страница: /studio?key=<SECRET>  — выбрать голос, прослушать, записать все фразы, скачать архив.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const PHRASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools', 'voice-phrases.json'), 'utf8'));
const GEN_DIR = path.join(os.tmpdir(), 'pokercircle-voice');
const API = 'https://api.elevenlabs.io/v1';
const state = { running: false, done: 0, total: 0, voice: '', error: '' };

const key = () => process.env.ELEVEN_KEY || '';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function api(p, opt = {}) {
  const r = await fetch(API + p, { ...opt, headers: { 'xi-api-key': key(), 'Content-Type': 'application/json', ...(opt.headers || {}) }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}
const SETTINGS = { stability: 0.4, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true };
async function tts(voiceId, text) {
  const r = await api(`/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: 'POST', body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', language_code: 'ru', voice_settings: SETTINGS })
  });
  return Buffer.from(await r.arrayBuffer());
}

// ── минимальный ZIP (без сжатия), чтобы скачать готовый набор одним файлом
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zip(files) {
  const parts = [], central = []; let off = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    parts.push(h, n, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, n);
    off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, e]);
}

async function generateAll(voiceId, voiceName) {
  if (state.running) return;
  Object.assign(state, { running: true, done: 0, total: Object.keys(PHRASES).length, voice: voiceName, error: '' });
  try {
    const dir = path.join(GEN_DIR, 'pack'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    for (const [k, text] of Object.entries(PHRASES)) {
      let ok = false;
      for (let t = 0; t < 3 && !ok; t++) { try { fs.writeFileSync(path.join(dir, k + '.mp3'), await tts(voiceId, text)); ok = true; } catch (e) { if (t === 2) throw e; await new Promise(r => setTimeout(r, 1500)); } }
      state.done++;
    }
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ voice: voiceName, keys: Object.keys(PHRASES) }));
  } catch (e) { state.error = e.message; }
  state.running = false;
}

// Готовый набор отдаётся сайту сразу (до перезапуска сервера), пока его не положили в public/voice
function serveGenerated(url, res) {
  if (!url.startsWith('/voice/')) return false;
  const f = path.join(GEN_DIR, 'pack', path.basename(url));
  if (!fs.existsSync(f)) return false;
  res.writeHead(200, { 'Content-Type': f.endsWith('.json') ? 'application/json' : 'audio/mpeg', 'Cache-Control': 'no-cache' });
  res.end(fs.readFileSync(f));
  return true;
}

async function handle(req, res, url, SECRET) {
  if (!url.startsWith('/studio')) return false;
  const q = new URL(req.url, 'http://x').searchParams;
  if (!SECRET || q.get('key') !== SECRET) { res.writeHead(404); res.end('Не найдено'); return true; }
  const k = encodeURIComponent(q.get('key'));
  try {
    if (!key()) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<h2>Нет ключа ELEVEN_KEY в настройках сервера</h2>'); return true; }
    if (url === '/studio/preview') {
      const mp3 = await tts(q.get('voice'), q.get('text') || PHRASES.hello);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); res.end(mp3); return true;
    }
    if (url === '/studio/generate') { generateAll(q.get('voice'), q.get('name') || 'voice'); res.writeHead(302, { Location: `/studio?key=${k}` }); res.end(); return true; }
    if (url === '/studio/status') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(state)); return true; }
    if (url === '/studio/pack.zip') {
      const dir = path.join(GEN_DIR, 'pack');
      const files = fs.readdirSync(dir).map(n => ['voice/' + n, fs.readFileSync(path.join(dir, n))]);
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="alisa-voice.zip"' }); res.end(zip(files)); return true;
    }
    // главная страница студии: список голосов
    const r = await api('/voices'); const voices = (await r.json()).voices || [];
    let sub = ''; try { const u = await (await api('/user/subscription')).json(); sub = `Осталось символов: ${(u.character_limit - u.character_count).toLocaleString('ru-RU')} из ${u.character_limit.toLocaleString('ru-RU')}`; } catch (e) { }
    const fem = v => /female|woman|жен/i.test(JSON.stringify(v.labels || {}));
    voices.sort((a, b) => fem(b) - fem(a));
    const packReady = fs.existsSync(path.join(GEN_DIR, 'pack', 'index.json'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Студия голоса Алисы</title>
<style>body{font-family:system-ui,Segoe UI,Arial;background:#0b0d15;color:#eee;max-width:900px;margin:0 auto;padding:16px}h1{font-size:22px}.v{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px;border:1px solid #2a3045;border-radius:12px;margin:8px 0;background:#121626}.v b{min-width:160px}.v small{color:#8e96ab;flex:1;min-width:200px}button,a.btn{background:#e3bd6a;color:#1a1206;border:0;border-radius:9px;padding:9px 14px;font-weight:700;cursor:pointer;text-decoration:none}button.g{background:#2a3150;color:#fff}.st{padding:12px;border-radius:12px;background:#1b2238;margin:12px 0}</style></head><body>
<h1>🎙️ Студия голоса Алисы</h1><div class="st">${esc(sub)}<br>Фраз для записи: ${Object.keys(PHRASES).length} (~${Object.values(PHRASES).join('').length} символов)</div>
<div class="st" id="st">${state.running ? `Идёт запись голосом «${esc(state.voice)}»: ${state.done} / ${state.total}…` : state.error ? `Ошибка: ${esc(state.error)}` : packReady ? `✅ Набор записан (${esc(state.voice || 'готов')}). <a class="btn" href="/studio/pack.zip?key=${k}">Скачать архив</a>` : 'Выберите голос и нажмите «Записать все фразы».'}</div>
${voices.map(v => `<div class="v"><b>${esc(v.name)}</b><small>${esc(Object.values(v.labels || {}).join(' · '))}</small>
<button class="g" onclick="play('${esc(v.voice_id)}')">▶ Прослушать</button>
<a class="btn" href="/studio/generate?key=${k}&voice=${encodeURIComponent(v.voice_id)}&name=${encodeURIComponent(v.name)}" onclick="return confirm('Записать все фразы голосом ${esc(v.name).replace(/'/g, '')}?')">Записать все фразы</a></div>`).join('')}
<audio id="au" controls style="width:100%;margin-top:10px"></audio>
<script>function play(id){const a=document.getElementById('au');a.src='/studio/preview?key=${k}&voice='+id+'&t='+Date.now();a.play()}
${state.running ? `setTimeout(()=>location.reload(),4000)` : ''}</script></body></html>`);
    return true;
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Ошибка: ' + e.message); return true;
  }
}

module.exports = { handle, serveGenerated };
