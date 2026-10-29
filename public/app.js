// PokerCircle — клиент
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fmt = n => (Math.round(n) || 0).toLocaleString('ru-RU');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const AVATARS = ['🦁', '🐯', '🦊', '🐼', '🐨', '🐸', '🐺', '🦅', '🐶', '🐱', '🐻', '🦄', '🐲', '🐵', '🐧', '🦉'];
  const AV_BG = ['#3b2a5a', '#1f4a5a', '#5a3a1f', '#22472d', '#4a1f3a', '#2b3a66', '#5a2a2a', '#365a4a'];
  const avBg = a => { const i = Math.max(0, AVATARS.indexOf(a)); return `radial-gradient(circle at 35% 30%, ${AV_BG[i % AV_BG.length]}, #0b0d15)`; };
  const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const RANK = r => (r <= 10 ? String(r) : { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r]);
  const sameCard = (a, b) => a && b && a.r === b.r && a.s === b.s;

  // ───────── Настройки ─────────
  const store = {
    get(k, d) { try { const v = localStorage.getItem('pc_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('pc_' + k, JSON.stringify(v)); } catch (e) { } }
  };
  const cfg = Object.assign({ voice: true, voiceName: '', volume: 1, rate: 0.9, pitch: 0.93, voiceStyle: 'velvet', allActions: true, sound: true, soundVol: .6, four: false, autoMuck: true, dealerMode: 'photo' }, store.get('cfg', {}));
  if (cfg.v !== 3) { cfg.v = 3; cfg.rate = 0.9; cfg.pitch = 0.93; cfg.voiceStyle = 'velvet'; cfg.voiceName = ''; store.set('cfg', cfg); }
  const saveCfg = () => { store.set('cfg', cfg); applyCfg(); };
  function applyCfg() {
    const V = window.DealerVoice;
    V.enabled = cfg.voice; V.voiceName = cfg.voiceName; V.volume = cfg.volume; V.rate = cfg.rate; V.pitch = cfg.pitch; V.style = cfg.voiceStyle; if (window.DealerPack) { DealerPack.use = cfg.studio !== false; DealerPack.select(cfg.alisaVoice || ''); } V.allActions = cfg.allActions;
    document.body.classList.toggle('four', cfg.four);
    $('#voiceToggle').classList.toggle('on', cfg.voice);
    $('#voiceLbl').textContent = cfg.voice ? 'Вкл.' : 'Выкл.';
    if (Dealer.mode !== cfg.dealerMode) { Dealer.setMode(cfg.dealerMode); $('#heroDealer').innerHTML = Dealer.markupFull(); }
  }

  // ───────── Состояние ─────────
  const S = {
    me: { pid: '', name: store.get('name', ''), avatar: store.get('avatar', AVATARS[2]) }, token: store.get('token', ''), backups: store.get('backups', {}), leaders: [],
    loggedIn: false, ip: '', lan: [], port: location.port || 80, rooms: [], online: [], roomId: null,
    st: null, prev: null, view: 'lobby', offset: 0, pre: null, raiseTo: 0, actKey: '',
    dealing: null, notes: [], unread: 0, autoJoin: new URLSearchParams(location.search).get('room')
  };

  // ───────── Звуки (синтез WebAudio) ─────────
  let AC = null;
  const ac = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); return AC; };
  function tone(freq, dur, type = 'sine', vol = .2, when = 0, slide) {
    const a = ac(); if (!a || !cfg.sound) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol * cfg.soundVol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, vol = .2, freq = 3000, when = 0) {
    const a = ac(); if (!a || !cfg.sound) return;
    const t = a.currentTime + when, n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
    g.gain.value = vol * cfg.soundVol; src.connect(f).connect(g).connect(a.destination); src.start(t);
  }
  const SFX = {
    card: () => noise(.07, .35, 4200),
    chip: () => { tone(2600, .05, 'triangle', .12); tone(3400, .04, 'triangle', .09, .035); tone(2900, .05, 'triangle', .08, .07); },
    chips: () => { for (let i = 0; i < 6; i++) tone(2400 + Math.random() * 1400, .045, 'triangle', .08, i * .035); },
    check: () => { tone(180, .08, 'sine', .35); tone(160, .08, 'sine', .3, .12); },
    fold: () => noise(.18, .2, 1800),
    turn: () => { tone(880, .18, 'sine', .18); tone(1318, .3, 'sine', .14, .12); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .35, 'triangle', .14, i * .11)),
    champion: () => [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, .4, 'triangle', .15, i * .14))
  };

  window.pcAudio = ac;
  if (window.DealerPack) { DealerPack.want = cfg.alisaVoice || ''; DealerPack.onLoad = () => { DealerPack.select(cfg.alisaVoice || ''); if (S.view === 'settings') renderSettings(); }; }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, () => { const a = ac(); if (a && a.state === 'suspended') a.resume(); }, { passive: true }));

  // ───────── Фон: ночной город ─────────
  function buildCity() {
    const wrap = $('#windows');
    for (let p = 0; p < 4; p++) {
      const pane = document.createElement('div'); pane.className = 'pane';
      let svg = `<svg class="city" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="sky${p}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1230"/><stop offset=".6" stop-color="#2a2350"/><stop offset="1" stop-color="#5a3a52"/></linearGradient></defs><rect width="400" height="300" fill="url(#sky${p})"/>`;
      for (let i = 0; i < 40; i++) svg += `<circle cx="${Math.random() * 400}" cy="${Math.random() * 120}" r="${Math.random() * .9 + .2}" fill="#fff" opacity="${Math.random() * .6 + .2}"/>`;
      const layers = [['#1a1838', 120, 90], ['#11112a', 170, 60], ['#0a0a1a', 220, 35]];
      layers.forEach(([col, base, h], li) => {
        let x = -10;
        while (x < 410) {
          const w = 18 + Math.random() * 34, bh = h + Math.random() * (li === 0 ? 150 : 110);
          const top = 300 - bh * (li === 2 ? .7 : 1) - (li === 2 ? 0 : 0);
          svg += `<rect x="${x}" y="${top}" width="${w}" height="${300 - top}" fill="${col}"/>`;
          if (Math.random() < .12 && li < 2) svg += `<rect x="${x + w / 2 - 1}" y="${top - 26}" width="2" height="26" fill="${col}"/><circle cx="${x + w / 2}" cy="${top - 27}" r="1.6" fill="#ff5a6a"/>`;
          for (let wy = top + 6; wy < 300; wy += 7) for (let wx = x + 3; wx < x + w - 3; wx += 5)
            if (Math.random() < (li === 2 ? .22 : .35)) svg += `<rect x="${wx}" y="${wy}" width="2.2" height="3" fill="${Math.random() < .8 ? '#ffd27a' : '#9fd4ff'}" opacity="${.35 + Math.random() * .6}"/>`;
          x += w + Math.random() * 6;
        }
      });
      if (p === 1) svg += `<rect x="250" y="70" width="5" height="230" fill="#14122c"/><ellipse cx="252.5" cy="120" rx="10" ry="5" fill="#14122c"/><rect x="251.5" y="30" width="2" height="45" fill="#14122c"/><rect x="250" y="90" width="5" height="50" fill="#ff7ab0" opacity=".55"/>`;
      svg += `<rect width="400" height="300" fill="url(#sky${p})" opacity=".12"/></svg>`;
      pane.innerHTML = svg;
      wrap.appendChild(pane);
    }
  }

  // ───────── Связь с сервером ─────────
  let ws = null, wsOpen = false, outbox = [];
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => {
      wsOpen = true;
      $('#loginIp').textContent = 'Сервер на связи ✓';
      if (S.loggedIn && S.token) helloToken();
      outbox.splice(0).forEach(m => ws.send(m));
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } on(m.t, m.d); };
    ws.onclose = () => {
      if (wsOpen) toast('Связь потеряна. Переподключение…', true);
      wsOpen = false;
      $('#loginIp').textContent = 'Нет связи с сервером. Повторяем…';
      setTimeout(connect, 1500);
    };
  }
  function helloToken() {
    const key = (S.token || '').split('.')[0];
    ws.send(JSON.stringify({ t: 'hello', d: { token: S.token, backup: S.backups[key] || '', avatar: S.me.avatar, roomId: S.roomId } }));
  }
  function send(t, d) {
    const m = JSON.stringify({ t, d: d || {} });
    if (wsOpen) ws.send(m); else outbox.push(m);
  }

  function on(t, d) {
    switch (t) {
      case 'welcome':
        S.me.pid = d.pid; S.me.name = d.name; S.me.avatar = d.avatar; store.set('name', d.name); store.set('avatar', d.avatar);
        S.token = d.token; store.set('token', d.token); saveBackup(d.backup); S.leaders = d.leaders || [];
        S.me.phone = d.phone || ''; S.me.rc = d.rc || ''; if (d.wallet) setWallet(d.wallet);
        if (d.newRc && d.rc) setTimeout(() => recoveryModal(d.rc), 900);
        if (!S.loggedIn || !$('#login').hidden) enterApp();
        updateUser(); if (S.view === 'profile') renderProfile();
        S.ip = d.ip; S.lan = d.lan; S.port = d.port; S.stats = d.stats; if (d.publicUrl) S.publicUrl = d.publicUrl; if (d.sign) S.sign = d.sign;
        renderLan();
        if (S.autoJoin) { send('joinRoom', { id: S.autoJoin }); S.autoJoin = null; history.replaceState(null, '', location.pathname); }
        break;
      case 'lobby': S.rooms = d.rooms; S.online = d.online; renderLobby(); renderOnline(); break;
      case 'joined':
        S.roomId = d.roomId;
        $('#chatList').innerHTML = ''; d.chat.forEach(addChat);
        $('#histList').innerHTML = ''; d.history.forEach(h => addHist(h, false));
        $('#navTable').hidden = false;
        go('table');
        break;
      case 'left': S.roomId = null; S.st = null; $('#navTable').hidden = true; $('#infoPanel').hidden = true; go('lobby'); break;
      case 'state': onState(d); break;
      case 'chat': addChat(d); if (!d.dealer && !d.system && !$('#rightcol').classList.contains('open')) $('#chatDot').hidden = false; if (S.view !== 'table' && !d.dealer && !d.system) note(`💬 ${d.from}: ${d.text}`); break;
      case 'dealer': Dealer.say(d.text, d.kind, d.voice); break;
      case 'sfx': onSfx(d); break;
      case 'deal': onDeal(d); break;
      case 'history': addHist(d, true); break;
      case 'error': toast(d.text, true); break;
      case 'toast': toast(d.text); break;
      case 'needPassword': passwordModal(d); break;
      case 'resetResult': onResetResult(d); break;
      case 'askBuyIn': setTimeout(() => buyInModal(d.seat), 400); break;
      case 'publicUrl': { const changed = d.url && d.url !== S.publicUrl; S.publicUrl = d.url; if (d.sign) S.sign = d.sign; renderLan(); if (changed) toast('🌍 Ссылка для друзей готова!'); break; }
      case 'authError':
        $('#loginErr').hidden = false; $('#loginErr').textContent = d.text; $('#loginBtn').disabled = false;
        if (/зарегистрируйтесь/.test(d.text) && S.setAuthMode) { S.setAuthMode('reg'); $('#loginErr').hidden = false; $('#loginErr').textContent = 'Такого номера ещё нет — придумайте имя и нажмите «Зарегистрироваться»'; }
        if (/уже зарегистрирован/.test(d.text) && S.setAuthMode) { S.setAuthMode('login'); $('#loginErr').hidden = false; $('#loginErr').textContent = d.text; }
        if (d.reset) { S.token = ''; store.set('token', ''); }
        S.loggedIn = false; $('#app').hidden = true; $('#login').hidden = false;
        break;
      case 'backup': saveBackup(d.backup); break;
      case 'wallet': setWallet(d); break;
      case 'welcome2': S.token = d.token; store.set('token', d.token); break;
      case 'leaders': S.leaders = d; if (S.view === 'profile') renderProfile(); break;
      case 'stats': S.stats = d; if (S.view === 'profile') renderProfile(); break;
      case 'emote': showEmote(d.seat, d.e); break;
    }
  }

  // ───────── Тосты и уведомления ─────────
  function toast(text, err) {
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = text;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3800);
  }
  function note(text) {
    S.notes.unshift({ text, time: Date.now() }); S.notes = S.notes.slice(0, 30);
    S.unread++; $('#bellN').hidden = false; $('#bellN').textContent = S.unread;
  }

  // ───────── Вход ─────────
  function saveBackup(bk) {
    if (!bk || !S.token) return;
    const key = S.token.split('.')[0];
    S.backups[key] = bk; store.set('backups', S.backups);
  }
  function initLogin() {
    const pick = $('#avatarPick');
    pick.innerHTML = AVATARS.map(a => `<button class="av-opt${a === S.me.avatar ? ' sel' : ''}" data-a="${a}" style="background:${avBg(a)}">${a}</button>`).join('');
    pick.onclick = e => { const b = e.target.closest('.av-opt'); if (!b) return; $$('.av-opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); S.me.avatar = b.dataset.a; };
    let mode = 'login';
    const setMode = m => {
      mode = m;
      $$('#authTabs button').forEach(b => b.classList.toggle('on', b.dataset.auth === m));
      $$('.reg-only').forEach(x => (x.hidden = m !== 'reg'));
      $$('.login-only').forEach(x => (x.hidden = m === 'reg'));
      $('#loginBtn').textContent = m === 'reg' ? 'Зарегистрироваться' : 'Войти';
      $('#loginPin').autocomplete = m === 'reg' ? 'new-password' : 'current-password';
      $('#loginErr').hidden = true;
    };
    $('#authTabs').onclick = e => { const b = e.target.closest('[data-auth]'); if (b) setMode(b.dataset.auth); };
    $('#loginPhone').value = store.get('phone', '998');
    const doLogin = () => {
      const phone = $('#loginPhone').value.replace(/\D/g, ''), pw = $('#loginPin').value, n = $('#loginName').value.trim();
      if (phone.length < 9) { $('#loginPhone').focus(); toast('Введите номер телефона', true); return; }
      if (pw.length < 4) { $('#loginPin').focus(); toast('Пароль — минимум 4 символа', true); return; }
      if (mode === 'reg' && n.length < 2) { $('#loginName').focus(); toast('Введите имя', true); return; }
      store.set('phone', phone);
      $('#loginErr').hidden = true; $('#loginBtn').disabled = true;
      S.loggedIn = true; ac();
      try { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch (e) { }
      const ph = phone.length === 9 ? '998' + phone : phone;
      const key = 'p' + ph;
      const bk = Object.entries(S.backups).find(([k]) => { try { return atob(k.replace(/-/g, '+').replace(/_/g, '/')) === key; } catch (e) { return false; } });
      send('hello', { phone, password: pw, register: mode === 'reg', name: n, avatar: S.me.avatar, backup: bk ? bk[1] : '', roomId: S.roomId });
    };
    $('#loginBtn').onclick = doLogin;
    $('#forgotBtn').onclick = () => forgotModal();
    S.doLogin = doLogin;
    ['#loginPhone', '#loginName', '#loginPin'].forEach(sel => ($(sel).onkeydown = e => { if (e.key === 'Enter') doLogin(); }));
    S.setAuthMode = setMode;
  }
  function setWallet(w) {
    S.wallet = Object.assign({ balance: 0, bonusIn: 0 }, w, { at: Date.now() });
    $('#walletBal').textContent = fmt(S.wallet.balance);
    if (S.view === 'profile') renderProfile();
  }
  function enterApp() {
    S.loggedIn = true; $('#loginBtn').disabled = false; $('#loginPin').value = ''; $('#loginErr').hidden = true;
    $('#login').hidden = true; $('#app').hidden = false;
    updateUser();
    go(S.roomId ? 'table' : 'lobby');
    if (!S.greeted) {
      S.greeted = true;
      setTimeout(() => DealerPack.preload(), 1500);
      setTimeout(() => Dealer.say(`Добро пожаловать, ${S.me.name}. Я Алиса, и сегодня карты раздаю я.`, 'major', ['hello']), 400);
      setTimeout(() => {
        DealerVoice.load();
        if (!cfg.voice || DealerPack.ready() || DealerVoice.isNatural() || store.get('voiceTip', 0) > 2) return;
        store.set('voiceTip', store.get('voiceTip', 0) + 1);
        const ua = navigator.userAgent;
        if (/iphone|ipad/i.test(ua)) toast('🎙️ Для красивого голоса Алисы: Настройки → Универсальный доступ → Устный контент → Голоса → Русский → «Милена (улучшенный)» — скачайте её');
        else if (/android/i.test(ua)) toast('🎙️ Для красивого голоса: Настройки → Синтез речи → Google, русский язык');
        else if (/windows/i.test(ua) && !/edg\//i.test(ua)) toast('🎙️ Откройте игру в Microsoft Edge — там у Алисы живой голос');
      }, 2500);
    }
  }
  function updateUser() {
    $('#userAva').textContent = S.me.avatar; $('#userAva').style.background = avBg(S.me.avatar);
    $('#userName').textContent = S.me.name; $('#heroName').textContent = S.me.name;
  }

  // ───────── Навигация ─────────
  function go(v) {
    if (v === 'rooms') { go('lobby'); setTimeout(() => $('#roomsAnchor').scrollIntoView({ behavior: 'smooth' }), 50); return; }
    if (v === 'table' && !S.roomId) v = 'lobby';
    S.view = v;
    document.body.classList.toggle('on-table', v === 'table');
    $$('.view').forEach(x => (x.hidden = x.id !== 'view-' + v));
    $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.go === v));
    $('#userMenu').hidden = true;
    if (v === 'table') { fitStage(); renderTable(); }
    if (v === 'profile') { send('stats'); renderProfile(); }
    if (v === 'settings') renderSettings();
    $('#infoPanel').hidden = !(S.roomId && S.st);
    markTab(v);
    $('#chatInputRow').style.display = S.roomId ? '' : 'none';
    const tab = S.roomId ? 'chat' : 'online';
    if (!$(`#rtabs [data-tab="${tab}"]`).classList.contains('active')) $(`#rtabs [data-tab="${tab}"]`).click();
  }

  function markTab(v) { $$('#tabbar [data-tab-go]').forEach(b => b.classList.toggle('active', b.dataset.tabGo === v)); }
  // ───────── Лобби ─────────
  function publicBase() {
    if (location.protocol === 'https:') return location.origin;             // уже открыто по публичной ссылке / с хостинга
    return S.publicUrl || '';
  }
  function qrHTML(url, size = 150) {
    return `<img class="qr" width="${size}" height="${size}" alt="QR-код" src="https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&margin=8&data=${encodeURIComponent(url)}">`;
  }
  function renderLan() {
    const pub = publicBase();
    const host = location.hostname;
    if (location.protocol === 'https:' && !/trycloudflare/.test(host)) {
      $('#lanLinks').innerHTML = `<div class="pub-link"><div style="flex:1;min-width:0"><div class="gold" style="font-weight:700;margin-bottom:4px">🌍 Ссылка на игру</div><div class="copyline"><code>${esc(location.origin)}</code><button class="btn btn-gold" style="height:34px;padding:0 12px" data-copy="${esc(location.origin)}">Копировать</button></div></div>${qrHTML(location.origin, 96)}</div>`;
      return;
    }
    const ips = (host === 'localhost' || host === '127.0.0.1') ? S.lan : (pub ? [] : [host]);
    let html = '';
    if (pub) html += `<div class="pub-link"><div style="flex:1;min-width:0"><div class="gold" style="font-weight:700;margin-bottom:4px">🌍 Ссылка для всех — из любого места и с телефона</div>
      <div class="copyline"><code>${esc(pub)}</code><button class="btn btn-gold" style="height:34px;padding:0 12px" data-copy="${esc(pub)}">Копировать</button></div>
      <div class="muted" style="font-size:12px;margin-top:6px">Любой, у кого есть ссылка, может зайти, создать свой стол и играть.</div></div>${qrHTML(pub, 96)}</div>`;
    if (S.sign) html += `<div class="pub-link" style="border-color:rgba(49,196,108,.5);background:rgba(49,196,108,.07)"><div style="flex:1;min-width:0"><div style="font-weight:700;margin-bottom:4px;color:#6fe39f">⭐ Постоянная страница — сохраните её друзьям один раз</div>
      <div class="copyline"><code>${esc(S.sign)}</code><button class="btn btn-gold" style="height:34px;padding:0 12px" data-copy="${esc(S.sign)}">Копировать</button></div>
      <div class="muted" style="font-size:12px;margin-top:6px">Адрес игры может меняться (если ноутбук перезапустился или сменил сеть), а на этой странице всегда свежая ссылка.</div></div>${qrHTML(S.sign, 96)}</div>`;
    if (!pub) html += `<div class="muted" style="font-size:12.5px;margin:6px 0">⏳ Получаем ссылку для игры через интернет… (нужен интернет на компьютере с сервером)</div>`;
    html += ips.map(ip => {
      const url = `http://${ip}${S.port && +S.port !== 80 ? ':' + S.port : ''}`;
      return `<div class="muted" style="font-size:12px;margin-top:8px">В той же Wi-Fi сети:</div><div class="copyline"><code>${url}</code><button class="btn btn-dark" style="height:34px;padding:0 10px" data-copy="${url}">Копировать</button></div>`;
    }).join('');
    $('#lanLinks').innerHTML = html + `<div class="muted" style="font-size:12px;margin-top:8px">Ваш IP: <b>${esc(S.ip)}</b></div>`;
  }
  function baseUrl() {
    const pub = publicBase(); if (pub) return pub;
    const host = location.hostname;
    const ip = (host === 'localhost' || host === '127.0.0.1') && S.lan[0] ? S.lan[0] : host;
    return `${location.protocol}//${ip}${location.port ? ':' + location.port : ''}`;
  }
  function renderLobby() {
    $('#onlineN').textContent = S.online.length;
    const list = S.rooms;
    $('#roomsCount').textContent = list.length ? `${list.length} ${plural(list.length, 'стол', 'стола', 'столов')}` : '';
    if (!list.length) { $('#roomsList').innerHTML = `<div class="empty">Пока нет ни одного стола. Создайте первый и пригласите друзей!</div>`; return; }
    $('#roomsList').innerHTML = list.map(r => {
      const seats = [];
      for (let i = 0; i < r.maxSeats; i++) {
        const a = (i / r.maxSeats) * Math.PI * 2 + Math.PI / 2;
        seats.push(`<i class="s${i < r.players ? ' on' : ''}" style="left:calc(${50 + 46 * Math.cos(a)}% - 9px);top:calc(${50 + 42 * Math.sin(a)}% - 9px)"></i>`);
      }
      return `<div class="room-card" data-room="${r.id}" data-private="${r.isPrivate ? 1 : 0}">
        <div class="mini-table">${seats.join('')}</div>
        <h4><span>${r.isPrivate ? '🔒 ' : ''}${esc(r.name)}</span><span class="tag ${r.mode === 'tournament' ? 'gold' : ''}">${r.mode === 'tournament' ? 'Турнир' : 'Кэш'}${r.blindsUp ? ' · ↑' : ''}</span></h4>
        <div class="room-meta"><span>Блайнды ${fmt(r.sb)} / ${fmt(r.bb)}${r.ante ? ` · анте ${fmt(r.ante)}` : ''}</span><span>Стол № ${r.id}</span></div>
        <div class="room-meta" style="margin-top:6px"><span>${r.players}/${r.maxSeats} игроков${r.bots ? ` (🤖 ${r.bots})` : ''} ${r.names.length ? '· ' + esc(r.names.slice(0, 3).join(', ')) : ''}</span>${r.paused ? '<span class="tag gold">⏸ пауза</span>' : r.playing ? '<span class="tag green">идёт игра</span>' : '<span class="tag">ожидание</span>'}</div>
      </div>`;
    }).join('');
  }
  function plural(n, a, b, c) { n = Math.abs(n) % 100; const n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }
  function renderOnline() {
    $('#onlineList').innerHTML = `<div class="muted" style="font-size:12px;margin-bottom:8px">Сейчас на сервере: ${S.online.length}</div>` + S.online.map(u =>
      `<div class="friend"><div class="ava" style="background:${avBg(u.avatar)}">${esc(u.avatar)}</div><div>${esc(u.name)}<small>${u.room ? 'За столом «' + esc(u.room) + '»' : 'В лобби'}</small></div></div>`).join('');
  }

  // ───────── Стол: геометрия ─────────
  // Две раскладки: горизонтальная (ПК, планшет, телефон лёжа) и вертикальная (телефон в руке)
  const GEO = {
    land: { W: 1100, H: 740, CX: 550, CY: 441, RX: 505, RY: 244, MID: { x: 550, y: 405 }, DH: { x: 513, y: 278 }, POT: { x: 470, y: 484 }, PILL: { x: 590 }, STREET: 446,
      ME: { hole: { x: 550, y: 590 }, bet: { x: 700, y: 600 }, btn: { x: 420, y: 640 } },
      LAYOUT: { 2: [180, 330], 3: [180, 262, 98], 4: [180, 250, 320, 90], 5: [180, 240, 300, 60, 120], 6: [180, 236, 292, 332, 64, 122] } },
    port: { W: 720, H: 1160, CX: 360, CY: 615, RX: 306, RY: 318, MID: { x: 360, y: 605 }, DH: { x: 318, y: 334 }, POT: { x: 248, y: 705 }, PILL: { x: 410 }, STREET: 520,
      ME: { seat: { x: 360, y: 1088 }, hole: { x: 360, y: 968 }, bet: { x: 360, y: 860 }, btn: { x: 238, y: 1000 } },
      SLOTS: { L1: { x: 92, y: 795 }, L2: { x: 52, y: 572 }, L3: { x: 104, y: 380 }, R3: { x: 616, y: 380 }, R2: { x: 668, y: 572 }, R1: { x: 628, y: 795 } },
      PLAN: { 2: ['R3'], 3: ['L2', 'R2'], 4: ['L2', 'L3', 'R2'], 5: ['L2', 'L3', 'R3', 'R2'], 6: ['L1', 'L2', 'L3', 'R3', 'R2'] },
      LAYOUT: { 2: [180, 330], 3: [180, 250, 110], 4: [180, 250, 325, 75], 5: [180, 235, 300, 60, 125], 6: [180, 230, 283, 335, 50, 120] } }
  };
  let G = GEO.land, W = G.W, H = G.H, CX = G.CX, CY = G.CY, RX = G.RX, RY = G.RY, MID = G.MID, LAYOUT = G.LAYOUT, DEALER_HAND = G.DH, POT = G.POT;
  function useGeo(name) {
    G = GEO[name]; ({ W, H, CX, CY, RX, RY, MID, LAYOUT } = G); DEALER_HAND = G.DH; POT = G.POT;
    $('#stage').classList.toggle('portrait', name === 'port');
    $('#stage').style.width = W + 'px';
  }
  function seatAngle(i) {
    const st = S.st; const n = st ? st.room.maxSeats : 6;
    const base = st && st.mySeat >= 0 ? st.mySeat : 0;
    const rel = (i - base + n) % n;
    return (LAYOUT[n] || LAYOUT[6])[rel];
  }
  function slotOf(i) {
    if (!G.SLOTS) return null;
    const st = S.st, n = st ? st.room.maxSeats : 6, base = st && st.mySeat >= 0 ? st.mySeat : 0;
    const rel = (i - base + n) % n;
    if (rel === 0) return null;
    return G.SLOTS[(G.PLAN[n] || G.PLAN[6])[rel - 1]] || null;
  }
  function seatPos(i) {
    if (G.ME.seat && isMe(i)) return G.ME.seat;
    if (!isMe(i) && G.SLOTS && !(S.st && S.st.mySeat < 0 && i === 0)) { const sl = slotOf(i); if (sl) return sl; }
    const a = seatAngle(i) * Math.PI / 180; return { x: CX + RX * Math.sin(a), y: CY - RY * Math.cos(a) };
  }
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  function isMe(i) { return S.st && S.st.mySeat === i; }
  // на телефоне: карты — перед табличкой со стороны центра, ставка — ниже, кнопка дилера — над кольцом
  const dirOf = p => (p.x < CX ? 1 : -1);
  function holePos(i) {
    if (isMe(i)) return G.ME.hole;
    if (G.SLOTS) { const p = seatPos(i); return { x: p.x + dirOf(p) * 74, y: p.y - 2 }; }
    return lerp(seatPos(i), MID, .3);
  }
  function betPos(i) {
    if (isMe(i)) return G.ME.bet;
    if (G.SLOTS) { const p = seatPos(i); return { x: p.x + dirOf(p) * 145, y: p.y + 62 }; }
    return lerp(seatPos(i), MID, .47);
  }
  function btnPos(i) {
    if (isMe(i)) return G.ME.btn;
    if (G.SLOTS) { const p = seatPos(i); return { x: p.x + dirOf(p) * 58, y: p.y - 40 }; }
    const s = seatPos(i), p = lerp(s, MID, .26); const vx = MID.x - s.x, vy = MID.y - s.y, l = Math.hypot(vx, vy) || 1;
    return { x: p.x - vy / l * 58, y: p.y + vx / l * 58 };
  }
  function fitStage(depth = 0) {
    const wrap = $('#stageWrap'), st = $('#stage');
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (!w || !h) return;
    const phonePortrait = window.innerWidth <= 980 && window.innerHeight > window.innerWidth;
    const want = phonePortrait || w / h < 0.85 ? 'port' : 'land';
    // на телефоне подгоняем зону стола под реальную высоту панели действий
    if (window.innerWidth <= 980) {
      const bar = $('#actionArea').firstElementChild, tb = $('#tabbar');
      const bottom = (bar ? bar.offsetHeight + 14 : 0) + (tb && tb.offsetHeight ? tb.offsetHeight : 0);
      const tt = $('.table-top'), top = tt ? Math.round(tt.getBoundingClientRect().bottom - wrap.parentElement.getBoundingClientRect().top + 6) : 46;
      wrap.style.cssText = `inset:${top}px 0 ${bottom}px 0 !important`;
      if (depth < 2 && Math.abs(wrap.clientHeight - h) > 2) return fitStage(depth + 1);
    } else wrap.style.cssText = '';
    if (G !== GEO[want]) { useGeo(want); if (S.st) { S.actKey = ''; renderTable(); } }
    const s = want === 'port' ? Math.min(w / (W + 70), h / (H + 10)) : Math.min(w / (W + 60), h / (H + 70));
    Object.assign(st.style, { position: 'absolute', left: '50%', top: '50%', height: H + 'px', transform: `translate(-50%,-50%) translateY(${30 * s}px) scale(${s})` });
  }

  // ───────── Карты и фишки ─────────
  function cardHTML(c, size = '', extra = '') {
    if (!c) return `<div class="card back ${size} ${extra}"></div>`;
    const red = c.s === 'h' || c.s === 'd';
    return `<div class="card ${size} ${red ? 'red' : ''} s-${c.s} ${extra}"><div class="cr">${RANK(c.r)}<span>${SUIT[c.s]}</span></div><div class="cc">${SUIT[c.s]}</div></div>`;
  }
  function miniCard(c) { return `<span class="mini ${c.s === 'h' || c.s === 'd' ? 'red' : ''} s-${c.s}">${RANK(c.r)}${SUIT[c.s]}</span>`; }
  const DENOMS = [[100000, '#c9962a'], [25000, '#7b3fc9'], [5000, '#1f9e5a'], [1000, '#2f5be0'], [500, '#d23a3a'], [100, '#262a36'], [25, '#c8c8d0'], [5, '#c96a2a'], [1, '#7a8090']];
  function chipsHTML(amount, maxStacks = 4, maxPer = 9) {
    let rest = Math.round(amount); const stacks = [];
    for (const [v, c] of DENOMS) {
      const n = Math.floor(rest / v);
      if (n > 0) { stacks.push([c, n]); rest -= n * v; }
    }
    return stacks.slice(0, maxStacks).map(([c, n]) => {
      const k = Math.min(n, maxPer);
      let h = ''; for (let i = 0; i < k; i++) h += `<i class="disc${i === k - 1 ? ' top' : ''}" style="--c:${c}"></i>`;
      return `<div class="stack">${h}</div>`;
    }).join('');
  }

  // ───────── Рендер стола ─────────
  function onState(d) {
    S.prev = S.st; S.st = d; S.offset = d.now - Date.now();
    const prev = S.prev, h = d.hand, ph = prev && prev.hand;
    // моя очередь хода
    const myTurnNow = !!d.you && !d.room.paused, myTurnBefore = !!(prev && prev.you);
    if (myTurnNow && !myTurnBefore) {
      S.raiseTo = d.you.minRaiseTo;
      SFX.turn();
      if (!tryPreAction(d)) {
        if (!DealerVoice.speaking && !DealerPack.playing && cfg.voice) { const ti = Math.floor(Math.random() * 3); Dealer.say([`${S.me.name}, ваш ход.`, `${S.me.name}... я жду вашего решения.`, `Ваш ход, ${S.me.name}. Удивите меня.`][ti], 'major', ['turn_' + (ti + 1)]); }
        if (document.hidden) note('⏰ Ваш ход за столом!');
      }
    }
    if (!h || h.finished || (ph && ph.no !== h.no)) S.pre = null;
    // взгляд дилера на того, кто ходит
    if (h && h.toAct >= 0 && (!ph || ph.toAct !== h.toAct)) {
      const p = seatPos(h.toAct); Dealer.look((p.x - CX) / RX, (p.y - 300) / 300);
    } else if (!h || h.toAct < 0) Dealer.look(0, .3);
    // результаты: всплывающие выигрыши
    if (h && h.results && !(ph && ph.results && ph.no === h.no)) {
      setTimeout(() => d.seats.forEach(p => { if (p && p.win > 0) floatAt(seatPos(p.i), '+' + fmt(p.win)); }), 300);
      Dealer.gesture();
    }
    if (S.view === 'table') renderTable();
    renderInfo();
  }

  function renderTable() {
    const st = S.st; if (!st) return;
    const h = st.hand, n = st.room.maxSeats;
    const layer = $('#seatsLayer');
    const winners = new Set(h && h.results ? h.results.filter(r => !r.refund).flatMap(r => r.winners) : []);
    // лучшие карты победителя для подсветки
    let hlCards = [];
    if (h && h.results && h.finished) {
      const r0 = h.results.find(r => !r.refund) || h.results[0]; const w = r0 && st.seats[r0.winners[0]];
      if (w && w.best) hlCards = w.best.cards;
    }
    let html = '';
    const canSit = st.mySeat < 0 && !(st.room.mode === 'tournament' && st.room.started);
    for (let i = 0; i < n; i++) {
      const p = st.seats[i], pos = seatPos(i);
      if (!p) {
        html += `<div class="empty-seat ${canSit ? 'can' : ''}" data-sit="${i}" style="left:${pos.x}px;top:${pos.y}px">${canSit ? 'Сесть' : 'Пусто'}</div>`;
        continue;
      }
      const turn = h && h.toAct === i;
      const side = p.me ? 'mid' : pos.x > CX + 40 ? 'right' : pos.x < CX - 40 ? 'left' : 'mid';
      const cls = ['seat', G.SLOTS && !p.me ? 'col' : 'side-' + side, p.me ? 'me' : '', turn ? 'turn' : '', p.folded ? 'folded' : '', winners.has(i) && h.finished ? 'winner' : '', p.stack === 0 && !p.inHand ? 'out' : ''].join(' ');
      let act = '';
      if (h && !h.finished && !p.inHand && !p.lastAction && p.stack > 0) act = `<div class="act">Ждёт раздачи</div>`;
      if (p.lastAction) {
        const k = /Фолд/.test(p.lastAction) ? 'fold' : /Олл-ин/.test(p.lastAction) ? 'allin' : /Рейз|Ставка/.test(p.lastAction) ? 'raise' : '';
        act = `<div class="act ${k}">${esc(p.lastAction)}</div>`;
      }
      const stackTxt = p.stack === 0 && !p.inHand ? (st.room.mode === 'cash' ? 'Нет фишек' : 'Выбыл') : (p.allIn && p.inHand ? 'Олл-ин' : fmt(p.stack));
      html += `<div class="${cls}" data-seat="${i}" style="left:${pos.x}px;top:${pos.y}px" title="${esc(p.name)}${p.ip ? ' · IP ' + esc(p.ip) : ''}">
        ${act}
        <div class="ring"><div class="ava" style="background:${avBg(p.avatar)}">${esc(p.avatar)}</div><div class="timer"></div></div>
        <div class="plate"><div class="nm">${p.me ? 'Вы' : esc(p.name)}${p.isHost ? ' 👑' : ''}</div><div class="st">${stackTxt}</div></div>

        ${!p.connected ? '<div class="discon">нет связи</div>' : ''}
        ${p.best && h && (h.street === 'showdown' || h.finished) && !p.folded ? `<div class="best">${esc(p.best.desc)}</div>` : ''}
      </div>`;
      // карманные карты
      if (p.inHand && p.cards.length) {
        let shown = p.cards.length;
        if (S.dealing && S.dealing.active) shown = S.dealing.count[i] || 0;
        if (shown > 0) {
          const hp = holePos(i);
          const size = p.me ? 'lg' : 'sm';
          const cards = p.cards.slice(0, shown).map(c => cardHTML(c, size, (p.folded ? 'dim ' : '') + (hlCards.some(x => sameCard(x, c)) ? 'hl' : ''))).join('');
          if (!(p.folded && !p.me)) html += `<div class="hole ${p.me ? 'mine' : ''}" style="left:${hp.x}px;top:${hp.y}px">${cards}</div>`;
        }
      }
      // ставка
      if (p.bet > 0) {
        const bp = betPos(i);
        html += `<div class="bet" data-bet="${i}" style="left:${bp.x}px;top:${bp.y}px">${chipsHTML(p.bet, 3, 6)}<span class="amt">${fmt(p.bet)}</span></div>`;
      }
    }
    if (h && h.button >= 0 && st.seats[h.button]) {
      const b = btnPos(h.button); html += `<div class="dbtn" style="left:${b.x}px;top:${b.y}px">D</div>`;
    }
    layer.innerHTML = html;

    // общие карты
    const board = h ? h.board : [];
    const prevBoard = S.prev && S.prev.hand && S.prev.hand.no === (h && h.no) ? S.prev.hand.board : [];
    let bh = '';
    for (let k = 0; k < 5; k++) {
      const c = board[k];
      if (c) bh += cardHTML(c, '', (k >= prevBoard.length && S.lastBoardKey !== (h.no + ':' + board.length) ? 'flip ' : '') + (hlCards.some(x => sameCard(x, c)) ? 'hl' : ''));
      else bh += `<div class="slot"></div>`;
    }
    $('#board').innerHTML = bh;
    if (h) S.lastBoardKey = h.no + ':' + board.length;
    // банк
    const pot = h ? (h.finished ? 0 : h.pot) : 0;
    $('#potPill').hidden = !pot;
    $('#potAmt').textContent = fmt(pot);
    $('#potChips').innerHTML = h && !h.finished && h.collected > 0 ? chipsHTML(h.collected, 5, 9) : '';
    Object.assign($('#potPill').style, { left: G.PILL.x + 'px', top: POT.y + 'px', transform: 'translate(-50%,-50%)' });
    Object.assign($('#potChips').style, { left: POT.x + 'px', top: (POT.y + 8) + 'px' });
    const names = { preflop: 'Префлоп', flop: 'Флоп', turn: 'Тёрн', river: 'Ривер', showdown: 'Вскрытие' };
    $('#streetName').textContent = h && !h.finished ? names[h.street] || '' : (h && h.finished ? 'Раздача завершена' : '');
    Object.assign($('#streetName').style, { top: G.STREET + 'px' });

    // кнопки над столом
    const me = st.mySeat >= 0 ? st.seats[st.mySeat] : null;
    $('#standBtn').hidden = !me;
    $('#botsBtn').hidden = !(st.room.isHost || !st.seats.some(p => p && p.isHost && p.connected));
    const paused = !!st.room.paused;
    $('#pauseBtn').hidden = !(me || st.room.isHost);
    $('#pauseBtn').innerHTML = paused ? '▶<span class="tt"> Продолжить</span>' : '⏸<span class="tt"> Пауза</span>';
    $('#pauseBtn').classList.toggle('on', paused);
    $('#pauseBanner').hidden = !paused;
    $('#pauseWho').textContent = paused ? `${st.room.pausedBy || 'Игрок'} поставил игру на паузу` : '';
    $('#resumeBtn').hidden = !(me || st.room.isHost);
    $('#stage').classList.toggle('is-paused', paused);
    $('#rebuyBtn').hidden = !(me && st.room.mode === 'cash' && me.stack < st.room.startStack && (!me.inHand || !h || h.finished));
    $('#startTourBtn').hidden = !st.room.canStart;
    renderActions();
  }

  // ───────── Панель действий ─────────
  function renderActions() {
    const st = S.st, area = $('#actionArea');
    if (!st) { area.innerHTML = ''; return; }
    const h = st.hand, y = st.you, me = st.mySeat >= 0 ? st.seats[st.mySeat] : null;
    if (st.room.paused) { const k2 = 'paused'; if (S.actKey !== k2) { S.actKey = k2; area.innerHTML = `<div class="waitbar"><span class="info">⏸ Игра на паузе</span><button class="btn btn-gold" data-do="resume">▶ Продолжить</button></div>`; } return; }
    const key = JSON.stringify([y, st.mySeat, me && [me.inHand, me.folded, me.allIn, me.sitOut, me.stack], h && [h.no, h.finished, h.currentBet, h.street], S.pre, st.room.started]);
    if (key === S.actKey) return;
    S.actKey = key;
    if (y) {
      const callLbl = y.canCheck ? 'Чек' : (y.toCall >= me.stack ? 'Олл-ин' : 'Колл');
      S.raiseTo = Math.min(Math.max(S.raiseTo || y.minRaiseTo, y.minRaiseTo), y.maxRaiseTo);
      const raiseLbl = y.isBet ? 'Ставка' : 'Рейз';
      area.innerHTML = `<div class="actionbar">
        <button class="abtn fold" data-a="fold">Фолд<small style="font-size:11px;opacity:.6">F</small></button>
        <button class="abtn call" data-a="${y.canCheck ? 'check' : 'call'}">${callLbl}${y.canCheck ? '' : `<small>${fmt(y.toCall)}</small>`}</button>
        ${y.canRaise ? `<button class="abtn raise" data-a="raise">${y.maxRaiseTo === S.raiseTo ? 'Олл-ин' : raiseLbl}<small id="raiseLbl">${fmt(S.raiseTo)}</small></button>
        <div class="raise-box">
          <div class="amount-row"><button data-step="-1">−</button><input id="raiseInput" inputmode="numeric" value="${fmt(S.raiseTo)}"><button data-step="1">+</button></div>
          <input type="range" id="raiseRange" min="${y.minRaiseTo}" max="${y.maxRaiseTo}" step="${st.room.sb || 1}" value="${S.raiseTo}">
          <div class="quick"><button data-q="min">Мин</button><button data-q="half">½ банка</button><button data-q="pot">Банк</button><button data-q="all">Олл-ин</button></div>
        </div>` : ''}
      </div>`;
      updateRange(); refit();
      return;
    }
    // не мой ход
    let inner = '';
    if (!me) {
      inner = st.room.mode === 'tournament' && st.room.started ? `<span class="info">Турнир идёт — вы наблюдаете</span>` : `<span class="info">Вы наблюдаете. Нажмите «Сесть» на свободном месте.</span>`;
    } else if (me.inHand && h && !h.finished && h.street !== 'showdown' && !me.folded && !me.allIn) {
      const pre = [['checkfold', 'Чек / Фолд'], ['call', 'Колл любой'], ['check', 'Чек']];
      inner = `<span class="info">Ожидание хода…</span><div class="prechecks">${pre.map(([k, l]) => `<label class="pre"><input type="checkbox" data-pre="${k}" ${S.pre === k ? 'checked' : ''}>${l}</label>`).join('')}</div>`;
    } else if (me.stack === 0 && (!me.inHand || !h || h.finished)) {
      inner = st.room.mode === 'cash' ? `<span class="info">Фишки закончились</span><button class="btn btn-gold" data-do="rebuy">Докупиться до ${fmt(st.room.startStack)}</button>` : `<span class="info">Вы выбыли из турнира</span>`;
    } else {
      const waiting = !h || h.finished;
      const msg = st.room.mode === 'tournament' && !st.room.started ? (st.room.isHost ? 'Когда все соберутся — нажмите «Начать турнир»' : 'Ожидаем старта турнира…') :
        waiting ? (st.seats.filter(p => p && p.stack > 0 && !p.sitOut).length < 2 ? 'Ожидание игроков… Пригласите друзей!' : 'Следующая раздача скоро начнётся') :
          h.street === 'showdown' ? 'Вскрытие карт…' : me.folded ? 'Вы сбросили карты' : me.allIn ? 'Вы в олл-ине' : me.sitOut ? 'Вы пропускаете раздачи' : 'Ожидание следующей раздачи';
      inner = `<span class="info">${msg}</span><label class="pre"><input type="checkbox" data-do="sitout" ${me.sitOut ? 'checked' : ''}>Пропускать раздачи</label>`;
    }
    area.innerHTML = `<div class="waitbar">${inner}</div>`; refit();
  }
  const refit = () => requestAnimationFrame(() => fitStage());
  function updateRange() {
    const r = $('#raiseRange'); if (!r) return;
    const y = S.st.you;
    r.value = S.raiseTo;
    const p = ((S.raiseTo - y.minRaiseTo) / Math.max(1, y.maxRaiseTo - y.minRaiseTo)) * 100;
    r.style.setProperty('--p', p + '%');
    const lbl = $('#raiseLbl'); if (lbl) lbl.textContent = fmt(S.raiseTo);
    const btn = $('.abtn.raise'); if (btn) btn.firstChild.textContent = S.raiseTo >= y.maxRaiseTo ? 'Олл-ин' : (y.isBet ? 'Ставка' : 'Рейз');
    const inp = $('#raiseInput'); if (inp && document.activeElement !== inp) inp.value = fmt(S.raiseTo);
  }
  function setRaise(v) {
    const y = S.st && S.st.you; if (!y) return;
    S.raiseTo = Math.round(Math.min(Math.max(v, y.minRaiseTo), y.maxRaiseTo));
    updateRange();
  }
  function doAction(a) {
    const y = S.st && S.st.you; if (!y) return;
    if (a === 'raise') send('action', { type: S.raiseTo >= y.maxRaiseTo ? 'allin' : 'raise', amount: S.raiseTo });
    else send('action', { type: a });
  }
  function tryPreAction(d) {
    if (!S.pre || !d.you) return false;
    const y = d.you, pre = S.pre; S.pre = null;
    if (pre === 'checkfold') { send('action', { type: y.canCheck ? 'check' : 'fold' }); return true; }
    if (pre === 'call') { send('action', { type: y.canCheck ? 'check' : 'call' }); return true; }
    if (pre === 'check' && y.canCheck) { send('action', { type: 'check' }); return true; }
    return false;
  }

  // ───────── Анимации ─────────
  function fly(html, from, to, ms = 420, cb) {
    const el = document.createElement('div'); el.className = 'fly'; el.innerHTML = html;
    el.style.transform = `translate(${from.x}px,${from.y}px) translate(-50%,-50%) rotate(-20deg) scale(.7)`;
    el.style.transitionDuration = ms + 'ms';
    $('#fxLayer').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `translate(${to.x}px,${to.y}px) translate(-50%,-50%) rotate(0) scale(1)`; }));
    setTimeout(() => { el.remove(); cb && cb(); }, ms + 20);
  }
  function onDeal(d) {
    const order = d.order, total = order.length * 2;
    S.dealing = { active: true, count: {} };
    Dealer.deal(0);
    let k = 0;
    for (let r = 0; r < 2; r++) for (const i of order) {
      const idx = k++;
      setTimeout(() => {
        if (S.view === 'table') {
          SFX.card(); Dealer.flick();
          fly(cardHTML(null, 'sm'), DEALER_HAND, holePos(i), 380, () => {
            S.dealing.count[i] = (S.dealing.count[i] || 0) + 1;
            if (S.view === 'table') renderTable();
          });
        } else S.dealing.count[i] = (S.dealing.count[i] || 0) + 1;
      }, idx * 300);
    }
    setTimeout(() => { if (S.dealing) S.dealing.active = false; renderTable(); }, total * 300 + 450);
  }
  function onSfx(d) {
    if (d.name === 'chip') { d.allin ? SFX.chips() : SFX.chip(); }
    else if (d.name === 'check') SFX.check();
    else if (d.name === 'fold') SFX.fold();
    else if (d.name === 'board') { SFX.card(); Dealer.flick(); setTimeout(() => { SFX.card(); Dealer.flick(); }, 420); }
    else if (d.name === 'collect') {
      if (S.view !== 'table') return;
      $$('#seatsLayer .bet').forEach(b => {
        const x = parseFloat(b.style.left), y = parseFloat(b.style.top);
        fly(b.innerHTML.replace(/<span class="amt">.*?<\/span>/, ''), { x, y }, POT, 420);
      });
      if ($$('#seatsLayer .bet').length) SFX.chips();
    } else if (d.name === 'win') {
      SFX.win();
      if (S.view === 'table' && S.st) (d.seats || []).forEach((s, k) => setTimeout(() => fly(chipsHTML(5000 + 1000, 2, 4), POT, seatPos(s), 600), k * 150));
    } else if (d.name === 'champion') SFX.champion();
  }
  function floatAt(pos, text) {
    const el = document.createElement('div'); el.className = 'win-float'; el.textContent = text;
    el.style.left = pos.x + 'px'; el.style.top = (pos.y - 60) + 'px';
    $('#fxLayer').appendChild(el); setTimeout(() => el.remove(), 2700);
  }
  function showEmote(seat, e) {
    if (!S.st || S.view !== 'table') return;
    const p = seatPos(seat); const el = document.createElement('div'); el.className = 'emote-bubble'; el.textContent = e;
    el.style.left = p.x + 'px'; el.style.top = (p.y - 50) + 'px'; $('#fxLayer').appendChild(el); setTimeout(() => el.remove(), 2500);
  }

  // таймер хода и счётчик уровня
  function tick() {
    const st = S.st;
    if (st && st.hand && st.hand.toAct >= 0 && S.view === 'table') {
      const el = $(`.seat[data-seat="${st.hand.toAct}"] .timer`);
      if (el) {
        const left = st.room.paused || !st.hand.deadline ? (st.hand.pausedLeft || st.room.turnTime * 1000) : Math.max(0, st.hand.deadline - (Date.now() + S.offset));
        const frac = Math.min(1, left / (st.room.turnTime * 1000));
        const col = frac > .5 ? '#6a84ff' : frac > .2 ? '#f3c454' : '#ff4d5e';
        el.style.background = `conic-gradient(${col} ${frac * 360}deg, rgba(255,255,255,.08) 0)`;
        el.style.webkitMask = el.style.mask = 'radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px))';
      }
    }
    requestAnimationFrame(tick);
  }
  setInterval(() => { if (S.st && S.st.room.nextLevelAt) renderInfo(); }, 1000);

  // ───────── Инфо-панель ─────────
  function renderInfo() {
    const st = S.st, box = $('#infoPanel');
    if (!st || !S.roomId) { box.hidden = true; return; }
    box.hidden = false;
    const r = st.room, players = st.seats.filter(Boolean).length;
    let lvl = '';
    if (r.nextLevelAt) {
      const left = Math.max(0, r.nextLevelAt - (Date.now() + S.offset));
      lvl = `<div class="row">Уровень <b>${r.level}</b></div><div class="row">До повышения <b>${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}</b></div>`;
    }
    box.innerHTML = `<h4><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>Техасский Холдем</h4>
      <div class="row">Блайнды <b>${fmt(r.sb)} / ${fmt(r.bb)}</b></div>
      <div class="row">Анте <b>${r.ante ? fmt(r.ante) : '—'}</b></div>
      <div class="row">Рост блайндов <b>${esc(r.blindsUp || 'нет')}</b></div>
      ${r.nextLevelHands ? `<div class="row">Повышение через <b>${r.nextLevelHands} разд.</b></div>` : ''}
      <div class="row">Игроков <b class="gold">${players} / ${r.maxSeats}</b></div>
      <div class="row">Стол № <b>${r.id}</b></div>
      <div class="row">Режим <b>${r.mode === 'tournament' ? 'Турнир' : (r.isPrivate ? 'Приватная' : 'Открытая')}</b></div>
      ${st.hand ? `<div class="row">Раздача <b>№ ${st.hand.no}</b></div>` : ''}${lvl}`;
  }

  // ───────── Чат и история ─────────
  function addChat(m) {
    const list = $('#chatList');
    const t = new Date(m.time || Date.now()).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'msg' + (m.dealer ? ' dlr' : '') + (m.system ? ' system' : '');
    let txt = esc(m.text).replace(/(туз|король|дама|валет|десятка|девятка|восьмёрка|семёрка|шестёрка|пятёрка|четвёрка|тройка|двойка) (пик|червей|бубен|треф)/g, (all, r, s) => {
      const sym = { пик: '♠', червей: '<span style="color:#ff5468">♥</span>', бубен: '<span style="color:#ff5468">♦</span>', треф: '♣' }[s];
      const rk = { туз: 'A', король: 'K', дама: 'Q', валет: 'J', десятка: '10', девятка: '9', восьмёрка: '8', семёрка: '7', шестёрка: '6', пятёрка: '5', четвёрка: '4', тройка: '3', двойка: '2' }[r];
      return `<b>${rk}${sym}</b>`;
    });
    div.innerHTML = `<span class="who">${esc(m.from)}</span><span class="t">${t}</span><div class="txt">${txt}</div>`;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
    list.appendChild(div);
    while (list.children.length > 160) list.firstChild.remove();
    if (atBottom) list.scrollTop = list.scrollHeight;
  }
  function addHist(hh, prepend) {
    const div = document.createElement('div'); div.className = 'hist-item';
    const t = new Date(hh.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div class="h"><span>Раздача № ${hh.no}</span><span>${t}</span></div>
      ${hh.board.length ? `<div style="margin-bottom:6px"><span class="mini-cards">${hh.board.map(miniCard).join('')}</span></div>` : ''}
      ${hh.results.map(r => r.refund ? `<div class="muted" style="font-size:12px">↩ ${esc(r.names[0])}: возврат ${fmt(r.amount)} — ставку никто не уравнял</div>` : `<div><b class="gold">${esc(r.names.join(', '))}</b> +${fmt(r.amount)} <span class="muted">· ${esc(r.hand)}</span></div>`).join('')}
      ${hh.shown.length ? `<div style="margin-top:6px;font-size:12px" class="muted">${hh.shown.map(s => `${esc(s.name)}: <span class="mini-cards">${s.cards.map(miniCard).join('')}</span>`).join(' &nbsp; ')}</div>` : ''}`;
    const list = $('#histList');
    if (prepend) list.prepend(div); else list.appendChild(div);
  }
  function sendChat() {
    const inp = $('#chatInput'); const v = inp.value.trim();
    if (!v) return; send('chat', { text: v }); inp.value = ''; $('#emojiPop').hidden = true;
  }

  // ───────── Модальные окна ─────────
  function modal(html, wide) {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal-bg"><div class="modal ${wide ? 'wide' : ''}">${html}</div></div>`;
    const bg = root.firstChild;
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) closeModal(); });
    return bg.firstChild;
  }
  function closeModal() { $('#modalRoot').innerHTML = ''; }
  const head = t => `<h3>${t}<button class="x" data-close>×</button></h3>`;

  function createRoomModal(mode = 'cash') {
    const m = modal(`${head('Создать комнату')}
      <div class="field"><label>Название</label><input class="input" id="crName" maxlength="28" value="Стол ${esc(S.me.name)}"></div>
      <div class="field"><label>Режим</label><div class="seg" id="crMode"><button data-m="cash" class="${mode === 'cash' ? 'on' : ''}">Кэш-игра</button><button data-m="tournament" class="${mode === 'tournament' ? 'on' : ''}">Турнир</button></div></div>
      <div class="grid2">
        <div class="field"><label>Блайнды</label><select class="select" id="crBlinds">
          ${[[25, 50], [50, 100], [100, 200], [250, 500], [500, 1000], [1000, 2000], [2500, 5000]].map(([a, b]) => `<option value="${a}/${b}" ${b === 1000 ? 'selected' : ''}>${fmt(a)} / ${fmt(b)}</option>`).join('')}
        </select></div>
        <div class="field"><label>Анте</label><select class="select" id="crAnte"><option value="0">Без анте</option><option value="0.1" selected>10% ББ</option><option value="0.25">25% ББ</option></select></div>
        <div class="field"><label>Стартовый стек</label><select class="select" id="crStack"><option value="30">30 ББ</option><option value="50" selected>50 ББ</option><option value="100">100 ББ</option><option value="200">200 ББ</option></select></div>
        <div class="field"><label>Мест за столом</label><select class="select" id="crSeats">${[2, 3, 4, 5, 6].map(v => `<option ${v === 6 ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label>Время на ход</label><select class="select" id="crTime">${[15, 20, 30, 45, 60].map(v => `<option value="${v}" ${v === 30 ? 'selected' : ''}>${v} сек</option>`).join('')}</select></div>
        <div class="field" id="crLevelBox"><label>Рост блайндов</label><select class="select" id="crLevel">
          <option value="off">Не повышать</option>
          <option value="hands:5">Каждые 5 раздач</option>
          <option value="hands:10" ${mode === 'cash' ? 'selected' : ''}>Каждые 10 раздач</option>
          <option value="hands:20">Каждые 20 раздач</option>
          <option value="time:5">Каждые 5 минут</option>
          <option value="time:8" ${mode === 'tournament' ? 'selected' : ''}>Каждые 8 минут</option>
          <option value="time:15">Каждые 15 минут</option>
        </select></div>
      </div>
      <div class="grid2">
        <div class="field"><label>🤖 Боты</label><select class="select" id="crBots">${[0, 1, 2, 3, 4, 5].map(v => `<option value="${v}">${v ? v + ' ' + (v === 1 ? 'бот' : v < 5 ? 'бота' : 'ботов') : 'Без ботов'}</option>`).join('')}</select></div>
        <div class="field"><label>Сложность ботов</label><select class="select" id="crBotLv"><option value="easy">😊 Лёгкие</option><option value="medium" selected>😐 Средние</option><option value="hard">😈 Сложные</option><option value="mixed">🎲 Разные</option></select></div>
      </div>
      <div class="field"><label>Пароль (для приватной комнаты)</label><input class="input" id="crPass" maxlength="24" placeholder="Оставьте пустым для открытой комнаты"></div>
      <div class="buyin-note" id="crBuy"></div>
      <div class="foot"><button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-gold" id="crGo">Создать</button></div>`);
    let md = mode;
    const updBuy = () => {
      const bb = +m.querySelector('#crBlinds').value.split('/')[1], st = bb * +m.querySelector('#crStack').value;
      m.querySelector('#crBuy').innerHTML = `${md === 'tournament' ? 'Взнос за турнир' : 'Бай-ин'}: <b class="gold">${fmt(st)}</b> фишек · у вас на балансе <b>${fmt((S.wallet || {}).balance || 0)}</b>${md === 'tournament' ? '<br><span class="muted">Победитель забирает все взносы</span>' : ''}`;
    };
    ['#crBlinds', '#crStack'].forEach(q => m.querySelector(q).addEventListener('change', updBuy));
    m.querySelector('#crLevel').addEventListener('change', () => {});
    m.querySelector('#crMode').onclick = e => { const b = e.target.closest('button'); if (!b) return; md = b.dataset.m; m.querySelectorAll('#crMode button').forEach(x => x.classList.toggle('on', x === b)); updBuy(); };
    updBuy();
    m.querySelector('#crGo').onclick = () => {
      const [sb, bb] = m.querySelector('#crBlinds').value.split('/').map(Number);
      send('createRoom', {
        name: m.querySelector('#crName').value, mode: md, sb, bb, ante: Math.round(bb * +m.querySelector('#crAnte').value),
        startStack: bb * +m.querySelector('#crStack').value, maxSeats: +m.querySelector('#crSeats').value, turnTime: +m.querySelector('#crTime').value,
        levelMode: (m.querySelector('#crLevel').value.split(':')[0]), levelEvery: +(m.querySelector('#crLevel').value.split(':')[1] || 0), password: m.querySelector('#crPass').value, oneIp: false,
        bots: +m.querySelector('#crBots').value, botLevel: m.querySelector('#crBotLv').value
      });
      closeModal();
    };
  }
  function joinModal(prefill = '') {
    const m = modal(`${head('Приватная комната')}
      <p class="muted" style="margin-top:-6px">Введите номер стола и пароль, которые прислал друг.</p>
      <div class="grid2"><div class="field"><label>Номер стола</label><input class="input" id="jId" inputmode="numeric" maxlength="4" value="${esc(prefill)}" placeholder="4587"></div>
      <div class="field"><label>Пароль</label><input class="input" id="jPass" type="password" maxlength="24" placeholder="если есть"></div></div>
      <div class="foot"><button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-gold" id="jGo">Войти</button></div>`);
    const go2 = () => { send('joinRoom', { id: m.querySelector('#jId').value, password: m.querySelector('#jPass').value }); closeModal(); };
    m.querySelector('#jGo').onclick = go2;
    m.querySelector(prefill ? '#jPass' : '#jId').focus();
    m.addEventListener('keydown', e => { if (e.key === 'Enter') go2(); });
  }
  // ───────── Боты ─────────
  const BOT_LV = { easy: 'лёгкий', medium: 'средний', hard: 'сложный' };
  function botsModal() {
    const st = S.st; if (!st) return;
    const bots = st.seats.filter(p => p && p.bot);
    const free = st.seats.filter(p => !p).length;
    const canAdd = free > 0 && !(st.room.mode === 'tournament' && st.room.started);
    const m = modal(`${head('🤖 Боты за столом')}
      <p class="muted" style="margin-top:-6px">Боты играют по-настоящему: считают шансы, блефуют, повышают. Их фишки не берутся с вашего баланса.</p>
      ${bots.length ? `<div class="bot-list">${bots.map(p => `<div class="bot-row"><span class="ava" style="background:${avBg(p.avatar)}">${esc(p.avatar)}</span><div class="bot-info"><b>${esc(p.name)}</b><small><span class="bot-tag lv-${p.bot} static">${BOT_LV[p.bot]}</span> ${fmt(p.stack)}</small></div><button class="btn btn-ghost" data-rm="${p.i}">Убрать</button></div>`).join('')}</div>` : '<p class="muted">Ботов пока нет.</p>'}
      ${canAdd ? `<div class="grid2" style="margin-top:14px">
        <div class="field"><label>Сколько добавить</label><select class="select" id="bCnt">${Array.from({ length: Math.min(5, free) }, (_, k) => `<option value="${k + 1}">${k + 1}</option>`).join('')}</select></div>
        <div class="field"><label>Сложность</label><select class="select" id="bLv"><option value="easy">😊 Лёгкие</option><option value="medium" selected>😐 Средние</option><option value="hard">😈 Сложные</option><option value="mixed">🎲 Разные</option></select></div>
      </div>` : `<p class="muted">${free ? 'Турнир уже идёт — добавить ботов нельзя.' : 'Свободных мест нет.'}</p>`}
      <div class="foot">${bots.length ? '<button class="btn btn-ghost" id="bRmAll">Убрать всех</button>' : ''}${canAdd ? '<button class="btn btn-gold" id="bAdd">Добавить</button>' : '<button class="btn btn-gold" data-close>Готово</button>'}</div>`);
    m.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { send('bots', { action: 'remove', seat: +b.dataset.rm }); closeModal(); });
    if (m.querySelector('#bRmAll')) m.querySelector('#bRmAll').onclick = () => { send('bots', { action: 'removeAll' }); closeModal(); };
    if (m.querySelector('#bAdd')) m.querySelector('#bAdd').onclick = () => { send('bots', { action: 'add', count: +m.querySelector('#bCnt').value, level: m.querySelector('#bLv').value }); closeModal(); };
  }

  // ───────── Восстановление пароля ─────────
  function recoveryModal(code) {
    const m = modal(`${head('🔑 Код восстановления')}
      <p class="muted" style="margin-top:-4px">Если забудете пароль, этот код поможет его сменить. Сохраните его — сделайте скриншот или запишите.</p>
      <div class="rc-code">${esc(code)}</div>
      <p class="muted" style="font-size:13px">Код всегда можно посмотреть в кабинете.</p>
      <div class="foot"><button class="btn btn-ghost" id="rcCopy">Скопировать</button><button class="btn btn-gold" data-close>Я сохранил</button></div>`);
    m.querySelector('#rcCopy').onclick = () => { try { navigator.clipboard.writeText(code); toast('Код скопирован'); } catch (e) { } };
  }
  function forgotModal() {
    const m = modal(`${head('Забыли пароль?')}
      <p class="muted" style="margin-top:-4px">Введите номер и код восстановления — его показывали при регистрации, он есть в кабинете.</p>
      <div class="field"><label>Номер телефона</label><div class="phone-in"><span>+</span><input class="input" id="fgPhone" type="tel" inputmode="tel" maxlength="20" value="${esc($('#loginPhone').value)}"></div></div>
      <div class="field"><label>Код восстановления</label><input class="input" id="fgCode" maxlength="12" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="off" style="letter-spacing:2px;text-transform:uppercase"></div>
      <div class="field"><label>Новый пароль</label><input class="input" id="fgPass" type="password" maxlength="40" placeholder="Минимум 4 символа" autocomplete="new-password"></div>
      <div class="login-err" id="fgErr" hidden></div>
      <p class="muted" style="font-size:13px">Нет кода? Попросите хозяина сайта — он сбросит пароль и пришлёт новый.</p>
      <div class="foot"><button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-gold" id="fgGo">Сменить пароль</button></div>`);
    const go2 = () => {
      const phone = m.querySelector('#fgPhone').value.replace(/\D/g, ''), code = m.querySelector('#fgCode').value, pw = m.querySelector('#fgPass').value;
      const err = t => { const e = m.querySelector('#fgErr'); e.hidden = false; e.textContent = t; };
      if (phone.length < 9) return err('Введите номер телефона');
      if (code.replace(/[^a-z0-9]/gi, '').length < 8) return err('Введите код из 8 символов');
      if (pw.length < 4) return err('Новый пароль — минимум 4 символа');
      const ph = phone.length === 9 ? '998' + phone : phone, key = 'p' + ph;
      const bk = Object.entries(S.backups).find(([k]) => { try { return atob(k.replace(/-/g, '+').replace(/_/g, '/')) === key; } catch (e) { return false; } });
      S.pendingReset = { phone, pw };
      m.querySelector('#fgGo').disabled = true;
      send('resetPw', { phone, code, password: pw, backup: bk ? bk[1] : '' });
    };
    m.querySelector('#fgGo').onclick = go2;
    m.addEventListener('keydown', e => { if (e.key === 'Enter') go2(); });
    m.querySelector(m.querySelector('#fgPhone').value.length > 5 ? '#fgCode' : '#fgPhone').focus();
  }
  function onResetResult(d) {
    const m = $('#modalRoot .modal');
    if (!d.ok) {
      if (m && m.querySelector('#fgErr')) { const e = m.querySelector('#fgErr'); e.hidden = false; e.textContent = d.text; m.querySelector('#fgGo').disabled = false; }
      else toast(d.text, true);
      return;
    }
    closeModal(); toast(d.text);
    const r = S.pendingReset; S.pendingReset = null; if (!r) return;
    if (S.setAuthMode) S.setAuthMode('login');
    $('#loginPhone').value = r.phone; $('#loginPin').value = r.pw;
    if (S.doLogin) S.doLogin();
  }

  // ───────── С какой суммой сесть за стол ─────────
  function buyInModal(seat) {
    const st = S.st; if (!st) return send('sit', { seat });
    const r = st.room;
    if (r.mode !== 'cash') return send('sit', { seat });       // в турнире стек у всех одинаковый
    const bal = Math.floor((S.wallet && S.wallet.balance) || 0);
    const min = r.bb * 10;
    if (bal < min) return toast(`На балансе ${fmt(bal)} — нужно минимум ${fmt(min)}. Заберите бонус в кабинете.`, true);
    const step = Math.max(1, r.sb || 1);
    const max = bal;
    let val = Math.min(Math.max(r.startStack, min), max);
    const m = modal(`${head('С какой суммой сесть?')}
      <p class="muted" style="margin-top:-6px">Блайнды ${fmt(r.sb)} / ${fmt(r.bb)}. На балансе: <b style="color:var(--gold2)">${fmt(bal)}</b></p>
      <div class="buyin-val" id="biVal"></div>
      <input type="range" class="buyin-range" id="biRange" min="${min}" max="${max}" step="${step}" value="${val}">
      <div class="buyin-lim"><span>мин ${fmt(min)}</span><span>макс ${fmt(max)}</span></div>
      <div class="buyin-quick">
        <button data-v="${min}">Мин</button><button data-v="${Math.min(max, r.startStack)}">Стандарт</button>
        <button data-v="${Math.max(min, Math.floor(bal / 2))}">½ баланса</button><button data-v="${max}">Всё</button>
      </div>
      <div class="foot"><button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-gold" id="biGo">Сесть за стол</button></div>`);
    const rng = m.querySelector('#biRange'), out = m.querySelector('#biVal');
    const show = () => { out.textContent = fmt(val); };
    rng.oninput = () => { val = +rng.value; show(); };
    m.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { val = +b.dataset.v; rng.value = val; show(); });
    m.querySelector('#biGo').onclick = () => { send('sit', { seat, amount: val }); closeModal(); };
    show();
  }
  function passwordModal(d) {
    const m = modal(`${head('🔒 ' + esc(d.name))}
      <p class="muted" style="margin-top:-6px">${d.wrong ? '<span style="color:#ff6b7d">Неверный пароль.</span> ' : ''}Это приватная комната. Введите пароль.</p>
      <div class="field"><input class="input" id="pPass" type="password" maxlength="24"></div>
      <div class="foot"><button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-gold" id="pGo">Войти</button></div>`);
    const go2 = () => { send('joinRoom', { id: d.id, password: m.querySelector('#pPass').value }); closeModal(); };
    m.querySelector('#pGo').onclick = go2; m.querySelector('#pPass').focus();
    m.addEventListener('keydown', e => { if (e.key === 'Enter') go2(); });
  }
  function inviteModal() {
    const st = S.st; if (!st) return;
    const pub = publicBase();
    const url = `${baseUrl()}/?room=${st.room.id}`;
    modal(`${head('Пригласить друзей')}
      <p class="muted">Отправьте ссылку в Telegram или WhatsApp. Друг откроет её на телефоне или компьютере из любого места — и сразу попадёт к этому столу.</p>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:220px"><div class="copyline"><code>${esc(url)}</code><button class="btn btn-gold" style="height:36px" data-copy="${esc(url)}">Копировать</button></div>
        ${navigator.share ? `<button class="btn btn-blue" style="margin-top:10px" id="shareBtn">📤 Поделиться</button>` : ''}
        <div class="muted" style="font-size:12.5px;margin-top:10px">📱 Или наведите камеру телефона на QR-код</div></div>
        ${qrHTML(url, 150)}
      </div>
      <div class="cards-row" style="margin:16px 0 0">
        <div class="panel stat"><div class="v">${st.room.id}</div><div class="l">Номер стола</div></div>
        <div class="panel stat"><div class="v">${st.room.isPrivate ? '🔒' : '🔓'}</div><div class="l">${st.room.isPrivate ? 'Нужен пароль — сообщите его друзьям' : 'Открытая комната'}</div></div>
      </div>
      ${S.sign ? `<div class="pub-link" style="margin-top:14px;border-color:rgba(49,196,108,.5);background:rgba(49,196,108,.07)"><div style="flex:1;min-width:0"><div style="font-weight:700;color:#6fe39f;margin-bottom:4px">⭐ Постоянная страница с актуальной ссылкой</div><div class="copyline"><code>${esc(S.sign)}</code><button class="btn btn-dark" style="height:34px" data-copy="${esc(S.sign)}">Копировать</button></div><div class="muted" style="font-size:12px;margin-top:6px">Пусть друзья сохранят её в закладки — пригодится, если адрес игры сменится.</div></div></div>` : ''}
      ${pub ? '' : '<p style="font-size:13px;margin-top:14px;color:#ffb46b">⚠ Ссылка для интернета ещё не готова — сейчас по ней смогут зайти только из вашей Wi-Fi сети. Подождите полминуты и откройте это окно снова.</p>'}`);
    const sb = document.getElementById('shareBtn');
    if (sb) sb.onclick = () => navigator.share({ title: 'PokerCircle', text: `Заходи играть в покер! Стол № ${st.room.id}`, url }).catch(() => { });
  }
  function rulesModal() {
    modal(`${head('Правила Техасского Холдема')}<div class="rules">
      <p>Цель — выиграть фишки соперников: собрать лучшую комбинацию из пяти карт или заставить всех сбросить карты.</p>
      <h4>Раздача</h4><ul>
        <li>Кнопка дилера <b>D</b> переходит по часовой стрелке после каждой раздачи.</li>
        <li>Игрок слева от кнопки ставит <b>малый блайнд</b>, следующий — <b>большой блайнд</b>. При игре вдвоём кнопка ставит малый блайнд.</li>
        <li>Если за столом есть <b>анте</b> — его вносит каждый игрок до раздачи.</li>
        <li>Каждый получает две закрытые карты — <b>карманные карты</b>.</li></ul>
      <h4>Круги торговли</h4><ol>
        <li><b>Префлоп</b> — после раздачи. Первым ходит игрок слева от большого блайнда.</li>
        <li><b>Флоп</b> — на стол выкладываются три общие карты.</li>
        <li><b>Тёрн</b> — четвёртая общая карта.</li>
        <li><b>Ривер</b> — пятая общая карта.</li>
        <li><b>Вскрытие</b> — оставшиеся игроки открывают карты.</li></ol>
      <p>Перед каждой общей картой дилер «сжигает» одну карту. После флопа первым ходит первый активный игрок слева от кнопки.</p>
      <h4>Действия</h4><ul>
        <li><b>Фолд</b> — сбросить карты и выйти из раздачи.</li>
        <li><b>Чек</b> — пропустить ход, если ставок нет.</li>
        <li><b>Колл</b> — уравнять текущую ставку.</li>
        <li><b>Ставка / Рейз</b> — поставить или повысить. Минимальное повышение — не меньше предыдущего повышения (и не меньше большого блайнда).</li>
        <li><b>Олл-ин</b> — поставить все фишки. Неполный олл-ин не открывает торги заново для тех, кто уже ходил.</li></ul>
      <h4>Банки</h4><p>Если игрок идёт олл-ин на меньшую сумму, создаётся <b>побочный банк</b>: он может выиграть только ту часть, которую уравнял. Неуравненная ставка возвращается.</p>
      <h4>Вскрытие</h4><p>Каждый собирает лучшую комбинацию из пяти карт среди своих двух и пяти общих (можно использовать любые, в том числе только общие). При равенстве банк делится поровну, лишняя фишка достаётся первому игроку слева от кнопки. Масти между собой равны.</p>
      <h4>Время на ход</h4><p>Если время вышло — автоматически делается чек, если он возможен, иначе фолд.</p>
      <h4>Горячие клавиши</h4><p><b>F</b> — фолд, <b>C</b> — чек/колл, <b>R</b> — рейз, стрелки ↑/↓ — изменить размер ставки.</p>
    </div>`, true);
  }
  function combosModal() {
    const C = s => s.split(' ').map(x => ({ r: '23456789TJQKA'.indexOf(x[0]) + 2, s: x[1] }));
    const list = [
      ['Роял-флеш', 'A♠ K♠ Q♠ J♠ 10♠ — старший стрит одной масти', 'As Ks Qs Js Ts'],
      ['Стрит-флеш', 'Пять карт подряд одной масти', '9h 8h 7h 6h 5h'],
      ['Каре', 'Четыре карты одного достоинства', 'Kc Kd Kh Ks 7d'],
      ['Фулл-хаус', 'Тройка + пара', 'Qs Qh Qd 9c 9s'],
      ['Флеш', 'Пять карт одной масти', 'Ad Jd 8d 6d 2d'],
      ['Стрит', 'Пять карт подряд (A-2-3-4-5 — самый младший)', 'Tc 9d 8s 7h 6c'],
      ['Тройка (сет)', 'Три карты одного достоинства', '7s 7h 7c Kd 2s'],
      ['Две пары', 'Две разные пары', 'Jh Jc 4d 4s Ac'],
      ['Пара', 'Две карты одного достоинства', 'Ah As 9c 6d 3h'],
      ['Старшая карта', 'Ничего не собрано — решает старшая карта', 'Ac Qd 9h 6s 3c']
    ];
    modal(`${head('Покерные комбинации')}<p class="muted" style="margin-top:-6px">От старшей к младшей:</p>` + list.map(([n, d, c], i) =>
      `<div class="combo"><span class="n">${i + 1}</span><span class="name">${n}</span><span class="cards">${C(c).map(x => cardHTML(x, 'sm')).join('')}</span><span class="d">${d}</span></div>`).join(''), true);
  }
  function tourModal() {
    const tours = S.rooms.filter(r => r.mode === 'tournament');
    modal(`${head('Турниры')}
      <p class="muted" style="margin-top:-6px">Все начинают с одинаковым стеком, блайнды растут по расписанию, докупки нет. Побеждает тот, кто заберёт все фишки.</p>
      ${tours.length ? tours.map(r => `<div class="friend" style="cursor:pointer" data-room="${r.id}" data-private="${r.isPrivate ? 1 : 0}"><div class="ava" style="background:#2a2a40">🏆</div><div style="flex:1">${r.isPrivate ? '🔒 ' : ''}${esc(r.name)}<small>${r.players}/${r.maxSeats} игроков · ${fmt(r.sb)}/${fmt(r.bb)} · ${r.started ? 'идёт' : 'регистрация'}</small></div><span class="tag gold">Стол № ${r.id}</span></div>`).join('') : '<div class="empty">Сейчас нет турниров. Создайте свой!</div>'}
      <div class="foot"><button class="btn btn-gold" id="tCreate">Создать турнир</button></div>`, false);
    $('#tCreate').onclick = () => createRoomModal('tournament');
  }
  function histModal() {
    const g = (S.stats && S.stats.games) || [];
    modal(`${head('История игр')}<div class="games-list panel">${g.length ? g.map(x => `<div class="g"><span>${esc(x.room)} · раздача № ${x.no}<br><small class="muted">${new Date(x.time).toLocaleString('ru-RU')}</small></span><span class="${x.net > 0 ? 'w' : 'lz'}">${x.net != null ? (x.net > 0 ? '+' : x.net < 0 ? '−' : '') + fmt(Math.abs(x.net)) : esc(x.result || '')}</span></div>`).join('') : '<div class="empty" style="border:0">Вы ещё не сыграли ни одной раздачи</div>'}</div>`);
    send('stats');
  }
  function notesModal() {
    S.unread = 0; $('#bellN').hidden = true;
    modal(`${head('Уведомления')}${S.notes.length ? S.notes.map(n => `<div class="friend"><div style="flex:1">${esc(n.text)}<small>${new Date(n.time).toLocaleTimeString('ru-RU')}</small></div></div>`).join('') : '<div class="empty">Новых уведомлений нет</div>'}`);
  }
  function onlineModal() {
    modal(`${head('Кто онлайн')}${S.online.map(u => `<div class="friend"><div class="ava" style="background:${avBg(u.avatar)}">${esc(u.avatar)}</div><div>${esc(u.name)}<small>${u.room ? 'За столом «' + esc(u.room) + '»' : 'В лобби'}</small></div></div>`).join('')}
      <div class="foot"><button class="btn btn-gold" data-close id="oInvite">Пригласить друзей</button></div>`);
    $('#oInvite').onclick = () => setTimeout(() => (S.roomId ? inviteModal() : go('lobby')), 0);
  }

  // ───────── Профиль и настройки ─────────
  function bonusText(ms) {
    if (ms <= 0) return '🎁 Забрать бонус +20 000';
    const t = Math.ceil(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), sec = t % 60;
    return `🎁 Бонус через ${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  // обратный отсчёт бонуса идёт каждую секунду
  setInterval(() => {
    const b = document.getElementById('bonusBtn'); if (!b || S.view !== 'profile' || !S.wallet) return;
    const left = Math.max(0, S.wallet.bonusIn - (Date.now() - S.wallet.at));
    b.textContent = bonusText(left); b.disabled = left > 0;
  }, 1000);
  function renderProfile() {
    const s = Object.assign({ hands: 0, wins: 0, biggest: 0, won: 0, net: 0, best: null, games: [] }, S.stats || {});
    const w = S.wallet || { balance: 0, bonusIn: 0, at: Date.now() };
    const bonusLeft = Math.max(0, w.bonusIn - (Date.now() - w.at));
    const netCls = n => (n > 0 ? 'p' : n < 0 ? 'm' : 'z');
    const netTxt = n => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n));
    const games = (s.games || []).filter(g => g.cards);
    const phone = S.me.phone ? S.me.phone.replace(/^(\+\d{3})(\d{2})(\d+)(\d{2})$/, (m, a, b, c, d) => `${a} ${b} ${'•'.repeat(c.length)} ${d}`) : '';
    $('#profileBox').innerHTML = `<h2 style="margin:0 0 16px">Мой кабинет</h2>
      <div class="panel wallet-big">
        <i class="chip-ico"></i>
        <div style="flex:1;min-width:160px"><div class="v">${fmt(w.balance)}</div><div class="l">фишек на балансе · игровые, без денег</div></div>
        <button class="btn btn-gold" id="bonusBtn" ${bonusLeft > 0 ? 'disabled' : ''}>${bonusText(bonusLeft)}</button>
      </div>
      <div class="panel" style="padding:18px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-top:14px">
        <div class="ava" style="width:78px;height:78px;font-size:40px;border:3px solid var(--gold);background:${avBg(S.me.avatar)}">${esc(S.me.avatar)}</div>
        <div style="flex:1;min-width:220px">
          <div class="field" style="margin-bottom:8px"><label>Имя в игре</label><input class="input" id="pfName" maxlength="18" value="${esc(S.me.name)}"></div>
          <div class="muted" style="font-size:13px;margin-bottom:10px">📱 ${esc(phone)}</div>
          ${S.me.rc ? `<div class="rc-row"><span>🔑 Код восстановления:</span> <b id="pfRc" class="rc-hidden" title="Нажмите, чтобы показать">${esc(S.me.rc)}</b> <button class="btn btn-ghost" id="pfRcCopy">Копировать</button></div>` : ''}
          <div class="avatars" id="pfAva">${AVATARS.map(a => `<button class="av-opt${a === S.me.avatar ? ' sel' : ''}" data-a="${a}" style="background:${avBg(a)}">${a}</button>`).join('')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;min-width:190px">
          <input class="input" id="pfPin" type="password" maxlength="40" placeholder="Новый пароль (необязательно)" autocomplete="new-password">
          <button class="btn btn-gold" id="pfSave">Сохранить</button>
          <button class="btn btn-ghost" id="pfLogout">Выйти из аккаунта</button>
        </div>
      </div>
      <div class="cards-row">
        <div class="panel stat"><div class="v" style="color:${s.net >= 0 ? 'var(--green)' : '#ff6b7d'}">${netTxt(s.net || 0)}</div><div class="l">Итог за всё время</div></div>
        <div class="panel stat"><div class="v">${fmt(s.hands)}</div><div class="l">Сыграно раздач</div></div>
        <div class="panel stat"><div class="v">${fmt(s.wins)}</div><div class="l">Выиграно банков (${s.hands ? Math.round(s.wins / s.hands * 100) : 0}%)</div></div>
        <div class="panel stat"><div class="v">${fmt(s.biggest)}</div><div class="l">Самый большой банк</div></div>
        <div class="panel stat"><div class="v" style="font-size:17px">${s.best ? esc(s.best.desc) : '—'}</div><div class="l">Лучшая комбинация</div></div>
      </div>
      <div class="prof-grid">
        <div><h3 style="margin:6px 0 10px">История игр</h3>
          <div class="panel">${games.length ? games.map(g => `<div class="hist-row">
            <div><div class="top"><b>${esc(g.room)}</b><span class="when">раздача № ${g.no} · ${new Date(g.time).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span></div>
              <div class="muted" style="font-size:12.5px;margin-top:3px">${esc(g.desc || '')}${g.players ? ' · ' + esc(g.players.join(', ')) : ''}</div></div>
            <div class="net ${netCls(g.net)}">${netTxt(g.net)}</div>
            <div class="cards">Мои: <span class="mini-cards">${(g.cards || []).map(miniCard).join('')}</span>${g.board && g.board.length ? ` Стол: <span class="mini-cards">${g.board.map(miniCard).join('')}</span>` : ''}</div>
          </div>`).join('') : '<div class="empty" style="border:0">Здесь появятся ваши раздачи — с картами и результатом</div>'}</div></div>
        <div><h3 style="margin:6px 0 10px">🏆 Рейтинг игроков</h3>
          <div class="panel">${S.leaders.length ? S.leaders.map((l, i) => `<div class="leader"><span class="pos">${i + 1}</span><div class="ava" style="background:${avBg(l.avatar)}">${esc(l.avatar || '🦊')}</div><div class="nm">${esc(l.name)}<small>${fmt(l.hands)} раздач · ${fmt(l.wins)} побед</small></div><span class="v gold">${fmt(l.balance != null ? l.balance : l.net)}</span></div>`).join('') : '<div class="empty" style="border:0">Пока пусто</div>'}</div></div>
      </div>`;
    let av = S.me.avatar;
    $('#pfAva').onclick = e => { const b = e.target.closest('.av-opt'); if (!b) return; $$('#pfAva .av-opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); av = b.dataset.a; };
    $('#pfSave').onclick = () => {
      const np = $('#pfPin').value, nn = $('#pfName').value.trim();
      if (np && np.length < 4) return toast('Пароль — минимум 4 символа', true);
      if (nn.length < 2) return toast('Имя — минимум 2 буквы', true);
      S.me.avatar = av; S.me.name = nn; store.set('avatar', av);
      send('profile', { avatar: av, name: nn, newPin: np || undefined }); updateUser(); renderProfile(); toast('Сохранено');
    };
    $('#bonusBtn').onclick = () => send('bonus');
    if ($('#pfRc')) { $('#pfRc').onclick = () => $('#pfRc').classList.toggle('rc-hidden'); $('#pfRcCopy').onclick = () => { try { navigator.clipboard.writeText(S.me.rc); toast('Код скопирован'); } catch (e) { } }; }
    $('#pfLogout').onclick = () => $('#logoutBtn').click();
  }
  function renderSettings() {
    const V = window.DealerVoice; V.load();
    const voices = V.voices;
    const row = (title, sub, ctrl) => `<div class="set-row"><div class="l"><b>${title}</b><small>${sub}</small></div><div>${ctrl}</div></div>`;
    const tg = (k) => `<button class="toggle ${cfg[k] ? 'on' : ''}" data-cfg="${k}"></button>`;
    const rng = (k, min, max, step) => `<input type="range" data-rng="${k}" min="${min}" max="${max}" step="${step}" value="${cfg[k]}" style="width:180px;--p:${(cfg[k] - min) / (max - min) * 100}%">`;
    $('#settingsBox').innerHTML = `<h2 style="margin:0 0 16px">Настройки</h2>
      <div class="panel">
        ${row('Внешность дилера', 'Фото — как на вашем макете; рисованная — с мимикой и движением губ', `<div class="seg" id="dealerSeg" style="width:240px"><button data-dm="photo" class="${cfg.dealerMode === 'photo' ? 'on' : ''}">Фото</button><button data-dm="drawn" class="${cfg.dealerMode === 'drawn' ? 'on' : ''}">Рисованная</button></div>`)}
        ${row('Голос дилера', 'Дилер озвучивает раздачу, ставки и победителей', tg('voice'))}
        ${row('Голос', voices.length ? 'Выберите русский голос из установленных в системе' : '<span style="color:#ff8a98">Русские голоса не найдены. Установите русский язык речи в системе или откройте в Chrome/Edge.</span>',
      `<select class="select" id="voiceSel" style="width:240px">${['<option value="">Автовыбор (женский)</option>'].concat(voices.slice().sort((a, b) => DealerVoice.score(b) - DealerVoice.score(a)).map(v => `<option value="${esc(v.name)}" ${v.name === cfg.voiceName ? 'selected' : ''}>${DealerVoice.score(v) >= 40 ? '⭐ ' : ''}${esc(v.name)}</option>`)).join('')}</select>`)}
        ${DealerPack.voices.length ? row('Голос дилера', 'Студийный — живой записанный голос, одинаковый на всех устройствах', `<div class="seg" id="studioSeg" style="width:240px"><button data-st="1" class="${cfg.studio !== false ? 'on' : ''}">Студийный ✨</button><button data-st="0" class="${cfg.studio === false ? 'on' : ''}">Устройства</button></div>`) : ''}
        ${DealerPack.voices.length && cfg.studio !== false ? row('Чей голос', 'Нажмите на имя — дилер сразу заговорит этим голосом и представится своим именем', `<div class="voice-pick">${DealerPack.voices.map(v => `<button data-av="${esc(v.id)}" class="${v.id === DealerPack.id ? 'on' : ''}">🎙️ ${esc(v.name)}</button>`).join('')}</div>`) : ''}
        ${row('Манера речи', 'Бархатная — медленнее, ниже и с паузами; обычная — нейтрально', `<div class="seg" id="styleSeg" style="width:240px"><button data-vs="velvet" class="${cfg.voiceStyle === 'velvet' ? 'on' : ''}">Бархатная</button><button data-vs="normal" class="${cfg.voiceStyle !== 'velvet' ? 'on' : ''}">Обычная</button></div>`)}
        ${row('Сейчас говорит', DealerVoice.isNatural() ? '✅ Живой нейросетевой голос' : '⚠️ Голос звучит как робот. Откройте игру в <b>Microsoft Edge</b> — там есть живые голоса «Светлана» и «Дария» (Natural). На Android — Chrome, на iPhone — Safari.', `<b>${esc((DealerVoice.pick() || {}).name || 'нет')}</b>`)}
        ${row('Громкость голоса', '', rng('volume', 0, 1, .05))}
        ${row('Скорость речи', '', rng('rate', .7, 1.5, .05))}
        ${row('Высота голоса', '', rng('pitch', .7, 1.6, .05))}
        ${row('Озвучивать все действия', 'Чек, колл, фолд. Если выключить — только раздачи, ставки и итоги', tg('allActions'))}
        ${row('Проверить голос', '', '<button class="btn btn-dark" id="testVoice">▶ Прослушать</button>')}
      </div>
      <div class="panel" style="margin-top:14px">
        ${row('Звуки', 'Карты, фишки, сигнал хода', tg('sound'))}
        ${row('Громкость звуков', '', rng('soundVol', 0, 1, .05))}
        ${row('Четырёхцветная колода', 'Бубны — синие, трефы — зелёные', tg('four'))}
      </div>`;
    $('#settingsBox').onclick = e => {
      const av = e.target.closest('[data-av]');
      if (av) { ac(); cfg.alisaVoice = av.dataset.av; saveCfg(); DealerPack.stop(); renderSettings(); Dealer.say('Добро пожаловать. Я Алиса.', 'major', ['hello']); return; }
      const st = e.target.closest('[data-st]');
      if (st) { cfg.studio = st.dataset.st === '1'; saveCfg(); renderSettings(); return; }
      const vs = e.target.closest('[data-vs]');
      if (vs) { cfg.voiceStyle = vs.dataset.vs; if (vs.dataset.vs === 'velvet') { cfg.rate = 0.9; cfg.pitch = 0.93; } else { cfg.rate = 1; cfg.pitch = 1; } saveCfg(); renderSettings(); DealerVoice.stop(); DealerPack.stop(); Dealer.say('Добрый вечер. Я Алиса. Раздаю карты... удачи за столом.', 'major', ['greet_1']); return; }
      const dm = e.target.closest('[data-dm]');
      if (dm) { cfg.dealerMode = dm.dataset.dm; saveCfg(); $$('#dealerSeg button').forEach(b => b.classList.toggle('on', b === dm)); }
      const t = e.target.closest('[data-cfg]');
      if (t) { cfg[t.dataset.cfg] = !cfg[t.dataset.cfg]; saveCfg(); t.classList.toggle('on', cfg[t.dataset.cfg]); if (t.dataset.cfg === 'voice' && !cfg.voice) DealerVoice.stop(); }
      if (e.target.id === 'testVoice') { ac(); DealerVoice.stop(); DealerPack.stop(); const prev = cfg.voice; DealerVoice.enabled = true; Dealer.say('Добро пожаловать. Я Алиса. Флоп: туз пик, король червей, дама треф.', 'major', ['hello', 'flop', 'c_14s', 'c_13h', 'c_12c']); setTimeout(() => (DealerVoice.enabled = prev), 100); }
    };
    $('#settingsBox').oninput = e => {
      const r = e.target.closest('[data-rng]');
      if (r) { cfg[r.dataset.rng] = +r.value; r.style.setProperty('--p', (r.value - r.min) / (r.max - r.min) * 100 + '%'); saveCfg(); }
    };
    $('#voiceSel').onchange = e => { cfg.voiceName = e.target.value; saveCfg(); renderSettings(); };
  }

  // ───────── События интерфейса ─────────
  function bind() {
    document.addEventListener('click', e => {
      const g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); if (g.closest('.user')) e.stopPropagation(); }
      const cp = e.target.closest('[data-copy]');
      if (cp) { const v = cp.dataset.copy; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast('Скопировано'), () => { prompt('Скопируйте ссылку:', v); }); }
      const rc = e.target.closest('[data-room]');
      if (rc) { closeModal(); if (rc.dataset.room === S.roomId) go('table'); else send('joinRoom', { id: rc.dataset.room }); }
      const sit = e.target.closest('.empty-seat.can'); if (sit) buyInModal(+sit.dataset.sit);
      const a = e.target.closest('[data-a]'); if (a) doAction(a.dataset.a);
      const st = e.target.closest('[data-step]'); if (st && S.st && S.st.you) setRaise(S.raiseTo + (+st.dataset.step) * S.st.room.bb);
      const q = e.target.closest('[data-q]');
      if (q && S.st && S.st.you) {
        const y = S.st.you, potAfterCall = y.pot + y.toCall;
        const target = { min: y.minRaiseTo, half: y.myBet + y.toCall + potAfterCall / 2, pot: y.myBet + y.toCall + potAfterCall, all: y.maxRaiseTo }[q.dataset.q];
        setRaise(target);
      }
      const dd = e.target.closest('[data-do="rebuy"]'); if (dd) send('rebuy');
      if (e.target.closest('[data-do="resume"]')) send('pause', { on: false });
      const mySeat = e.target.closest('.seat.me .ring');
      if (mySeat) emotePop(mySeat);
      if (!e.target.closest('#userBtn')) $('#userMenu').hidden = true;
      if (!e.target.closest('#emojiBtn') && !e.target.closest('#emojiPop')) $('#emojiPop').hidden = true;
    });
    document.addEventListener('change', e => {
      const p = e.target.closest('[data-pre]');
      if (p) { S.pre = p.checked ? p.dataset.pre : null; S.actKey = ''; renderActions(); }
      const so = e.target.closest('[data-do="sitout"]'); if (so) send('sitout', { on: so.checked });
    });
    document.addEventListener('input', e => {
      if (e.target.id === 'raiseRange') setRaise(+e.target.value);
    });
    document.addEventListener('change', e => {
      if (e.target.id === 'raiseInput') setRaise(+String(e.target.value).replace(/\D/g, ''));
    });
    document.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea, select') && e.target.id !== 'raiseRange') { if (e.target.id === 'raiseInput' && e.key === 'Enter') { setRaise(+String(e.target.value).replace(/\D/g, '')); doAction('raise'); } return; }
      if (!S.st || !S.st.you || S.st.room.paused || S.view !== 'table') return;
      const k = e.key.toLowerCase();
      if (k === 'f' || k === 'а') doAction('fold');
      else if (k === 'c' || k === 'с') doAction(S.st.you.canCheck ? 'check' : 'call');
      else if ((k === 'r' || k === 'к') && S.st.you.canRaise) doAction('raise');
      else if (k === 'arrowup') { e.preventDefault(); setRaise(S.raiseTo + S.st.room.bb); }
      else if (k === 'arrowdown') { e.preventDefault(); setRaise(S.raiseTo - S.st.room.bb); }
    });
    $('#userBtn').onclick = e => { if (!e.target.closest('.menu')) $('#userMenu').hidden = !$('#userMenu').hidden; };
    $('#logoutBtn').onclick = () => { if (S.roomId) send('leaveRoom'); S.loggedIn = false; S.token = ''; store.set('token', ''); S.greeted = false; location.reload(); };
    $('#createBtn').onclick = $('#heroCreate').onclick = () => createRoomModal();
    $('#quickBtn').onclick = $('#heroQuick').onclick = () => send('quick');
    $('#privateBtn').onclick = $('#heroJoin').onclick = () => joinModal();
    $('#tourBtn').onclick = tourModal;
    $('#histBtn').onclick = histModal;
    $('#rulesBtn').onclick = rulesModal;
    $('#combosBtn').onclick = combosModal;
    $('#bellBtn').onclick = notesModal;
    $('#friendsBtn').onclick = onlineModal;
    $('#inviteBtn').onclick = inviteModal;
    $('#leaveBtn').onclick = () => {
      const me = S.st && S.st.mySeat >= 0 && S.st.seats[S.st.mySeat];
      if (me && me.inHand && S.st.hand && !S.st.hand.finished && !me.folded && !confirm('Вы в раздаче. Выйти и сбросить карты?')) return;
      send('leaveRoom');
    };
    $('#standBtn').onclick = () => send('stand');
    $('#botsBtn').onclick = botsModal;
    $('#pauseBtn').onclick = () => send('pause', { on: !(S.st && S.st.room.paused) });
    $('#resumeBtn').onclick = () => send('pause', { on: false });
    $('#rebuyBtn').onclick = () => send('rebuy');
    $('#startTourBtn').onclick = () => send('startTournament');
    $('#voiceToggle').onclick = () => { cfg.voice = !cfg.voice; saveCfg(); if (!cfg.voice) DealerVoice.stop(); };
    $('#chatToggle').onclick = () => $('#rightcol').classList.toggle('open');
    $('#tabbar').onclick = e => {
      const b = e.target.closest('[data-tab-go]'); if (!b) return;
      const t = b.dataset.tabGo;
      if (t === 'chat') { const open = !$('#rightcol').classList.contains('open'); $('#rightcol').classList.toggle('open', open); $('#chatDot').hidden = true; markTab(open ? 'chat' : S.view); return; }
      $('#rightcol').classList.remove('open');
      if (t === 'table' && !S.roomId) { toast('Сначала выберите или создайте стол'); go('lobby'); return; }
      go(t);
    };
    $('#sendBtn').onclick = sendChat;
    $('#chatInput').onkeydown = e => { if (e.key === 'Enter') sendChat(); };
    const EM = ['😀', '😂', '😎', '🤔', '😮', '😡', '👍', '👏', '🔥', '🍀', '💰', '🃏', '♠️', '♥️', '♦️', '♣️', '🎉', 'GG'];
    $('#emojiPop').innerHTML = EM.map(x => `<button>${x}</button>`).join('');
    $('#emojiPop').onclick = e => { const b = e.target.closest('button'); if (!b) return; $('#chatInput').value += (b.textContent === 'GG' ? ' GG ' : b.textContent); $('#chatInput').focus(); };
    $('#emojiBtn').onclick = () => ($('#emojiPop').hidden = !$('#emojiPop').hidden);
    $('#rtabs').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      $$('#rtabs button').forEach(x => x.classList.toggle('active', x === b));
      $('#chatList').hidden = b.dataset.tab !== 'chat'; $('#histList').hidden = b.dataset.tab !== 'hist'; $('#onlineList').hidden = b.dataset.tab !== 'online';
      if (!$('#histList').hidden && !$('#histList').children.length) $('#histList').innerHTML = '<div class="muted">Здесь появятся сыгранные раздачи</div>';
    };
    window.addEventListener('resize', () => fitStage());
    if (window.ResizeObserver) new ResizeObserver(() => fitStage()).observe($('#stageWrap'));
  }
  function emotePop(anchor) {
    const old = $('#emotePop'); if (old) { old.remove(); return; }
    const p = document.createElement('div'); p.id = 'emotePop'; p.className = 'emoji-pop'; p.style.position = 'fixed';
    const r = anchor.getBoundingClientRect(); p.style.left = (r.left - 40) + 'px'; p.style.top = (r.top - 110) + 'px'; p.style.bottom = 'auto'; p.style.right = 'auto'; p.style.zIndex = 60;
    p.innerHTML = ['👍', '😂', '😮', '😎', '😡', '🔥', '🍀', '💰', '🎉', '🤝', '😭', '🙏'].map(x => `<button>${x}</button>`).join('');
    p.onclick = e => { const b = e.target.closest('button'); if (b) send('emote', { e: b.textContent }); p.remove(); };
    document.body.appendChild(p); setTimeout(() => document.addEventListener('click', function h(ev) { if (!p.contains(ev.target)) { p.remove(); document.removeEventListener('click', h); } }), 0);
  }

  // ───────── Установка как приложение ─────────
  let installEvt = null;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('#installBtn').hidden = false; });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && !standalone) $('#installBtn').hidden = false;
  $('#installBtn').onclick = () => {
    if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(() => { installEvt = null; $('#installBtn').hidden = true; }); return; }
    modal(`${head('📲 Установить на телефон')}<div class="rules">
      <p>Иконка PokerCircle появится на главном экране — игра будет открываться как приложение, на весь экран.</p>
      <h4>iPhone (Safari)</h4><ol><li>Нажмите кнопку <b>«Поделиться»</b> ⬆️ внизу экрана</li><li>Выберите <b>«На экран „Домой“»</b></li><li>Нажмите <b>«Добавить»</b></li></ol>
      <h4>Android (Chrome)</h4><ol><li>Нажмите <b>⋮</b> вверху справа</li><li>Выберите <b>«Установить приложение»</b> или «Добавить на главный экран»</li></ol></div>`);
  };

  // ───────── Старт ─────────
  buildCity();
  Dealer.mode = cfg.dealerMode;
  Dealer.mount($('#stage'));
  $('#heroDealer').innerHTML = Dealer.markupFull();
  applyCfg();
  initLogin();
  bind();
  if (S.token) { S.loggedIn = true; $('#loginIp').textContent = 'Входим в ваш профиль…'; }
  connect();
  fetch('/api/info').then(r => r.json()).then(d => { S.lan = d.ips; S.port = d.port; if (d.publicUrl) S.publicUrl = d.publicUrl; if (d.sign) S.sign = d.sign; renderLan(); }).catch(() => { });
  requestAnimationFrame(tick);
})();
