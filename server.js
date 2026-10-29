// PokerCircle — сервер онлайн-покера для друзей (Техасский холдем)
// Запуск: node server.js   (порт можно задать: PORT=8080 node server.js)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const WS = require('./ws');
const P = require('./poker');
const Studio = require('./studio');

if (process.env.POKER_FAST) { const st = global.setTimeout; global.setTimeout = (f, ms, ...a) => st(f, Math.ceil((ms || 0) / 60), ...a); }
try { const lf = path.join(__dirname, 'server.log'); if (fs.statSync(lf).size > 2e6) fs.writeFileSync(lf, ''); } catch (e) { }
const PORT = +process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.mp3': 'audio/mpeg', '.webp': 'image/webp' };

function lanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || [])
    if (n.family === 'IPv4' && !n.internal) out.push(n.address);
  return out;
}

// ───────── Страница владельца: сброс пароля другу ─────────
function adminPage(req, res, url) {
  const q = new URL(req.url, 'http://x').searchParams;
  if (!SECRET || q.get('key') !== SECRET) { res.writeHead(404); return res.end('Не найдено'); }
  const k = encodeURIComponent(q.get('key'));
  const esc = v => String(v == null ? '' : v).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  let note = '';
  if (url === '/admin/reset') {
    const pr = profiles.get(String(q.get('id') || ''));
    if (pr && !pr.tg) {
      const tmp = String(100000 + crypto.randomInt(900000));
      pr.salt = crypto.randomBytes(8).toString('hex'); pr.pinHash = hashPin(tmp, pr.salt); saveProfiles();
      note = `<div class="ok">Новый пароль для <b>${esc(pr.name)}</b> (${esc(pr.phone)}): <b class="pw">${tmp}</b><br>Отправьте его другу сразу — пусть войдёт в течение 10 минут (бесплатный сервер засыпает, и сброс может потеряться). Потом он сменит пароль в кабинете.</div>`;
    }
  }
  const rows = [...profiles.entries()].filter(([, p]) => !p.tg).sort((a, b) => (b[1].created || 0) - (a[1].created || 0)).map(([id, p]) =>
    `<tr><td>${esc(p.avatar || '')} ${esc(p.name)}</td><td>${esc(p.phone)}</td><td>${(p.balance || 0).toLocaleString('ru-RU')}</td><td><a class="btn" href="/admin/reset?key=${k}&id=${encodeURIComponent(id)}" onclick="return confirm('Сбросить пароль игроку ${esc(p.name).replace(/'/g, '')}?')">Сбросить пароль</a></td></tr>`).join('');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Игроки — PokerCircle</title>
<style>body{font-family:system-ui,Segoe UI,Arial;background:#0b0d15;color:#eee;max-width:820px;margin:0 auto;padding:16px}h1{font-size:22px}table{width:100%;border-collapse:collapse}td,th{padding:10px 8px;border-bottom:1px solid #2a3045;text-align:left;font-size:14px}th{color:#8e96ab;font-weight:600}.btn{background:#e3bd6a;color:#1a1206;border-radius:9px;padding:7px 12px;font-weight:700;text-decoration:none;white-space:nowrap;display:inline-block}.ok{padding:14px;border-radius:12px;background:#163322;border:1px solid #2f7a4c;margin:12px 0;line-height:1.6}.pw{font-size:22px;letter-spacing:2px;color:#f7d282}.muted{color:#8e96ab;font-size:13px}@media(max-width:600px){td:nth-child(3),th:nth-child(3){display:none}}</style></head><body>
<h1>👥 Игроки</h1><p class="muted">Если друг забыл пароль и не сохранил код восстановления, нажмите «Сбросить пароль» и отправьте ему новый пароль. Ссылку на эту страницу никому не давайте.</p>${note}
<table><tr><th>Имя</th><th>Телефон</th><th>Баланс</th><th></th></tr>${rows || '<tr><td colspan="4" class="muted">Пока никто не входил после последнего перезапуска сервера</td></tr>'}</table></body></html>`);
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ips: lanIPs(), port: PORT, publicUrl: Tunnel.url, sign: Sign.page, bot: TG.me ? TG.me.username : '' }));
  }
  if (url.startsWith('/studio')) { Studio.handle(req, res, url, SECRET); return; }
  if (url === '/admin' || url === '/admin/reset') return adminPage(req, res, url);
  let file = path.normalize(path.join(PUBLIC, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { if (Studio.serveGenerated(url, res)) return; res.writeHead(404); return res.end('Не найдено'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ───────────────────────── Клиенты ─────────────────────────
const clients = new Set();      // все подключения
const rooms = new Map();        // id -> Room

function ipOf(req) {
  let ip = (req.headers['cf-connecting-ip'] || '').trim() || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
  ip = ip.replace(/^::ffff:/, '');
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}
function send(c, t, d) { if (c && c.open) c.send(JSON.stringify({ t, d })); }
function onlineUsers() {
  const seen = new Map();
  for (const c of clients) if (c.user) seen.set(c.user.pid, { name: c.user.name, avatar: c.user.avatar, room: c.roomId ? (rooms.get(c.roomId) || {}).name || null : null });
  return [...seen.values()];
}
function broadcastLobby() {
  const list = [...rooms.values()].map(r => r.summary());
  const online = onlineUsers();
  for (const c of clients) if (c.user) send(c, 'lobby', { rooms: list, online });
}
// ───────────────────────── Профили (сохраняются на диск) ─────────────────────────
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { }
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
let SECRET = process.env.SECRET || '';
if (!SECRET) {
  const f = path.join(DATA_DIR, 'secret.txt');
  try { SECRET = fs.readFileSync(f, 'utf8').trim(); } catch (e) { }
  if (!SECRET) { SECRET = crypto.randomBytes(32).toString('hex'); try { fs.writeFileSync(f, SECRET); } catch (e) { } }
}
const profiles = new Map();
try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8')))) profiles.set(k, v); } catch (e) { }
let saveTimer = null;
function saveProfiles() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(PROFILES_FILE + '.tmp', JSON.stringify(Object.fromEntries(profiles)));
      fs.renameSync(PROFILES_FILE + '.tmp', PROFILES_FILE);
    } catch (e) { console.error('Не удалось сохранить профили:', e.message); }
  }, 1500);
}
const hmac = s => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
const keyOf = name => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/ё/g, 'е');
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const tokenFor = (key, pr) => Buffer.from(key).toString('base64url') + '.' + hmac('tok:' + key + ':' + pr.pinHash);
function sign(obj) { const b = Buffer.from(JSON.stringify(obj)).toString('base64url'); return b + '.' + hmac('bk:' + b); }
function unsign(str) {
  try {
    const [b, sig] = String(str || '').split('.');
    if (!b || sig !== hmac('bk:' + b)) return null;
    return JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
  } catch (e) { return null; }
}
// код восстановления пароля: 8 символов без похожих букв (0/O, 1/I)
const RC_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genCode = () => { const b = crypto.randomBytes(8); let s = ''; for (let i = 0; i < 8; i++) s += RC_ABC[b[i] % RC_ABC.length]; return s.slice(0, 4) + '-' + s.slice(4); };
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/I/g, '1');
const resetTries = new Map();   // ip+номер → попытки (защита от подбора)
const blankStats = () => ({ hands: 0, wins: 0, biggest: 0, won: 0, net: 0, best: null, games: [] });
function backupOf(key) { const pr = profiles.get(key); return pr ? sign({ key, ...pr }) : ''; }
function restoreFromBackup(bk, key) {
  const d = unsign(bk);
  if (!d || d.key !== key || !d.pinHash) return null;
  const { key: _k, ...pr } = d;
  if (!profiles.has(key)) {
    if (pr.inPlay) { for (const v of Object.values(pr.inPlay)) pr.balance = (pr.balance || 0) + (v || 0); pr.inPlay = {}; }
    profiles.set(key, pr); saveProfiles();
  }
  return profiles.get(key);
}
// статистика игрока: у профиля — постоянная, у гостя — до перезапуска
const guestStats = new Map();
function statOf(pid) {
  if (String(pid).startsWith('u:')) {
    const pr = profiles.get(pid.slice(2));
    if (pr) { pr.stats = Object.assign(blankStats(), pr.stats || {}); return pr.stats; }
  }
  if (!guestStats.has(pid)) guestStats.set(pid, blankStats());
  return guestStats.get(pid);
}
function pushBackups(pids) {
  saveProfiles();
  for (const c of clients) if (c.user && pids.has(c.user.pid) && c.user.key) {
    send(c, 'backup', { backup: backupOf(c.user.key) });
    send(c, 'stats', statOf(c.user.pid));
  }
}
// ───────────────────────── Кошелёк (виртуальные фишки, без денег) ─────────────────────────
const Wallet = {
  START: 100000, BONUS: 20000, BONUS_EVERY: 4 * 3600000,
  prof(pid) { return String(pid).startsWith('u:') ? profiles.get(String(pid).slice(2)) : null; },
  bal(pid) { const pr = this.prof(pid); return pr ? (pr.balance || 0) : 0; },
  charge(pid, amt) {
    const pr = this.prof(pid); if (!pr) return false;
    if ((pr.balance || 0) < amt) return false;
    pr.balance -= amt; saveProfiles(); this.notify(pid); return true;
  },
  credit(pid, amt) {
    const pr = this.prof(pid); if (!pr || !(amt > 0)) return;
    pr.balance = (pr.balance || 0) + Math.floor(amt); saveProfiles(); this.notify(pid);
  },
  inPlay(pid, roomId, stack) {
    const pr = this.prof(pid); if (!pr) return;
    pr.inPlay = pr.inPlay || {};
    if (stack > 0) pr.inPlay[roomId] = stack; else delete pr.inPlay[roomId];
    saveProfiles();
  },
  info(pr) { return { balance: pr.balance || 0, bonusIn: Math.max(0, (pr.lastBonus || 0) + this.BONUS_EVERY - Date.now()) }; },
  notify(pid) {
    const pr = this.prof(pid); if (!pr) return;
    for (const c of clients) if (c.user && c.user.pid === pid) { send(c, 'wallet', this.info(pr)); if (c.user.key) send(c, 'backup', { backup: backupOf(c.user.key) }); }
  }
};
// после перезапуска сервера фишки, оставшиеся «за столом», возвращаются на баланс
for (const pr of profiles.values()) {
  if (pr.balance == null) pr.balance = Wallet.START;
  if (pr.inPlay) { for (const v of Object.values(pr.inPlay)) pr.balance += v || 0; pr.inPlay = {}; }
}
saveProfiles();

function leaderboard() {
  return [...profiles.values()].filter(p => p.stats && p.stats.hands > 0)
    .map(p => ({ name: p.name, avatar: p.avatar, net: p.stats.net || 0, balance: p.balance || 0, hands: p.stats.hands, wins: p.stats.wins }))
    .sort((a, b) => b.balance - a.balance).slice(0, 10);
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const clean = (s, n) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);

// ───────────────────────── Комната / стол ─────────────────────────
const LEVELS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 100];
const round50 = v => Math.max(50, Math.round(v / 50) * 50);

class Room {
  constructor(o) {
    this.id = o.id;
    this.name = o.name;
    this.password = o.password || '';
    this.mode = o.mode === 'tournament' ? 'tournament' : 'cash';
    this.baseSb = o.sb; this.baseBb = o.bb; this.baseAnte = o.ante;
    this.sb = o.sb; this.bb = o.bb; this.ante = o.ante;
    this.startStack = o.startStack;
    this.maxSeats = Math.min(6, Math.max(2, o.maxSeats || 6));
    this.turnTime = Math.min(90, Math.max(10, o.turnTime || 30));
    this.oneIp = !!o.oneIp;
    // рост блайндов: levelMode 'time' (каждые N минут) или 'hands' (каждые N раздач); levelEvery 0 — без роста
    this.levelMode = o.levelMode === 'hands' ? 'hands' : 'time';
    this.levelEvery = Math.max(0, Math.min(100, Math.floor(+o.levelEvery || 0)));
    if (this.mode === 'tournament' && !this.levelEvery) this.levelEvery = 8;
    this.levelMinutes = this.levelEvery;
    this.levelHand = 0;
    this.hostPid = o.hostPid;
    this.seats = new Array(this.maxSeats).fill(null);
    this.chat = []; this.history = []; this.places = [];
    this.button = -1; this.handNo = 0; this.hand = null;
    this.level = 0; this.levelStart = 0;
    this.started = false;  // для турнира
    this.timer = null; this.nextTimer = null;
    this.emptySince = Date.now();
  }
  summary() {
    return {
      id: this.id, name: this.name, isPrivate: !!this.password, mode: this.mode,
      sb: this.sb, bb: this.bb, ante: this.ante, startStack: this.startStack,
      players: this.seats.filter(Boolean).length, maxSeats: this.maxSeats,
      started: this.started, playing: !!(this.hand && !this.hand.finished), paused: !!this.paused, blindsUp: this.levelEvery > 0,
      names: this.seats.filter(Boolean).map(p => p.name)
    };
  }
  conns() { return [...clients].filter(c => c.roomId === this.id); }
  seatOf(pid) { return this.seats.findIndex(p => p && p.pid === pid); }
  nextIdx(from, pred) {
    for (let k = 1; k <= this.maxSeats; k++) {
      const i = ((from + k) % this.maxSeats + this.maxSeats) % this.maxSeats;
      const p = this.seats[i];
      if (p && pred(p, i)) return i;
    }
    return -1;
  }
  live() { return this.seats.filter(p => p && p.inHand && !p.folded); }
  canActCount() { return this.seats.filter(p => p && p.inHand && !p.folded && !p.allIn).length; }

  // ——— чат и голос дилера ———
  pushChat(m) {
    m.time = Date.now();
    this.chat.push(m);
    if (this.chat.length > 150) this.chat.shift();
    for (const c of this.conns()) send(c, 'chat', m);
  }
  // voice — список записанных фраз Алисы (public/voice/*.mp3), которые проигрываются вместо голоса устройства
  say(text, kind = 'major', voice) {
    this.pushChat({ from: 'Дилер', text, dealer: true });
    for (const c of this.conns()) send(c, 'dealer', { text, kind, voice: voice || null });
  }
  sfx(name, extra) { for (const c of this.conns()) send(c, 'sfx', Object.assign({ name }, extra || {})); }

  // ——— состояние для конкретного игрока (свои карты видны только себе) ———
  stateFor(pid) {
    const h = this.hand;
    const my = this.seatOf(pid);
    const seats = this.seats.map((p, i) => {
      if (!p) return null;
      const show = p.pid === pid || (p.revealed && !p.folded);
      return {
        i, name: p.name, avatar: p.avatar, stack: p.stack, bet: p.bet, folded: p.folded, allIn: p.allIn,
        inHand: p.inHand, connected: p.connected, sitOut: p.sitOut, lastAction: p.lastAction,
        ip: p.ip, isHost: p.pid === this.hostPid, rebuys: p.rebuys, me: p.pid === pid,
        cards: p.inHand ? (show ? p.cards : p.cards.map(() => null)) : [],
        best: show && p.best ? { desc: p.best.desc, cards: p.best.cards } : null,
        win: p.winAmount || 0, leaving: p.leaving
      };
    });
    let hand = null, you = null;
    if (h) {
      const totalPot = this.seats.reduce((s, p) => s + (p ? p.total : 0), 0) + (h.deadChips || 0);
      const bets = this.seats.reduce((s, p) => s + (p ? p.bet : 0), 0);
      hand = {
        no: this.handNo, board: h.board, street: h.street, pot: totalPot, collected: totalPot - bets,
        currentBet: h.currentBet, toAct: h.busy ? -1 : h.toAct, deadline: h.deadline, button: this.button,
        sb: h.sbSeat, bb: h.bbSeat, results: h.results, finished: h.finished, pausedLeft: h.pausedLeft || 0
      };
      const p = this.seats[my];
      if (p && !h.busy && !h.finished && h.toAct === my) {
        const toCall = Math.max(0, Math.min(h.currentBet - p.bet, p.stack));
        const othersCanAct = this.seats.some((q, j) => q && j !== my && q.inHand && !q.folded && !q.allIn);
        const maxTo = p.bet + p.stack;
        let minTo = h.currentBet === 0 ? this.bb : h.currentBet + h.minRaise;
        minTo = Math.min(minTo, maxTo);
        you = {
          toCall, canCheck: p.bet >= h.currentBet, minRaiseTo: minTo, maxRaiseTo: maxTo,
          canRaise: !p.acted && p.stack > toCall && othersCanAct, isBet: h.currentBet === 0,
          myBet: p.bet, pot: totalPot
        };
      }
    }
    return {
      now: Date.now(),
      room: {
        id: this.id, name: this.name, mode: this.mode, isPrivate: !!this.password, sb: this.sb, bb: this.bb, ante: this.ante,
        startStack: this.startStack, maxSeats: this.maxSeats, turnTime: this.turnTime, oneIp: this.oneIp,
        hostPid: this.hostPid, isHost: pid === this.hostPid, started: this.started,
        canStart: this.mode === 'tournament' && !this.started && (pid === this.hostPid || (this.seatOf(pid) >= 0 && !this.seats.some(p => p && p.pid === this.hostPid && p.connected))), paused: !!this.paused, pausedBy: this.pausedBy || '', level: this.level + 1,
        nextLevelAt: this.levelEvery > 0 && this.levelMode === 'time' && this.levelStart ? this.levelStart + (this.level + 1) * this.levelEvery * 60000 : 0,
        nextLevelHands: this.levelEvery > 0 && this.levelMode === 'hands' && this.levelStart ? Math.max(1, this.levelHand + (this.level + 1) * this.levelEvery - this.handNo) : 0,
        blindsUp: this.levelEvery > 0 ? (this.levelMode === 'hands' ? `каждые ${this.levelEvery} раздач` : `каждые ${this.levelEvery} мин`) : 'нет',
        places: this.places
      },
      seats, hand, you, mySeat: my
    };
  }
  broadcast() {
    for (const c of this.conns()) send(c, 'state', this.stateFor(c.user.pid));
  }

  // ——— рассадка ———
  sit(c, seat, amount) {
    const u = c.user;
    if (this.seatOf(u.pid) >= 0) return 'Вы уже сидите за столом';
    if (seat < 0 || seat >= this.maxSeats || this.seats[seat]) return 'Место занято';
    if (this.mode === 'tournament' && this.started) return 'Турнир уже идёт — можно только наблюдать';
    if (this.oneIp && this.seats.some(p => p && p.ip === u.ip))
      return 'С вашего IP уже сидит игрок. В этой комнате каждый играет со своего IP.';
    // бай-ин списывается с баланса игрока
    const bal = Wallet.bal(u.pid);
    let buyIn = this.startStack;
    if (this.mode === 'cash') {
      buyIn = Math.min(this.startStack, bal);
      // игрок сам выбрал, со сколькими фишками сесть
      if (amount > 0) buyIn = Math.min(bal, Math.max(this.bb * 10, Math.floor(amount)));
    }
    if (buyIn < (this.mode === 'cash' ? this.bb * 10 : this.startStack))
      return `Недостаточно фишек на балансе (${bal.toLocaleString('ru-RU')}). Нужно ${(this.mode === 'cash' ? this.bb * 10 : this.startStack).toLocaleString('ru-RU')}. Заберите бонус в кабинете.`;
    if (!Wallet.charge(u.pid, buyIn)) return 'Недостаточно фишек на балансе';
    Wallet.inPlay(u.pid, this.id, buyIn);
    this.seats[seat] = {
      pid: u.pid, name: u.name, avatar: u.avatar, ip: u.ip, stack: buyIn, paid: true, connected: true,
      sitOut: false, inHand: false, cards: [], folded: false, allIn: false, bet: 0, total: 0, acted: false,
      lastAction: '', revealed: false, best: null, winAmount: 0, rebuys: 0, leaving: false, discAt: 0
    };
    { const k = 1 + Math.floor(Math.random() * 3); this.say([`${u.name}, добро пожаловать за мой стол.`, `Рада вас видеть, ${u.name}. Присаживайтесь.`, `${u.name} с нами. Становится интереснее.`][k - 1], 'info', ['welcome_' + k]); }
    this.broadcast(); broadcastLobby();
    this.maybeStart();
    return null;
  }
  release(i) {
    const p = this.seats[i]; if (!p) return;
    let back = 0;
    if (this.mode === 'cash') back = p.stack;
    else if (!this.started && p.paid) back = p.stack;          // турнир не начался — возврат бай-ина
    if (back > 0) Wallet.credit(p.pid, back);
    Wallet.inPlay(p.pid, this.id, 0);
    this.seats[i] = null;
    if (back > 0) for (const c of clients) if (c.user && c.user.pid === p.pid) send(c, 'toast', { text: `💰 ${back.toLocaleString('ru-RU')} фишек возвращено на баланс` });
  }
  stand(pid, reason) {
    const i = this.seatOf(pid);
    if (i < 0) return;
    const p = this.seats[i];
    const h = this.hand;
    if (h && !h.finished && p.inHand) {
      p.leaving = true;
      if (!p.folded) {
        if (h.toAct === i && !h.busy) return this.act(pid, 'fold');
        p.folded = true; p.lastAction = 'Фолд';
        if (this.live().length === 1 && !h.busy) { this.clearTurn(); return this.winUncontested(this.live()[0]); }
        if (h.toAct === i && h.busy) { /* ход перейдёт сам */ }
      }
      this.broadcast();
      return;
    }
    this.release(i);
    if (reason !== 'silent') this.say(`${p.name} покидает стол.`, 'info', ['leave']);
    this.broadcast(); broadcastLobby();
  }

  maybeStart() {
    if (this.paused) return;
    if (this.hand && !this.hand.finished) return;
    if (this.nextTimer) return;
    if (this.mode === 'tournament' && !this.started) return;
    const ready = this.seats.filter(p => p && p.stack > 0 && !p.sitOut && p.connected).length;
    if (ready >= 2) {
      this.nextTimer = setTimeout(() => { this.nextTimer = null; this.startHand(); }, 4000);
    }
  }

  // ——— раздача ———
  startHand() {
    if (this.paused) return;
    if (this.hand && !this.hand.finished) return;
    // убрать ушедших и долго отключённых
    this.seats.forEach((p, i) => {
      if (!p) return;
      if (p.leaving || (!p.connected && Date.now() - p.discAt > 180000)) {
        this.release(i);
        this.say(`${p.name} покидает стол.`, 'info');
      }
    });
    // рост блайндов (настраивается для любого стола)
    if (this.levelEvery > 0 && (this.mode === 'cash' || this.started)) {
      if (!this.levelStart) { this.levelStart = Date.now(); this.levelHand = this.handNo; }
      const lvl = Math.min(LEVELS.length - 1, this.levelMode === 'hands'
        ? Math.floor((this.handNo - this.levelHand) / this.levelEvery)
        : Math.floor((Date.now() - this.levelStart) / (this.levelEvery * 60000)));
      if (lvl !== this.level) {
        this.level = lvl;
        const k = LEVELS[lvl];
        this.sb = round50(this.baseSb * k); this.bb = Math.max(this.sb * 2, round50(this.baseBb * k));
        this.ante = this.baseAnte ? round50(this.baseAnte * k) : 0;
        this.say(`Внимание! Блайнды повышаются: ${this.sb} и ${this.bb}${this.ante ? `, анте ${this.ante}` : ''}.`, 'major', ['blinds_up']);
        broadcastLobby();
      }
    }
    const eligible = this.seats.filter(p => p && p.stack > 0 && !p.sitOut && (p.connected || Date.now() - p.discAt < 60000));
    this.seats.forEach(p => {
      if (!p) return;
      Object.assign(p, { inHand: false, cards: [], folded: false, allIn: false, bet: 0, total: 0, acted: false, lastAction: p.sitOut ? 'Пропуск' : '', revealed: false, best: null, winAmount: 0, refund: 0 });
    });
    if (eligible.length < 2) { this.hand = null; this.broadcast(); broadcastLobby(); return; }
    eligible.forEach(p => (p.inHand = true));
    this.handNo++;
    const inH = p => p.inHand;
    this.button = this.nextIdx(this.button, inH);
    let sbS, bbS;
    if (eligible.length === 2) { sbS = this.button; bbS = this.nextIdx(sbS, inH); } // хедз-ап: баттон ставит малый блайнд
    else { sbS = this.nextIdx(this.button, inH); bbS = this.nextIdx(sbS, inH); }
    const h = this.hand = {
      id: crypto.randomUUID(), deck: P.newDeck(), board: [], street: 'preflop', currentBet: 0, minRaise: this.bb,
      toAct: -1, deadline: 0, sbSeat: sbS, bbSeat: bbS, finished: false, results: null, busy: true, deadChips: 0,
      log: [], started: Date.now()
    };
    // анте
    if (this.ante > 0) for (const p of eligible) {
      const a = Math.min(this.ante, p.stack);
      p.stack -= a; p.total += a; if (p.stack === 0) p.allIn = true;
    }
    const post = (i, amt, label) => {
      const p = this.seats[i];
      const a = Math.min(amt, p.stack);
      p.stack -= a; p.bet += a; p.total += a;
      if (p.stack === 0) p.allIn = true;
      p.lastAction = label;
    };
    post(sbS, this.sb, 'МБ');
    post(bbS, this.bb, 'ББ');
    h.currentBet = Math.max(this.bb, ...this.seats.map(p => (p ? p.bet : 0)));
    // раздаём по одной карте начиная с малого блайнда
    const order = [];
    let s = sbS;
    for (let k = 0; k < eligible.length; k++) { order.push(s); s = this.nextIdx(s, inH); }
    for (let r = 0; r < 2; r++) for (const i of order) this.seats[i].cards.push(h.deck.pop());
    eligible.forEach(p => { const st = statOf(p.pid); st.hands++; });
    const greet = ['Раздаю карты, мои дорогие. Удачи за столом.', 'Новая раздача. Пусть удача вам улыбнётся.', 'Карты пошли. Покажите, на что вы способны.', 'Начинаем. Играем красиво, как вы умеете.', 'Раздаю. Надеюсь, сегодня кто-то меня удивит.'];
    { const gi = Math.floor(Math.random() * greet.length); this.say(greet[gi], 'major', ['greet_' + (gi + 1)]); }
    for (const c of this.conns()) send(c, 'deal', { order, button: this.button });
    this.broadcast(); broadcastLobby();
    const id = h.id;
    setTimeout(() => {
      if (!this.hand || this.hand.id !== id) return;
      h.busy = false;
      this.proceed(bbS);
    }, order.length * 2 * 300 + 700);
  }

  needsAction(p) {
    const h = this.hand;
    if (!p.inHand || p.folded || p.allIn) return false;
    if (p.bet < h.currentBet) return true;
    if (this.canActCount() < 2) return false;
    return !p.acted;
  }

  proceed(from) {
    const h = this.hand;
    if (!h || h.finished) return;
    const live = this.live();
    if (live.length === 1) return this.winUncontested(live[0]);
    const nxt = this.nextIdx(from, p => this.needsAction(p));
    if (nxt < 0) return this.endStreet();
    this.setTurn(nxt);
  }

  setTurn(i) {
    const h = this.hand;
    h.toAct = i;
    const p = this.seats[i];
    const ms = p.connected ? this.turnTime * 1000 : 2500;
    clearTimeout(this.timer);
    if (this.paused) { h.pausedLeft = ms; h.deadline = 0; this.broadcast(); return; }
    this.armTurn(i, ms);
    this.broadcast();
  }
  armTurn(i, ms) {
    const h = this.hand;
    h.deadline = Date.now() + ms; h.pausedLeft = 0;
    clearTimeout(this.timer);
    const id = h.id, street = h.street;
    this.timer = setTimeout(() => {
      if (this.paused || !this.hand || this.hand.id !== id || this.hand.street !== street || this.hand.toAct !== i) return;
      const q = this.seats[i];
      if (!q) return;
      if (q.connected) this.pushChat({ from: 'Система', text: `${q.name}: время вышло`, system: true });
      if (q.bet >= h.currentBet) this.act(q.pid, 'check', 0, true);
      else this.act(q.pid, 'fold', 0, true);
    }, ms);
  }
  // ——— пауза игры ———
  setPause(pid, on) {
    const i = this.seatOf(pid);
    if (i < 0 && pid !== this.hostPid) return 'Поставить паузу может только игрок за столом';
    if (!!this.paused === !!on) return null;
    const who = i >= 0 ? this.seats[i].name : 'Создатель стола';
    const h = this.hand;
    if (on) {
      this.paused = true; this.pausedBy = who; this.pausedAt = Date.now();
      clearTimeout(this.nextTimer); this.nextTimer = null;
      if (h && !h.finished && h.toAct >= 0) { clearTimeout(this.timer); h.pausedLeft = Math.max(5000, h.deadline - Date.now()); h.deadline = 0; }
      this.say(`Пауза. ${who} попросил небольшой перерыв... Отдохните, я подожду.`, 'major', ['pause']);
    } else {
      this.paused = false;
      if (this.levelStart && this.levelMode === 'time') this.levelStart += Date.now() - this.pausedAt; // время паузы не идёт в уровни блайндов
      { const ri = 1 + Math.floor(Math.random() * 2); this.say(['Продолжаем игру. Я скучала.', 'Продолжаем, мои дорогие.'][ri - 1], 'major', ['resume_' + ri]); }
      if (h && h.finished) { this.nextTimer = setTimeout(() => { this.nextTimer = null; if (this.hand === h) this.afterHand(); }, 2500); }
      else if (h && h.toAct >= 0) this.armTurn(h.toAct, h.pausedLeft || this.turnTime * 1000);
      else if (!h) this.maybeStart();
    }
    this.broadcast(); broadcastLobby();
    return null;
  }
  clearTurn() { clearTimeout(this.timer); if (this.hand) this.hand.toAct = -1; }

  act(pid, type, amount, auto) {
    const h = this.hand;
    if (this.paused) return 'Игра на паузе';
    if (!h || h.finished || h.busy) return 'Сейчас не ваш ход';
    const i = this.seatOf(pid);
    if (i < 0 || h.toAct !== i) return 'Сейчас не ваш ход';
    const p = this.seats[i];
    const toCall = Math.max(0, h.currentBet - p.bet);
    const fmt = n => n.toLocaleString('ru-RU');
    let say = '', sfx = 'chip', voice = null;

    if (type === 'allin') {
      const to = p.bet + p.stack;
      if (to <= h.currentBet || p.acted) type = 'call';
      else { type = 'raise'; amount = to; }
    }
    if (type === 'fold') {
      p.folded = true; p.lastAction = 'Фолд'; say = `${p.name} — пас`; sfx = 'fold'; voice = ['fold'];
    } else if (type === 'check') {
      if (p.bet < h.currentBet) return 'Нельзя сделать чек — нужно уравнять ставку';
      p.lastAction = 'Чек'; say = `${p.name} — чек`; sfx = 'check'; voice = ['check'];
    } else if (type === 'call') {
      if (toCall === 0) { p.lastAction = 'Чек'; say = `${p.name} — чек`; sfx = 'check'; voice = ['check']; }
      else {
        const a = Math.min(toCall, p.stack);
        p.stack -= a; p.bet += a; p.total += a;
        if (p.stack === 0) { p.allIn = true; p.lastAction = 'Олл-ин'; say = pick([`${p.name} идёт олл-ин. Смело.`, `Олл-ин от ${p.name}. Обожаю такую решимость.`]); voice = [pick(['allin_1', 'allin_2'])]; }
        else { p.lastAction = `Колл ${fmt(a)}`; say = `${p.name} — колл`; voice = ['call']; }
      }
    } else if (type === 'raise') {
      if (p.acted) return 'Повышение сейчас невозможно';
      if (p.stack <= toCall) return 'Недостаточно фишек для повышения';
      const maxTo = p.bet + p.stack;
      const minTo = h.currentBet === 0 ? this.bb : h.currentBet + h.minRaise;
      let to = Math.floor(+amount || 0);
      if (to >= maxTo) to = maxTo;
      else if (to < minTo) to = Math.min(minTo, maxTo);
      const add = to - p.bet;
      const wasBet = h.currentBet === 0;
      p.stack -= add; p.bet = to; p.total += add;
      const raiseSize = to - h.currentBet;
      if (raiseSize >= h.minRaise) {
        h.minRaise = raiseSize;
        // полное повышение открывает торги заново для всех
        this.seats.forEach((q, j) => { if (q && j !== i && q.inHand && !q.folded && !q.allIn) q.acted = false; });
      }
      h.currentBet = Math.max(h.currentBet, to);
      if (p.stack === 0) { p.allIn = true; p.lastAction = 'Олл-ин'; say = pick([`${p.name} идёт олл-ин. ${fmt(to)}. Как смело.`, `Олл-ин, ${fmt(to)}. ${p.name}, вы умеете волновать.`]); voice = [pick(['allin_1', 'allin_2'])]; }
      else if (wasBet) { p.lastAction = `Ставка ${fmt(to)}`; say = `${p.name} ставит ${fmt(to)}`; voice = ['bet']; }
      else { p.lastAction = `Рейз ${fmt(to)}`; say = pick([`${p.name} повышает до ${fmt(to)}.`, `Рейз до ${fmt(to)}. Становится жарко.`, `${p.name} поднимает до ${fmt(to)}. Интересно.`]); voice = [pick(['raise_1', 'raise_2'])]; }
    } else return 'Неизвестное действие';

    p.acted = true;
    h.log.push(`${p.name}: ${p.lastAction}`);
    clearTimeout(this.timer);
    h.toAct = -1;
    const major = /олл-ин|повышает|ставит/.test(say);
    this.say(say, major ? 'major' : 'action', voice);
    this.sfx(sfx, { seat: i, allin: p.allIn });
    this.proceed(i);
    if (this.hand === h && !h.finished && h.toAct === -1) this.broadcast();
    return null;
  }

  endStreet() {
    const h = this.hand;
    clearTimeout(this.timer);
    h.toAct = -1;
    this.seats.forEach(p => {
      if (!p || !p.inHand) return;
      p.bet = 0; p.acted = false;
      if (!p.folded && !p.allIn) p.lastAction = '';
    });
    h.currentBet = 0; h.minRaise = this.bb;
    this.sfx('collect');
    if (h.street === 'river') return this.showdown();
    if (this.canActCount() < 2 && !h.runout) {
      h.runout = true;
      this.live().forEach(p => (p.revealed = true));
      this.say('Торги завершены. Открываем карты!', 'major', ['showdown']);
    }
    h.busy = true;
    this.broadcast();
    const id = h.id;
    setTimeout(() => { if (this.hand && this.hand.id === id) this.dealStreet(); }, h.runout ? 1800 : 900);
  }

  dealStreet() {
    const h = this.hand;
    h.deck.pop(); // сжигаем карту
    if (h.street === 'preflop') {
      h.board.push(h.deck.pop(), h.deck.pop(), h.deck.pop());
      h.street = 'flop';
      this.say(`Флоп. ${h.board.map(P.cardName).join(', ')}.`, 'major', ['flop', ...h.board.map(c => 'c_' + c.r + c.s)]);
    } else if (h.street === 'flop') {
      h.board.push(h.deck.pop()); h.street = 'turn';
      this.say(`Тёрн. ${P.cardName(h.board[3])}.`, 'major', ['turn_card', 'c_' + h.board[3].r + h.board[3].s]);
    } else {
      h.board.push(h.deck.pop()); h.street = 'river';
      this.say(`И ривер. ${P.cardName(h.board[4])}.`, 'major', ['river', 'c_' + h.board[4].r + h.board[4].s]);
    }
    this.sfx('board');
    this.broadcast();
    const id = h.id;
    setTimeout(() => {
      if (!this.hand || this.hand.id !== id) return;
      h.busy = false;
      this.proceed(this.button);
    }, h.runout ? 1600 : 1300);
  }

  // Основной и побочные банки
  buildPots() {
    const all = this.seats.filter(p => p && p.total > 0);
    const live = this.live();
    const levels = [...new Set(live.map(p => p.total))].sort((a, b) => a - b);
    const pots = [];
    let prev = 0;
    levels.forEach((L, idx) => {
      let amt = 0;
      for (const p of all) amt += Math.max(0, Math.min(p.total, L) - Math.min(p.total, prev));
      if (idx === levels.length - 1) for (const p of all) if (p.total > L) amt += p.total - L; // остаток сброшенных
      const elig = live.filter(p => p.total >= L);
      const last = pots[pots.length - 1];
      if (last && last.elig.length === elig.length && last.elig.every(p => elig.includes(p))) last.amount += amt;
      else pots.push({ amount: amt, elig });
      prev = L;
    });
    if (pots.length) pots[0].amount += this.hand.deadChips || 0;
    return pots.filter(p => p.amount > 0);
  }

  showdown() {
    const h = this.hand;
    h.street = 'showdown'; h.busy = true;
    const live = this.live();
    live.forEach(p => { p.revealed = true; p.best = P.best([...p.cards, ...h.board]); });
    this.broadcast();
    const id = h.id;
    setTimeout(() => {
      if (!this.hand || this.hand.id !== id) return;
      const pots = this.buildPots();
      const results = [];
      const orderFromButton = seatP => (this.seats.indexOf(seatP) - this.button - 1 + this.maxSeats * 2) % this.maxSeats;
      const liveTotals = this.live().map(p => p.total).sort((a, b) => b - a);
      pots.forEach((pot, k) => {
        // Банк, на который претендует только один игрок, — это его неуравненная ставка (плюс фишки сбросивших сверху)
        if (pot.elig.length === 1) {
          const w = pot.elig[0];
          const own = Math.min(pot.amount, w.total - (liveTotals[1] || 0));
          const won = pot.amount - own;
          w.stack += pot.amount; w.winAmount += won; w.refund = (w.refund || 0) + own;
          results.push({
            name: 'Возврат', refund: true, amount: pot.amount, winners: won > 0 ? [this.seats.indexOf(w)] : [],
            names: [w.name], hand: won > 0 ? 'возврат лишней ставки и фишки сбросивших' : 'неуравненная ставка возвращается'
          });
          return;
        }
        let bestSc = null, winners = [];
        for (const p of pot.elig) {
          const c = bestSc ? P.cmp(p.best.score, bestSc) : 1;
          if (c > 0) { bestSc = p.best.score; winners = [p]; } else if (c === 0) winners.push(p);
        }
        winners.sort((a, b) => orderFromButton(a) - orderFromButton(b));
        const share = Math.floor(pot.amount / winners.length);
        let rem = pot.amount - share * winners.length;
        winners.forEach(w => { const amt = share + (rem-- > 0 ? 1 : 0); w.stack += amt; w.winAmount += amt; });
        const contested = pots.filter(x => x.elig.length > 1).length;
        results.push({
          name: contested === 1 ? 'Банк' : (k === 0 ? 'Основной банк' : `Побочный банк ${k}`),
          amount: pot.amount, winners: winners.map(w => this.seats.indexOf(w)),
          names: winners.map(w => w.name), hand: winners[0].best.desc, cat: winners[0].best.cat
        });
      });
      h.results = results;
      // озвучка
      const fmt = n => n.toLocaleString('ru-RU');
      const multi = results.filter(r => !r.refund).length > 1;
      let voiced = false;
      for (const r of results) {
        const v = voiced || r.refund ? null : (r.names.length === 1 ? [pick(['win_1', 'win_2', 'win_3']), 'combo_' + r.cat] : ['split', 'combo_' + r.cat]);
        if (v) voiced = true;
        if (r.refund) { this.pushChat({ from: 'Система', text: `${r.names[0]}: возврат ${fmt(r.amount)} — ставку никто не уравнял`, system: true }); continue; }
        if (r.names.length === 1) this.say(`${multi ? r.name + '. ' : ''}${pick(['Поздравляю', 'Браво', 'Прекрасно сыграно'])}, ${r.names[0]}. Ваши ${fmt(r.amount)}. ${r.hand}.`, 'major', v);
        else this.say(`${multi ? r.name + ': ' : ''}ничья! Банк ${fmt(r.amount)} делят ${r.names.join(' и ')}. ${r.hand}.`, 'major', v);
      }
      this.sfx('win', { seats: [...new Set(results.flatMap(r => r.winners))] });
      this.finishHand();
    }, 1600);
  }

  winUncontested(p) {
    const h = this.hand;
    clearTimeout(this.timer);
    h.toAct = -1;
    const pot = this.seats.reduce((s, q) => s + (q ? q.total : 0), 0) + (h.deadChips || 0);
    p.stack += pot; p.winAmount = pot;
    this.seats.forEach(q => { if (q) q.bet = 0; });
    const i = this.seats.indexOf(p);
    h.results = [{ name: 'Банк', amount: pot, winners: [i], names: [p.name], hand: 'Все соперники сбросили карты' }];
    this.say(pick([`${p.name} забирает банк. ${pot.toLocaleString('ru-RU')}.`, `Банк ваш, ${p.name}. ${pot.toLocaleString('ru-RU')}.`]), 'major', ['fold_win']);
    this.sfx('win', { seats: [i] });
    this.finishHand();
  }

  finishHand() {
    const h = this.hand;
    h.finished = true; h.busy = false; h.toAct = -1;
    clearTimeout(this.timer);
    // статистика и история
    const winners = this.seats.filter(p => p && p.winAmount > 0);
    for (const w of winners) {
      const st = statOf(w.pid);
      st.wins++; st.won += w.winAmount; st.biggest = Math.max(st.biggest, w.winAmount);
      if (w.best && (!st.best || P.cmp(w.best.score, st.best.score) > 0)) st.best = { score: w.best.score, desc: w.best.desc };
    }
    const entry = {
      no: this.handNo, time: Date.now(), board: h.board,
      results: h.results.map(r => ({ name: r.name, amount: r.amount, names: r.names, hand: r.hand, refund: !!r.refund })),
      shown: this.seats.filter(p => p && p.inHand && p.revealed && !p.folded).map(p => ({ name: p.name, cards: p.cards, desc: p.best ? p.best.desc : '' })),
      log: h.log
    };
    this.history.unshift(entry);
    if (this.history.length > 60) this.history.pop();
    for (const c of this.conns()) send(c, 'history', entry);
    const touched = new Set();
    for (const p of this.seats) if (p && p.inHand) {
      const st = statOf(p.pid);
      const net = p.winAmount + (p.refund || 0) - p.total;
      st.net = (st.net || 0) + net;
      st.games.unshift({
        room: this.name, roomId: this.id, no: this.handNo, time: Date.now(), net, win: net > 0,
        cards: p.cards, board: h.board, desc: p.folded ? 'Фолд' : (p.best ? p.best.desc : (p.winAmount > 0 ? 'Все сбросили' : '')),
        pot: h.results.reduce((a, r) => a + r.amount, 0), players: this.seats.filter(q => q && q.inHand).map(q => q.name)
      });
      if (st.games.length > 150) st.games.length = 150;
      touched.add(p.pid);
    }
    pushBackups(touched);
    if (this.mode === 'cash') this.seats.forEach(p => { if (p) Wallet.inPlay(p.pid, this.id, p.stack); });
    this.broadcast();
    const id = h.id;
    clearTimeout(this.nextTimer);
    this.nextTimer = setTimeout(() => {
      this.nextTimer = null;
      if (!this.hand || this.hand.id !== id || this.paused) return;
      this.afterHand();
    }, 6500);
  }

  afterHand() {
    // выбывшие
    const busted = this.seats.filter(p => p && p.inHand && p.stack === 0);
    if (this.mode === 'tournament') {
      const remaining = this.seats.filter(p => p && p.stack > 0).length;
      busted.forEach((p, k) => {
        const place = remaining + busted.length - k;
        this.places.unshift({ name: p.name, place });
        this.say(`${p.name} выбывает из турнира. ${place}-е место.`, 'major', ['bust']);
        this.release(this.seatOf(p.pid));
      });
      if (remaining <= 1 && this.started) {
        const champ = this.seats.find(p => p && p.stack > 0);
        if (champ) {
          this.places.unshift({ name: champ.name, place: 1 });
          this.say(`Турнир окончен! Победитель — ${champ.name}! Поздравляем!`, 'major', ['tour_end']);
          this.sfx('champion');
          Wallet.credit(champ.pid, champ.stack);
          for (const c of clients) if (c.user && c.user.pid === champ.pid) send(c, 'toast', { text: `🏆 Приз ${champ.stack.toLocaleString('ru-RU')} фишек зачислен на баланс!` });
        }
        this.seats.forEach(p => { if (p) { p.stack = 0; p.paid = false; Wallet.inPlay(p.pid, this.id, 0); } });
        this.started = false;
        this.hand = null;
        this.broadcast(); broadcastLobby();
        return;
      }
    } else {
      busted.forEach(p => this.pushChat({ from: 'Система', text: `${p.name}: фишки закончились — нажмите «Докупиться»`, system: true }));
    }
    this.hand = null;
    this.seats.forEach(p => { if (p) { p.inHand = false; p.cards = []; p.lastAction = p.sitOut ? 'Пропуск' : ''; p.winAmount = 0; p.bet = 0; p.total = 0; p.revealed = false; p.best = null; } });
    this.broadcast(); broadcastLobby();
    this.startHand();
  }

  rebuy(pid) {
    const p = this.seats[this.seatOf(pid)];
    if (!p) return 'Вы не за столом';
    if (this.mode === 'tournament') return 'В турнире докупка невозможна';
    if (p.inHand && this.hand && !this.hand.finished) return 'Докупиться можно между раздачами';
    if (p.stack >= this.startStack) return 'Ваш стек не меньше стартового';
    const need = Math.min(this.startStack - p.stack, Wallet.bal(pid));
    if (need <= 0) return 'На балансе нет фишек. Заберите бонус в кабинете.';
    Wallet.charge(pid, need);
    p.stack += need; p.rebuys++;
    Wallet.inPlay(pid, this.id, p.stack);
    this.say(`${p.name} докупает фишки до ${p.stack.toLocaleString('ru-RU')}.`, 'info', ['rebuy']);
    this.broadcast();
    this.maybeStart();
    return null;
  }

  startTournament(pid) {
    const hostHere = this.seats.some(p => p && p.pid === this.hostPid && p.connected);
    if (pid !== this.hostPid && hostHere) return 'Начать турнир может только создатель комнаты';
    if (this.seatOf(pid) < 0 && pid !== this.hostPid) return 'Сначала сядьте за стол';
    if (this.mode !== 'tournament') return 'Это не турнирная комната';
    if (this.started) return 'Турнир уже идёт';
    this.seats.forEach((p, i) => {
      if (!p || p.paid) return;
      if (Wallet.charge(p.pid, this.startStack)) { p.paid = true; Wallet.inPlay(p.pid, this.id, this.startStack); }
      else { this.say(`${p.name}: недостаточно фишек для участия.`, 'info'); this.seats[i] = null; }
    });
    const n = this.seats.filter(Boolean).length;
    if (n < 2) return 'Нужно минимум 2 игрока';
    this.started = true; this.places = []; this.level = 0; this.levelStart = Date.now(); this.levelHand = this.handNo;
    this.sb = this.baseSb; this.bb = this.baseBb; this.ante = this.baseAnte;
    this.seats.forEach(p => { if (p) { p.stack = this.startStack; p.sitOut = false; } });
    this.say(`Турнир начинается! Игроков: ${n}. Блайнды ${this.sb} и ${this.bb}, повышение ${this.levelMode === 'hands' ? `каждые ${this.levelEvery} раздач` : `каждые ${this.levelEvery} минут`}. Удачи!`, 'major', ['tour_start']);
    this.broadcast(); broadcastLobby();
    this.nextTimer = setTimeout(() => { this.nextTimer = null; this.startHand(); }, 3000);
    return null;
  }
}

// ───────────────────────── Обработка сообщений ─────────────────────────
function newRoomId() {
  let id;
  do { id = String(1000 + crypto.randomInt(9000)); } while (rooms.has(id));
  return id;
}

function joinRoom(c, room) {
  if (c.roomId && c.roomId !== room.id) leaveRoom(c);
  c.roomId = room.id;
  room.emptySince = 0;
  const i = room.seatOf(c.user.pid);
  if (i >= 0) {
    const p = room.seats[i];
    p.connected = true; p.ip = c.user.ip; p.name = c.user.name; p.avatar = c.user.avatar;
  }
  send(c, 'joined', { roomId: room.id, chat: room.chat.slice(-60), history: room.history.slice(0, 30) });
  room.broadcast();
  broadcastLobby();
}
function leaveRoom(c) {
  const room = rooms.get(c.roomId);
  c.roomId = null;
  if (!room) return;
  room.stand(c.user.pid);
  if (!room.conns().length) room.emptySince = Date.now();
  broadcastLobby();
}

const handlers = {
  hello(c, d) {
    const avatar = clean(d.avatar, 8) || '🦊';
    let key = '', pr = null;
    if (d.tg) {
      const u = TG.verify(String(d.tg));
      if (!u || !u.id) return send(c, 'authError', { text: 'Не удалось войти через Telegram. Откройте игру из бота заново.' });
      key = 'tg' + u.id;
      pr = profiles.get(key) || restoreFromBackup(d.backup, key);
      if (!pr) {
        const nm = clean(((u.first_name || '') + (u.last_name ? ' ' + u.last_name[0] + '.' : '')).trim() || u.username || 'Игрок', 18);
        pr = { name: nm, avatar, salt: '', pinHash: 'tg' + u.id, tg: true, created: Date.now(), stats: blankStats() };
        profiles.set(key, pr); saveProfiles();
      }
    } else if (d.token) {
      const [kb] = String(d.token).split('.');
      try { key = Buffer.from(kb, 'base64url').toString('utf8'); } catch (e) { }
      pr = profiles.get(key) || restoreFromBackup(d.backup, key);
      if (!pr || d.token !== tokenFor(key, pr)) return send(c, 'authError', { text: 'Войдите заново', reset: true });
    } else if (d.phone) {
      let ph = String(d.phone).replace(/\D/g, '');
      if (ph.length === 9) ph = '998' + ph;
      const pw = String(d.password || '');
      if (ph.length < 9 || ph.length > 15) return send(c, 'authError', { text: 'Введите правильный номер телефона' });
      if (pw.length < 4) return send(c, 'authError', { text: 'Пароль — минимум 4 символа' });
      key = 'p' + ph;
      pr = profiles.get(key) || restoreFromBackup(d.backup, key);
      if (d.register) {
        if (pr) return send(c, 'authError', { text: 'Этот номер уже зарегистрирован — войдите' });
        const name = clean(d.name, 18);
        if (name.length < 2) return send(c, 'authError', { text: 'Введите имя (минимум 2 буквы)' });
        const salt = crypto.randomBytes(8).toString('hex');
        pr = { name, phone: '+' + ph, avatar, salt, pinHash: hashPin(pw, salt), created: Date.now(), balance: Wallet.START, stats: blankStats() };
        profiles.set(key, pr); saveProfiles();
      } else {
        if (!pr) return send(c, 'authError', { text: 'Номер не найден — зарегистрируйтесь' });
        if (hashPin(pw, pr.salt) !== pr.pinHash) return send(c, 'authError', { text: 'Неверный пароль' });
      }
    } else return send(c, 'authError', { text: 'Введите номер телефона и пароль' });
    if (pr.balance == null) pr.balance = Wallet.START;
    let newRc = false;
    if (!pr.tg && !pr.rc) { pr.rc = genCode(); newRc = true; saveProfiles(); }
    if (d.avatar && d.avatar !== pr.avatar && !d.token) { pr.avatar = avatar; saveProfiles(); }
    c.user = { pid: 'u:' + key, key, name: pr.name, avatar: pr.avatar || avatar, ip: c.ip };
    send(c, 'welcome', {
      ip: c.ip, pid: c.user.pid, name: pr.name, avatar: c.user.avatar, phone: pr.phone || '', wallet: Wallet.info(pr), token: tokenFor(key, pr), backup: backupOf(key),
      rc: pr.rc || '', newRc,
      stats: statOf(c.user.pid), lan: lanIPs(), port: PORT, publicUrl: Tunnel.url, sign: Sign.page, bot: TG.me ? TG.me.username : '', leaders: leaderboard()
    });
    broadcastLobby();
    // вернуть за стол, где игрок сидел, или к столу, который он смотрел
    for (const r of rooms.values()) if (r.seatOf(c.user.pid) >= 0) {
      send(c, 'toast', { text: `Возвращаем вас за стол «${r.name}»` });
      return joinRoom(c, r);
    }
    const watch = rooms.get(String(d.roomId || ''));
    if (watch && (!watch.password || watch.hostPid === c.user.pid)) joinRoom(c, watch);
    else if (d.roomId) send(c, 'left', {});
  },
  // восстановление пароля по коду (без входа)
  resetPw(c, d) {
    let ph = String(d.phone || '').replace(/\D/g, ''); if (ph.length === 9) ph = '998' + ph;
    const key = 'p' + ph, tk = c.ip + '|' + key, now = Date.now();
    const t = (resetTries.get(tk) || []).filter(x => now - x < 15 * 60000);
    if (t.length >= 6) return send(c, 'resetResult', { ok: false, text: 'Слишком много попыток. Подождите 15 минут.' });
    t.push(now); resetTries.set(tk, t);
    const pw = String(d.password || '');
    if (pw.length < 4) return send(c, 'resetResult', { ok: false, text: 'Новый пароль — минимум 4 символа' });
    const pr = profiles.get(key) || restoreFromBackup(d.backup, key);
    if (!pr) return send(c, 'resetResult', { ok: false, text: 'Номер не найден' });
    if (!pr.rc || normCode(d.code) !== normCode(pr.rc)) return send(c, 'resetResult', { ok: false, text: 'Неверный код восстановления' });
    pr.salt = crypto.randomBytes(8).toString('hex'); pr.pinHash = hashPin(pw, pr.salt); pr.rc = genCode();   // старый код больше не работает
    saveProfiles(); resetTries.delete(tk);
    send(c, 'resetResult', { ok: true, text: 'Пароль изменён — входим…' });
  },
  profile(c, d) {
    c.user.avatar = clean(d.avatar, 8) || c.user.avatar;
    const pr = profiles.get(c.user.key);
    if (pr) {
      pr.avatar = c.user.avatar;
      const nn = clean(d.name, 18); if (nn.length >= 2) { pr.name = nn; c.user.name = nn; }
      if (d.newPin && String(d.newPin).length >= 4) { pr.salt = crypto.randomBytes(8).toString('hex'); pr.pinHash = hashPin(String(d.newPin), pr.salt); send(c, 'welcome2', { token: tokenFor(c.user.key, pr) }); send(c, 'toast', { text: 'Пароль изменён' }); }
      saveProfiles(); send(c, 'backup', { backup: backupOf(c.user.key) });
    }
    const r = rooms.get(c.roomId);
    if (r) { const i = r.seatOf(c.user.pid); if (i >= 0) { r.seats[i].name = c.user.name; r.seats[i].avatar = c.user.avatar; } r.broadcast(); }
    broadcastLobby();
  },
  bonus(c) {
    const pr = profiles.get(c.user.key); if (!pr) return;
    const left = (pr.lastBonus || 0) + Wallet.BONUS_EVERY - Date.now();
    if (left > 0) return send(c, 'error', { text: `Бонус будет доступен через ${Math.ceil(left / 60000)} мин` });
    pr.lastBonus = Date.now(); Wallet.credit(c.user.pid, Wallet.BONUS);
    send(c, 'toast', { text: `🎁 +${Wallet.BONUS.toLocaleString('ru-RU')} фишек на баланс!` });
  },
  stats(c) { send(c, 'stats', statOf(c.user.pid)); send(c, 'leaders', leaderboard()); },
  createRoom(c, d) {
    const bb = Math.max(2, Math.floor(+d.bb || 1000));
    const sb = Math.max(1, Math.min(bb, Math.floor(+d.sb || bb / 2)));
    const room = new Room({
      id: newRoomId(), name: clean(d.name, 28) || `Стол ${c.user.name}`, password: clean(d.password, 24),
      mode: d.mode, sb, bb, ante: Math.max(0, Math.floor(+d.ante || 0)),
      startStack: Math.max(bb * 10, Math.floor(+d.startStack || bb * 50)),
      maxSeats: +d.maxSeats || 6, turnTime: +d.turnTime || 30, oneIp: d.oneIp !== false,
      levelMode: d.levelMode, levelEvery: d.levelEvery, hostPid: c.user.pid
    });
    rooms.set(room.id, room);
    joinRoom(c, room);
    room.pushChat({ from: 'Система', text: `Комната создана. Номер стола: ${room.id}${room.password ? ' (приватная, нужен пароль)' : ''}`, system: true });
  },
  joinRoom(c, d) {
    const room = rooms.get(String(d.id || '').trim());
    if (!room) return send(c, 'error', { text: 'Стол с таким номером не найден' });
    if (room.password && room.password !== String(d.password || '') && room.seatOf(c.user.pid) < 0 && room.hostPid !== c.user.pid)
      return send(c, 'needPassword', { id: room.id, name: room.name, wrong: !!d.password });
    joinRoom(c, room);
  },
  quick(c) {
    let room = [...rooms.values()].find(r => !r.password && r.mode === 'cash' && r.seats.some(s => !s) && !(r.oneIp && r.seats.some(p => p && p.ip === c.user.ip)));
    if (!room) return handlers.createRoom(c, { name: 'Быстрая игра', sb: 500, bb: 1000, ante: 100, startStack: 50000, mode: 'cash', oneIp: true, levelMode: 'hands', levelEvery: 10 });
    joinRoom(c, room);
    const free = room.seats.findIndex(s => !s);
    if (free >= 0 && room.seatOf(c.user.pid) < 0) send(c, 'askBuyIn', { seat: free });
  },
  leaveRoom(c) { leaveRoom(c); send(c, 'left', {}); },
  sit(c, d) { const r = rooms.get(c.roomId); if (!r) return; const e = r.sit(c, +d.seat, +d.amount || 0); if (e) send(c, 'error', { text: e }); },
  stand(c) { const r = rooms.get(c.roomId); if (r) r.stand(c.user.pid); },
  action(c, d) {
    const r = rooms.get(c.roomId); if (!r) return;
    const e = r.act(c.user.pid, String(d.type), +d.amount);
    if (e) send(c, 'error', { text: e });
  },
  rebuy(c) { const r = rooms.get(c.roomId); if (!r) return; const e = r.rebuy(c.user.pid); if (e) send(c, 'error', { text: e }); },
  sitout(c, d) {
    const r = rooms.get(c.roomId); if (!r) return;
    const p = r.seats[r.seatOf(c.user.pid)]; if (!p) return;
    p.sitOut = !!d.on;
    if (!p.inHand) p.lastAction = p.sitOut ? 'Пропуск' : '';
    r.broadcast(); if (!p.sitOut) r.maybeStart();
  },
  pause(c, d) { const r = rooms.get(c.roomId); if (!r) return; const e = r.setPause(c.user.pid, !!d.on); if (e) send(c, 'error', { text: e }); },
  startTournament(c) { const r = rooms.get(c.roomId); if (!r) return; const e = r.startTournament(c.user.pid); if (e) send(c, 'error', { text: e }); },
  chat(c, d) {
    const r = rooms.get(c.roomId); if (!r) return;
    const text = clean(d.text, 200); if (!text) return;
    const now = Date.now();
    if (c.lastChat && now - c.lastChat < 400) return;
    c.lastChat = now;
    r.pushChat({ from: c.user.name, avatar: c.user.avatar, text });
  },
  emote(c, d) {
    const r = rooms.get(c.roomId); if (!r) return;
    const i = r.seatOf(c.user.pid); if (i < 0) return;
    for (const x of r.conns()) send(x, 'emote', { seat: i, e: clean(d.e, 4) });
  }
};

WS.attach(server, (c, req) => {
  c.ip = ipOf(req);
  clients.add(c);
  c.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t !== 'hello' && m.t !== 'resetPw' && !c.user) return;
    const fn = handlers[m.t];
    if (fn) try { fn(c, m.d || {}); } catch (e) { console.error('Ошибка обработки', m.t, e); }
  });
  c.on('close', () => {
    clients.delete(c);
    if (c.user && c.roomId) {
      const r = rooms.get(c.roomId);
      const stillHere = [...clients].some(x => x.user && x.user.pid === c.user.pid && x.roomId === c.roomId);
      if (r && !stillHere) {
        const i = r.seatOf(c.user.pid);
        if (i >= 0) {
          const p = r.seats[i];
          p.connected = false; p.discAt = Date.now();
          if (r.hand && r.hand.toAct === i && !r.hand.busy) r.setTurn(i); // ускорить авто-ход
          else r.broadcast();
          if (!r.hand || r.hand.finished || !p.inHand) {
            // освобождаем место, если не вернулся за 3 минуты
            setTimeout(() => {
              const j = r.seatOf(c.user.pid);
              if (j >= 0 && !r.seats[j].connected && (!r.hand || r.hand.finished || !r.seats[j].inHand)) r.stand(c.user.pid);
            }, 180000);
          }
        }
        if (!r.conns().length) r.emptySince = Date.now();
      }
    }
    broadcastLobby();
  });
});

// стол исчезает, когда все ушли: никого нет за столом и никто не смотрит (20 сек — на случай перезагрузки страницы)
setInterval(() => {
  let changed = false;
  for (const [id, r] of rooms) {
    const empty = !r.conns().length && !r.seats.some(Boolean);
    if (!empty) { r.emptySince = 0; continue; }
    if (!r.emptySince) r.emptySince = Date.now();
    if (Date.now() - r.emptySince > 20000) { clearTimeout(r.timer); clearTimeout(r.turnTimer); rooms.delete(id); changed = true; }
  }
  if (changed) broadcastLobby();
}, 5000).unref();

// ───────────────────────── Публичная ссылка (туннель Cloudflare) ─────────────────────────
// Даёт адрес https://xxxx.trycloudflare.com, по которому можно зайти из любого места и с телефона.
// Отключить: NO_TUNNEL=1 node server.js   (на хостинге вроде Render туннель не нужен и не запускается)
const Tunnel = {
  url: '', proc: null, tries: 0,
  bin() {
    const map = { win32: 'cloudflared-windows-amd64.exe', linux: process.arch === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64', darwin: process.arch === 'arm64' ? 'cloudflared-darwin-arm64.tgz' : 'cloudflared-darwin-amd64.tgz' };
    return map[process.platform];
  },
  local() { return path.join(__dirname, 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'); },
  async download() {
    const asset = this.bin();
    if (!asset || asset.endsWith('.tgz')) throw new Error('для этой системы установите cloudflared вручную');
    const dest = this.local();
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    console.log('  Скачиваю туннель Cloudflare (один раз, ~25 МБ)…');
    const r = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`, { redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    fs.writeFileSync(dest + '.part', Buffer.from(await r.arrayBuffer()));
    fs.renameSync(dest + '.part', dest);
    if (process.platform !== 'win32') fs.chmodSync(dest, 0o755);
  },
  async start() {
    if (process.env.NO_TUNNEL || process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.FLY_APP_NAME) return;
    try {
      if (!fs.existsSync(this.local())) await this.download();
    } catch (e) { console.log('  ⚠ Не удалось скачать туннель: ' + e.message + '. Играть можно только в локальной сети.'); return; }
    const { spawn, spawnSync } = require('child_process');
    // убрать «осиротевший» туннель от прошлого запуска
    if (process.platform === 'win32' && !this.cleaned) {
      this.cleaned = true;
      try { spawnSync('powershell', ['-NoProfile', '-Command', `Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | ? { $_.ExecutablePath -like '*pokercircle*' } | % { Stop-Process -Id $_.ProcessId -Force }`], { windowsHide: true, timeout: 15000 }); } catch (e) { }
    }
    const p = this.proc = spawn(this.local(), ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`], { windowsHide: true });
    const onData = d => {
      const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && m[0] !== this.url) { this.url = m[0]; this.tries = 0; this.fails = 0; this.announce(); }
    };
    p.stdout.on('data', onData); p.stderr.on('data', onData);
    p.on('error', () => { });
    p.on('exit', () => {
      if (this.proc === p) this.proc = null;
      this.url = '';
      setTimeout(() => { if (!this.proc) this.start(); }, Math.min(60000, 5000 * (1 + this.tries++)));
    });
  },
  // Сторож: раз в минуту проверяем, открывается ли ссылка из интернета. Если нет 3 раза подряд — берём новую.
  fails: 0,
  async check() {
    if (!this.url || !this.proc) return;
    try {
      const r = await fetch(this.url + '/api/info', { signal: AbortSignal.timeout(12000), headers: { 'cache-control': 'no-cache' } });
      if (r.ok) { this.fails = 0; return; }
    } catch (e) { }
    if (++this.fails >= 3) {
      console.log('  ⚠ Ссылка перестала открываться (сменилась сеть или ноутбук спал). Получаю новую…');
      this.fails = 0; this.restart();
    }
  },
  restart() {
    this.url = '';
    const p = this.proc; this.proc = null;
    if (p) { try { p.kill(); } catch (e) { } }
    setTimeout(() => { if (!this.proc) this.start(); }, 2000);
  },
  announce() {
    const line = '═'.repeat(64);
    console.log(`\n  ${line}\n   🌍 ССЫЛКА НА ИГРУ:  ${this.url}\n${Sign.page ? `   ⭐ ПОСТОЯННАЯ СТРАНИЦА ДЛЯ ДРУЗЕЙ:  ${Sign.page}\n` : ''}${TG.me ? `   🤖 TELEGRAM:  https://t.me/${TG.me.username}\n` : ''}  ${line}\n`);
    try { fs.writeFileSync(path.join(__dirname, 'ССЫЛКА ДЛЯ ДРУЗЕЙ.txt'), `${TG.me ? `ССЫЛКА ДЛЯ ДРУЗЕЙ (Telegram, постоянная):\r\nhttps://t.me/${TG.me.username}\r\n\r\n` : ''}${Sign.page ? `ПОСТОЯННАЯ ССЫЛКА ДЛЯ ДРУЗЕЙ (без Telegram):\r\n${Sign.page}\r\n\r\n` : ''}Текущий адрес игры (меняется сам, друзьям не отправлять):\r\n${this.url}\r\n`); } catch (e) { }
    for (const c of clients) if (c.user) send(c, 'publicUrl', { url: this.url, sign: Sign.page });
    TG.update(this.url);
    if (this.url !== Sign.last) Sign.publish(this.url);
  }
};
// Не даём Windows уснуть, пока работает сервер (как видеоплеер; экран гаснуть может)
let awake = null;
if (process.platform === 'win32' && !process.env.NO_KEEPAWAKE) {
  try {
    const ps = `$s=Add-Type -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);' -Name A -Namespace W -PassThru; $s::SetThreadExecutionState(2147483649) | Out-Null; while(Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue){ Start-Sleep 30 }`;
    awake = require('child_process').spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { windowsHide: true, stdio: 'ignore' });
    awake.on('error', () => { });
  } catch (e) { }
}
process.on('uncaughtException', e => console.error('Ошибка (сервер продолжает работать):', e && e.message));
// ───────────────────────── Telegram-бот (мини-приложение) ─────────────────────────
// Токен бота кладётся в data/telegram.json: {"token":"123:ABC"} или в переменную TG_TOKEN.
const TG_FILE = path.join(DATA_DIR, 'telegram.json');
const TG = {
  token: process.env.TG_TOKEN || (() => { try { return JSON.parse(fs.readFileSync(TG_FILE, 'utf8')).token || ''; } catch (e) { return ''; } })(),
  me: null, url: '', offset: 0,
  async api(method, body) {
    const r = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, { method: 'POST', signal: AbortSignal.timeout(65000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    return r.json();
  },
  async init() {
    if (!this.token) return;
    try {
      const r = await this.api('getMe');
      if (!r.ok) { console.log('  ⚠ Telegram-бот: неверный токен'); return; }
      this.me = r.result;
      console.log(`  🤖 Telegram-бот: https://t.me/${this.me.username}`);
      await this.api('setMyCommands', { commands: [{ command: 'start', description: 'Играть в покер' }] });
      await this.api('setMyShortDescription', { short_description: 'Техасский холдем с друзьями. Дилер Алиса, живой стол, турниры.' });
      await this.api('setMyDescription', { description: '♠ Покер с друзьями — техасский холдем.\n\nНажмите «Играть», создайте стол и позовите друзей. Дилер Алиса раздаёт карты и всё объявляет голосом.' });
      if (Tunnel.url) this.update(Tunnel.url);
      this.poll();
      if (Tunnel.url) Sign.publish(Tunnel.url, true);
    } catch (e) { console.log('  ⚠ Telegram-бот недоступен: ' + e.message); setTimeout(() => this.init(), 60000); }
  },
  async update(url) {
    this.url = url;
    if (!this.me) return;
    try { await this.api('setChatMenuButton', { menu_button: { type: 'web_app', text: '🃏 Играть', web_app: { url } } }); } catch (e) { }
  },
  async poll() {
    for (;;) {
      try {
        const r = await this.api('getUpdates', { offset: this.offset, timeout: 50, allowed_updates: ['message'] });
        if (!r.ok) { await new Promise(res => setTimeout(res, 5000)); continue; }
        for (const u of r.result) {
          this.offset = u.update_id + 1;
          const m = u.message;
          if (!m || !m.chat) continue;
          const name = (m.from && m.from.first_name) || 'друг';
          if (!this.url) { await this.api('sendMessage', { chat_id: m.chat.id, text: 'Игра сейчас перезапускается — попробуйте через минуту 🙏' }); continue; }
          await this.api('sendMessage', {
            chat_id: m.chat.id, parse_mode: 'HTML',
            text: `♠ <b>Покер с друзьями</b>\n\n${name}, добро пожаловать за стол! Нажмите кнопку ниже — создайте стол или присоединитесь к друзьям.\n\nДилер Алиса уже раздаёт карты 🃏`,
            reply_markup: { inline_keyboard: [[{ text: '🃏 Играть в покер', web_app: { url: this.url } }], [{ text: '📤 Позвать друга', url: `https://t.me/share/url?url=${encodeURIComponent('https://t.me/' + this.me.username)}&text=${encodeURIComponent('Го в покер! ♠')}` }]] }
          });
        }
      } catch (e) { await new Promise(res => setTimeout(res, 5000)); }
    }
  },
  // проверка подписи Telegram WebApp (initData) — вход без PIN
  verify(initData) {
    if (!this.token || !initData) return null;
    const p = new URLSearchParams(initData);
    const hash = p.get('hash'); p.delete('hash');
    const dcs = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(this.token).digest();
    const calc = crypto.createHmac('sha256', secret).update(dcs).digest('hex');
    if (!hash || calc !== hash) return null;
    if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 7 * 86400) return null;
    try { return JSON.parse(p.get('user')); } catch (e) { return null; }
  }
};

// ───────────────────────── Постоянная страница-указатель ─────────────────────────
// Адрес туннеля меняется, поэтому публикуем актуальную ссылку на страницу с постоянным адресом.
// Основной вариант — telegra.ph (без рекламы и регистрации), запасной — ntfy.sh.
const SIGN_FILE = path.join(DATA_DIR, 'signpost.json');
const Sign = {
  cfg: (() => { try { return JSON.parse(fs.readFileSync(SIGN_FILE, 'utf8')); } catch (e) { return {}; } })(),
  page: '', last: '', lastAt: 0, busy: false,
  save() { try { fs.writeFileSync(SIGN_FILE, JSON.stringify(this.cfg)); } catch (e) { } },
  text(url) {
    const t = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
    return `# ♠ PokerCircle — покер с друзьями\n\n## [👉 НАЖМИТЕ, ЧТОБЫ ИГРАТЬ](${url})\n\n${url}\n\n---\nСохраните эту страницу в закладки: адрес игры может меняться, а здесь всегда актуальная ссылка.\n\nОбновлено: ${t}`;
  },
  // telegra.ph — чистая страница без рекламы, с постоянным адресом
  nodes(url) {
    const t = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' });
    const n = [
      { tag: 'h3', children: ['♠ Покер с друзьями'] },
      { tag: 'p', children: [{ tag: 'b', children: [{ tag: 'a', attrs: { href: url }, children: ['▶️  ИГРАТЬ'] }] }] }
    ];
    if (TG.me) n.push({ tag: 'p', children: ['Или в Telegram: ', { tag: 'a', attrs: { href: `https://t.me/${TG.me.username}` }, children: ['@' + TG.me.username] }] });
    n.push({ tag: 'p', children: [{ tag: 'i', children: [`Ссылка обновляется автоматически · ${t}`] }] });
    return JSON.stringify(n);
  },
  async telegraph(url) {
    const api = async (method, params) => {
      const r = await fetch('https://api.telegra.ph/' + method, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
      const j = await r.json();
      if (!j.ok) throw new Error('telegraph: ' + j.error);
      return j.result;
    };
    if (!this.cfg.tphToken) { const acc = await api('createAccount', { short_name: 'PokerCircle', author_name: 'PokerCircle' }); this.cfg.tphToken = acc.access_token; this.save(); }
    const fields = { access_token: this.cfg.tphToken, title: 'Покер с друзьями ♠', author_name: 'PokerCircle', content: this.nodes(url) };
    if (!this.cfg.tphPath) { const pg = await api('createPage', fields); this.cfg.tphPath = pg.path; this.save(); }
    else await api('editPage/' + this.cfg.tphPath, fields);
    return `https://telegra.ph/${this.cfg.tphPath}`;
  },
  async ntfy(url) {
    if (!this.cfg.ntfyTopic) { this.cfg.ntfyTopic = 'pokercircle-' + crypto.randomBytes(5).toString('hex'); this.save(); }
    const r = await fetch('https://ntfy.sh/' + this.cfg.ntfyTopic, { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Title: 'PokerCircle - ссылка на игру', Click: url, Tags: 'spades' }, body: `Игра здесь: ${url}` });
    if (!r.ok) throw new Error('ntfy: ' + r.status);
    return `https://ntfy.sh/${this.cfg.ntfyTopic}`;
  },
  async publish(url, force) {
    if (!url || this.busy) return;
    if (force) this.last = '';
    this.busy = true;
    let page = '';
    try { page = await this.telegraph(url); this.cfg.mode = 'telegraph'; }
    catch (e) {
      console.log('  (страница telegra.ph недоступна: ' + e.message + ', пробую ntfy)');
      try { page = await this.ntfy(url); this.cfg.mode = 'ntfy'; } catch (e2) { console.log('  ⚠ Постоянную страницу обновить не удалось: ' + e2.message); }
    }
    this.busy = false;
    if (page) {
      const first = page !== this.page;
      this.page = page; this.last = url; this.lastAt = Date.now(); this.save();
      if (first) { Tunnel.announce(); return; }
      for (const c of clients) if (c.user) send(c, 'publicUrl', { url: Tunnel.url, sign: page });
    }
  }
};
// показать постоянную страницу сразу, если она уже была создана раньше
if (Sign.cfg.tphPath && Sign.cfg.mode === 'telegraph') Sign.page = `https://telegra.ph/${Sign.cfg.tphPath}`;
else if (Sign.cfg.ntfyTopic && Sign.cfg.mode === 'ntfy') Sign.page = `https://ntfy.sh/${Sign.cfg.ntfyTopic}`;
setInterval(() => Tunnel.check(), 60000).unref();
// ntfy хранит сообщения 12 часов — переопубликовываем каждые 6 часов
setInterval(() => { if (Tunnel.url && Date.now() - Sign.lastAt > 6 * 3600000) Sign.publish(Tunnel.url); }, 600000).unref();
process.on('exit', () => { try { Tunnel.proc && Tunnel.proc.kill(); } catch (e) { } try { awake && awake.kill(); } catch (e) { } });
['SIGINT', 'SIGTERM'].forEach(sig => process.on(sig, () => process.exit(0)));

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.log(`\n  PokerCircle уже запущен (порт ${PORT} занят). Откройте http://localhost:${PORT}\n`); process.exit(3); }
  console.error(e); process.exit(1);
});
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  ♠ PokerCircle запущен!\n');
  console.log(`  На этом компьютере:   http://localhost:${PORT}`);
  for (const ip of lanIPs()) console.log(`  В вашей Wi-Fi сети:   http://${ip}:${PORT}`);
  console.log('\n  Получаю ссылку для игры через интернет…\n');
  Tunnel.start();
  TG.init();
});

module.exports = { Room };
