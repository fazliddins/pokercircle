// Дилер: анимированная девушка (SVG) + русский голос (Web Speech API)
(function () {
  'use strict';
  const DEFS = `
  <defs>
    <linearGradient id="dSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7d7c0"/><stop offset="1" stop-color="#e9b597"/></linearGradient>
    <radialGradient id="dFace" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#fbe0cc"/><stop offset=".75" stop-color="#f0c2a5"/><stop offset="1" stop-color="#d99d7f"/></radialGradient>
    <linearGradient id="dHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2014"/><stop offset=".6" stop-color="#26130b"/><stop offset="1" stop-color="#160a05"/></linearGradient>
    <linearGradient id="dHairHi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4a2e" stop-opacity=".9"/><stop offset="1" stop-color="#3a2014" stop-opacity="0"/></linearGradient>
    <linearGradient id="dDress" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#23232c"/><stop offset=".45" stop-color="#0b0b10"/><stop offset="1" stop-color="#030305"/></linearGradient>
    <linearGradient id="dSheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="dArm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2a98a"/><stop offset=".5" stop-color="#f6d3bb"/><stop offset="1" stop-color="#e2a98a"/></linearGradient>
    <linearGradient id="dLip" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8394f"/><stop offset="1" stop-color="#d7566b"/></linearGradient>
    <pattern id="dCardBack" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#2a3ab0"/><rect width="1.4" height="5" fill="#5b6ce0"/></pattern>
  </defs>`;

  const BACK = `
  <svg viewBox="0 0 320 360" xmlns="http://www.w3.org/2000/svg">${DEFS}
    <!-- волосы сзади -->
    <path fill="url(#dHair)" d="M160 30 C 104 30 80 74 82 128 C 84 170 64 198 62 238 C 60 276 72 304 98 322 L 128 300 C 118 270 120 240 128 214 L 192 214 C 200 240 202 270 192 300 L 222 322 C 248 304 260 276 258 238 C 256 198 236 170 238 128 C 240 74 216 30 160 30 Z"/>
    <path fill="none" stroke="#5c3520" stroke-width="2" opacity=".45" d="M96 140 C 90 180 76 210 78 250 M224 140 C 230 180 244 210 242 250 M88 200 C 80 230 86 270 100 300"/>
    <g class="torso">
      <path fill="url(#dSkin)" d="M148 158 L146 192 Q160 202 174 192 L172 158 Z"/>
      <path fill="#c98468" opacity=".35" d="M147 166 Q160 182 173 166 L173 174 Q160 188 147 174 Z"/>
      <path fill="url(#dSkin)" d="M88 224 Q98 196 146 188 L174 188 Q222 196 232 224 L238 320 L82 320 Z"/>
      <path fill="none" stroke="#c98a6c" stroke-width="1.1" opacity=".5" d="M124 203 Q138 208 150 205 M196 203 Q182 208 170 205"/>
      <!-- платье -->
      <path fill="url(#dDress)" d="M84 238 Q94 214 124 207 L160 262 L196 207 Q226 214 236 238 L246 360 L74 360 Z"/>
      <path fill="url(#dSheen)" d="M96 250 Q120 236 150 268 L140 360 L100 360 Z" opacity=".8"/>
      <path fill="#0a0a0e" d="M119 209 L127 189 L131 190 L125 210 Z M201 209 L193 189 L189 190 L195 210 Z"/>
      <path fill="none" stroke="#3a3a46" stroke-width="1" d="M124 207 L160 262 L196 207"/>
      <!-- колье -->
      <path fill="none" stroke="#e8c77a" stroke-width="1.2" d="M143 190 Q160 214 177 190"/>
      <circle cx="160" cy="207" r="2.8" fill="#f7dc95"/><circle cx="160" cy="207" r="1.2" fill="#fff" opacity=".8"/>
    </g>
    <g class="head"><g class="head-idle">
      <path fill="url(#dFace)" d="M160 64 C 131 64 119 91 121 120 C 123 149 142 172 160 174 C 178 172 197 149 199 120 C 201 91 189 64 160 64 Z"/>
      <ellipse cx="139" cy="139" rx="9" ry="5" fill="#f28a8a" opacity=".25"/>
      <ellipse cx="181" cy="139" rx="9" ry="5" fill="#f28a8a" opacity=".25"/>
      <!-- тени век (макияж) -->
      <path d="M131 118 Q143 104 157 115 Q144 109 131 118 Z" fill="#9a5a6a" opacity=".38"/>
      <path d="M189 118 Q177 104 163 115 Q176 109 189 118 Z" fill="#9a5a6a" opacity=".38"/>
      <!-- глаза -->
      <g class="eye l">
        <path d="M133 119 Q143.5 108.5 155.5 117.5 Q145 125 133 119 Z" fill="#fff"/>
        <g class="pupils"><circle cx="144.5" cy="118" r="5" fill="#6b4226"/><circle cx="144.5" cy="118" r="5" fill="none" stroke="#2a160c" stroke-width=".8"/><circle cx="144.5" cy="118" r="2.4" fill="#120804"/><circle cx="146.3" cy="116.2" r="1.4" fill="#fff"/><circle cx="143" cy="120" r=".6" fill="#fff" opacity=".7"/></g>
        <path d="M131.5 119.5 Q143 107 156.5 117" fill="none" stroke="#120804" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M132.5 118.6 L127.5 115.4 M134.5 115.8 L131 111.8 M137.5 113.2 L135.6 109" stroke="#120804" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M135 121 Q145 125.6 154.5 119" fill="none" stroke="#7a4a3a" stroke-width=".8" opacity=".6"/>
      </g>
      <g class="eye r">
        <path d="M187 119 Q176.5 108.5 164.5 117.5 Q175 125 187 119 Z" fill="#fff"/>
        <g class="pupils"><circle cx="175.5" cy="118" r="5" fill="#6b4226"/><circle cx="175.5" cy="118" r="5" fill="none" stroke="#2a160c" stroke-width=".8"/><circle cx="175.5" cy="118" r="2.4" fill="#120804"/><circle cx="177.3" cy="116.2" r="1.4" fill="#fff"/><circle cx="174" cy="120" r=".6" fill="#fff" opacity=".7"/></g>
        <path d="M188.5 119.5 Q177 107 163.5 117" fill="none" stroke="#120804" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M187.5 118.6 L192.5 115.4 M185.5 115.8 L189 111.8 M182.5 113.2 L184.4 109" stroke="#120804" stroke-width="1.3" stroke-linecap="round"/>
        <path d="M185 121 Q175 125.6 165.5 119" fill="none" stroke="#7a4a3a" stroke-width=".8" opacity=".6"/>
      </g>
      <!-- брови: мягкая дуга -->
      <path d="M130 104.5 Q140 96 155 100.5 Q154.5 102.2 153 102 Q141 99.5 131 106 Z" fill="#2a160c"/>
      <path d="M190 104.5 Q180 96 165 100.5 Q165.5 102.2 167 102 Q179 99.5 189 106 Z" fill="#2a160c"/>
      <!-- нос -->
      <path d="M161.5 124 Q160 134 157 139" fill="none" stroke="#d09276" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>
      <path d="M155.5 140 Q160 143 164.5 140" fill="none" stroke="#c07e64" stroke-width="1.3" stroke-linecap="round"/>
      <!-- губы с лёгкой улыбкой -->
      <ellipse class="mouth-in" cx="160" cy="154" rx="8.6" ry="4" fill="#4a1520"/>
      <path class="lip-up" d="M147.5 151.6 Q154 147.6 160 150 Q166 147.6 172.5 151.6 Q166 152.8 160 153.1 Q154 152.8 147.5 151.6 Z" fill="url(#dLip)"/>
      <path class="lip-lo" d="M148.5 152 Q160 163.5 171.5 152 Q160 155.4 148.5 152 Z" fill="#d85d72"/>
      <path class="lip-lo" d="M155 157.6 Q160 159 165 157.6" stroke="#fff" stroke-width="1" opacity=".4" fill="none"/>
      <path d="M147.6 151.6 Q146.4 150.2 145.4 150.4 M172.4 151.6 Q173.6 150.2 174.6 150.4" stroke="#b5705a" stroke-width="1" fill="none" opacity=".7"/>
      <!-- волосы спереди: косой пробор и волны -->
      <path fill="url(#dHair)" d="M111 126 C 103 76 130 42 163 41 C 198 40 220 72 210 128 C 206 106 199 92 189 82 C 184 97 170 104 154 106 C 170 97 177 87 179 75 C 160 86 136 98 121 109 C 116 114 113 119 111 126 Z"/>
      <path fill="url(#dHairHi)" d="M128 72 C 144 54 176 48 196 62 C 178 57 152 62 135 80 Z" opacity=".85"/>
      <path fill="none" stroke="#7b4a2c" stroke-width="1.4" opacity=".6" d="M179 76 C 176 88 168 98 156 104 M186 60 C 196 70 204 86 206 104"/>
      <path fill="url(#dHair)" d="M118 112 C 104 150 116 176 104 206 C 96 228 108 252 100 282 C 118 262 126 240 123 214 C 120 190 131 160 129 122 Z"/>
      <path fill="url(#dHair)" d="M202 112 C 216 150 204 176 216 206 C 224 228 212 252 220 282 C 202 262 194 240 197 214 C 200 190 189 160 191 122 Z"/>
      <path fill="none" stroke="#6b3f26" stroke-width="1.5" opacity=".55" d="M120 128 C 112 160 118 180 108 206 C 102 224 110 246 106 266 M200 128 C 208 160 202 180 212 206 C 218 224 210 246 214 266"/>
      <path d="M121 137 l0 6" stroke="#f7dc95" stroke-width="1.2"/><circle cx="121" cy="145" r="2.2" fill="#f7dc95"/>
      <path d="M199 137 l0 6" stroke="#f7dc95" stroke-width="1.2"/><circle cx="199" cy="145" r="2.2" fill="#f7dc95"/>
    </g></g>
  </svg>`;

  const FRONT = `
  <svg viewBox="0 0 320 360" xmlns="http://www.w3.org/2000/svg">${DEFS}
    <g class="arm-l">
      <path d="M100 214 Q86 240 84 274 Q100 300 122 318" fill="none" stroke="#d29a7c" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M100 214 Q86 240 84 274 Q100 300 122 318" fill="none" stroke="url(#dArm)" stroke-width="19.5" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- колода в левой руке -->
      <g transform="translate(118 300) rotate(-8)">
        <rect x="0" y="4" width="30" height="40" rx="3" fill="#e9e9ef"/><rect x="0" y="2" width="30" height="40" rx="3" fill="#f4f4f8"/>
        <rect x="0" y="0" width="30" height="40" rx="3" fill="#fff" stroke="#c9ccd8" stroke-width=".6"/>
        <rect x="2.5" y="2.5" width="25" height="35" rx="2" fill="url(#dCardBack)"/>
      </g>
      <path d="M116 316 Q126 306 140 312 Q146 318 138 326 Q126 332 116 326 Z" fill="#f2c9ad" stroke="#d29a7c" stroke-width=".8"/>
      <path d="M137 313 Q144 312 147 317 M138 319 Q145 319 147 323" stroke="#d29a7c" stroke-width=".9" fill="none"/>
    </g>
    <g class="arm-r">
      <path d="M220 214 Q234 240 236 274 Q222 300 200 318" fill="none" stroke="#d29a7c" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M220 214 Q234 240 236 274 Q222 300 200 318" fill="none" stroke="url(#dArm)" stroke-width="19.5" stroke-linecap="round" stroke-linejoin="round"/>
      <g class="deal-card" transform="translate(172 298) rotate(12)">
        <rect x="0" y="0" width="30" height="40" rx="3" fill="#fff" stroke="#c9ccd8" stroke-width=".6"/>
        <rect x="2.5" y="2.5" width="25" height="35" rx="2" fill="url(#dCardBack)"/>
      </g>
      <path d="M204 316 Q194 306 180 312 Q174 318 182 326 Q194 332 204 326 Z" fill="#f2c9ad" stroke="#d29a7c" stroke-width=".8"/>
      <path d="M183 313 Q176 312 173 317 M182 319 Q175 319 173 323" stroke="#d29a7c" stroke-width=".9" fill="none"/>
    </g>
  </svg>`;

  let uid = 0;
  const uniq = svg => { const p = 'dl' + (++uid) + '_'; return svg.replace(/id="d([A-Z])/g, `id="${p}$1`).replace(/url\(#d([A-Z])/g, `url(#${p}$1`); };

  // ───────── Голос ─────────
  const Voice = {
    enabled: true, volume: 1, rate: 0.9, pitch: 0.93, style: 'velvet', voiceName: '', allActions: true,
    voices: [], queue: [], speaking: false, onStart: null, onEnd: null,
    supported: 'speechSynthesis' in window,
    load() {
      if (!this.supported) return;
      const all = speechSynthesis.getVoices();
      this.voices = all.filter(v => /^ru/i.test(v.lang));
    },
    // Рейтинг голосов: нейросетевые (Natural/Online) звучат как живой человек
    score(v) {
      const n = v.name;
      let s = 0;
      if (/natural|neural|online/i.test(n)) s += 100;           // Edge: Svetlana / Dariya (Natural)
      if (/svetlana|светлана/i.test(n)) s += 30;
      if (/dariya|daria|дарья/i.test(n)) s += 25;
      if (/google/i.test(n)) s += 40;                          // Chrome / Android: Google русский
      if (/milena|katya|yuliya|anna/i.test(n)) s += 20;        // iPhone / Mac
      if (/premium|enhanced|улучш/i.test(n)) s += 30;
      if (/irina|pavel|desktop/i.test(n)) s -= 30;             // старые «роботные» голоса Windows
      if (/pavel|yuri|dmitr|maxim|male|муж|nikolai/i.test(n)) s -= 200;
      if (!v.localService) s += 5;
      return s;
    },
    pick() {
      if (!this.voices.length) this.load();
      if (this.voiceName) { const v = this.voices.find(v => v.name === this.voiceName); if (v) return v; }
      return this.voices.slice().sort((a, b) => this.score(b) - this.score(a))[0] || null;
    },
    isNatural() { const v = this.pick(); return !!v && this.score(v) >= 40; },
    speak(text, kind) {
      if (!this.supported || !this.enabled) return;
      if (kind === 'action' && !this.allActions) return;
      if (kind === 'info') return;
      // не копим очередь — дилер не должен отставать от игры
      if (this.queue.length > 2) this.queue = this.queue.filter(q => q.kind === 'major').slice(-2);
      this.queue.push({ text, kind });
      if (!this.speaking) this._next();
    },
    _next() {
      const item = this.queue.shift();
      if (!item) { this.speaking = false; return; }
      this.speaking = true;
      let clean = item.text.replace(/(\d)[\s  ](?=\d{3})/g, '$1').replace(/№/g, 'номер ').replace(/ — /g, ', ');
      // «бархатная» подача: мягкие паузы между фразами
      if (this.style === 'velvet') clean = clean.replace(/\. (?=\S)/g, '... ').replace(/, /g, ',  ').replace(/!/g, '.') + '...';
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = 'ru-RU';
      const v = this.pick(); if (v) u.voice = v;
      u.volume = this.volume; u.rate = this.rate; u.pitch = this.style === 'velvet' ? this.pitch : (v && this.score(v) >= 40 ? 1 : this.pitch);
      let done = false;
      const fin = () => { if (done) return; done = true; this.onEnd && this.onEnd(); setTimeout(() => this._next(), this.style === 'velvet' ? 700 : 200); };
      u.onstart = () => this.onStart && this.onStart(item.text);
      u.onend = fin; u.onerror = fin;
      setTimeout(fin, 1500 + clean.length * 110); // страховка на случай зависания синтеза
      try { speechSynthesis.speak(u); } catch (e) { fin(); }
    },
    stop() { this.queue = []; if (this.supported) speechSynthesis.cancel(); this.speaking = false; this.onEnd && this.onEnd(); }
  };
  if (Voice.supported) { Voice.load(); speechSynthesis.onvoiceschanged = () => Voice.load(); }

  // ───────── Студийный голос: заранее записанные фразы (public/voice/*.mp3) ─────────
  const Pack = {
    keys: null, name: '', id: '', voices: [], want: '', buffers: {}, queue: [], playing: false, use: true, onStart: null, onEnd: null, src: null,
    ctx() { return window.pcAudio ? window.pcAudio() : null; },
    async load() {
      try {
        const r = await fetch('voice/voices.json', { cache: 'no-cache' });
        if (!r.ok) return;
        this.voices = (await r.json()).voices || [];
        this.select(this.want);
        if (this.onLoad) this.onLoad();
      } catch (e) { }
    },
    // выбрать голос по id (alisa, mira, marina…)
    select(id) {
      this.want = id || this.want;
      const v = this.voices.find(x => x.id === this.want) || this.voices[0];
      if (!v) return;
      if (v.id !== this.id) { this.buffers = {}; this.id = v.id; this.name = v.name; this.keys = new Set(v.keys || []); }
    },
    ready() { return this.use && this.keys && this.keys.size > 0; },
    has(keys) { return this.ready() && Array.isArray(keys) && keys.length > 0 && keys.every(k => this.keys.has(k)); },
    async buf(k) {
      if (this.buffers[k]) return this.buffers[k];
      const c = this.ctx(); if (!c) throw new Error('no audio');
      const id = this.id;
      const ab = await (await fetch(`voice/${id}/${k}.mp3`)).arrayBuffer();
      const b = await new Promise((res, rej) => c.decodeAudioData(ab, res, rej));
      if (id === this.id) this.buffers[k] = b;
      return b;
    },
    preload() { if (this.keys) [...this.keys].reduce((p, k) => p.then(() => this.buf(k).catch(() => { })), Promise.resolve()); },
    play(keys, kind) {
      if (!Voice.enabled) return;
      if (kind === 'action' && !Voice.allActions) return;
      if (this.queue.length > 2) this.queue = this.queue.filter(q => q.kind === 'major').slice(-2);
      this.queue.push({ keys, kind });
      if (!this.playing) this.next();
    },
    async next() {
      const item = this.queue.shift();
      if (!item) { this.playing = false; this.onEnd && this.onEnd(); return; }
      this.playing = true; this.onStart && this.onStart();
      const c = this.ctx();
      try {
        if (c && c.state === 'suspended') await c.resume();
        for (const k of item.keys) {
          const b = await this.buf(k);
          await new Promise(res => {
            const src = c.createBufferSource(), g = c.createGain();
            g.gain.value = Voice.volume; src.buffer = b; src.connect(g).connect(c.destination);
            src.onended = res; this.src = src; src.start();
            setTimeout(res, b.duration * 1000 + 400);
          });
          await new Promise(r => setTimeout(r, 70));
        }
      } catch (e) { }
      this.src = null;
      setTimeout(() => this.next(), 260);
    },
    stop() { this.queue = []; try { this.src && this.src.stop(); } catch (e) { } this.playing = false; this.onEnd && this.onEnd(); }
  };
  Pack.load();

  // ───────── Управление анимацией ─────────
  const Dealer = {
    back: null, front: null, speech: null, speechTimer: null, talkTimer: null,
    mode: 'photo',
    markupFull() {
      if (this.mode === 'photo') return `<div class="dealer-photo hero"><img src="dealer.webp" alt="Дилер Алиса"></div>`;
      return `<div style="position:relative;width:100%;aspect-ratio:320/360">
        <div style="position:absolute;inset:0" class="dealer back dmini">${uniq(BACK)}</div>
        <div style="position:absolute;inset:0" class="dealer front dmini">${uniq(FRONT)}</div></div>`;
    },
    mount(stage) {
      this.back = document.createElement('div'); this.back.className = 'dealer back'; this.back.innerHTML = uniq(BACK);
      this.front = document.createElement('div'); this.front.className = 'dealer front'; this.front.innerHTML = uniq(FRONT);
      this.speech = document.createElement('div'); this.speech.className = 'speech hide';
      this.speech.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg><span></span>`;
      this.pBack = document.createElement('div'); this.pBack.className = 'dealer-photo back'; this.pBack.innerHTML = '<div class="ph-body"><img class="ph-base" src="dealer-base.webp" alt=""><div class="ph-head"><img src="dealer-head.webp" alt=""><img class="ph-mouth" src="dealer-mouth.webp" alt=""><img class="ph-jaw" src="dealer-jaw.webp" alt=""><img class="ph-blink2" src="dealer-blink2.webp" alt=""><img class="ph-blink" src="dealer-blink.webp" alt=""></div><img class="ph-armR" src="dealer-armR.webp" alt=""><img class="ph-armL" src="dealer-armL.webp" alt=""></div>';
      this.pFront = document.createElement('div'); this.pFront.className = 'dealer-photo front'; this.pFront.innerHTML = '<div class="ph-body"><img class="ph-base" src="dealer-base.webp" alt=""><img class="ph-armR" src="dealer-armR.webp" alt=""><img class="ph-armL" src="dealer-armL.webp" alt=""></div>';
      stage.appendChild(this.back); stage.appendChild(this.front); stage.appendChild(this.pBack); stage.appendChild(this.pFront); stage.appendChild(this.speech);
      this.speech.insertAdjacentHTML('beforeend', '<i class="bars"><b></b><b></b><b></b><b></b></i>');
      this.setMode(this.mode);
      Voice.onStart = () => this.talk(true);
      Voice.onEnd = () => this.talk(false);
      Pack.onStart = () => this.talk(true);
      Pack.onEnd = () => this.talk(false);
      this.lifeLoop();
    },
    // живость: моргание, повороты головы, лёгкие жесты в паузах
    lifeLoop() {
      const blink = () => {
        const e = this.pBack; if (!e) return;
        e.classList.remove('blink'); void e.offsetWidth; e.classList.add('blink');
        setTimeout(() => e.classList.remove('blink'), 260);
        if (Math.random() < .2) setTimeout(blink, 340);   // иногда — двойное моргание
      };
      const nextBlink = () => { this.blinkT = setTimeout(() => { blink(); nextBlink(); }, 2200 + Math.random() * 3800); };
      nextBlink();
      const idle = () => {
        this.idleT = setTimeout(() => {
          if (!document.hidden && !this.pBack.classList.contains('dealing')) {
            const r = Math.random();
            if (r < .45) this.look((Math.random() * 2 - 1) * .8, 0);
            else if (r < .7) this.cls('tilt', true), setTimeout(() => this.cls('tilt', false), 2200);
            else if (r < .85) this.gesture();
            else this.look(0, 0);
          }
          idle();
        }, 3500 + Math.random() * 4500);
      };
      idle();
    },
    setMode(m) {
      this.mode = m === 'drawn' ? 'drawn' : 'photo';
      const photo = this.mode === 'photo';
      [this.back, this.front].forEach(e => e && (e.hidden = photo));
      [this.pBack, this.pFront].forEach(e => e && (e.hidden = !photo));
    },
    els(sel) { return [this.back, this.front].filter(Boolean).flatMap(e => [...e.querySelectorAll(sel)]); },
    cls(name, on) { [this.back, this.front, this.pBack, this.pFront].forEach(e => e && e.classList.toggle(name, on)); },
    talk(on) { this.cls('talk', on); this.speech && this.speech.classList.toggle('talking', on); },
    say(text, kind, voice) {
      if (!this.speech) return;
      this.speech.querySelector('span').textContent = text;
      this.speech.classList.remove('hide');
      clearTimeout(this.speechTimer);
      this.speechTimer = setTimeout(() => this.speech.classList.add('hide'), 3500 + text.length * 40);
      const usePack = Pack.has(voice);
      if (usePack) Pack.play(voice, kind);
      else if (!Pack.ready()) Voice.speak(text, kind);   // голос устройства — только если студийного нет
      // если голос выключен — анимация всё равно показывает речь
      if (!Voice.enabled || (!usePack && !Voice.supported)) {
        this.talk(true); clearTimeout(this.talkTimer);
        this.talkTimer = setTimeout(() => this.talk(false), Math.min(4000, 600 + text.length * 55));
      }
    },
    flick() {
      // один взмах руки — одна карта
      [this.pBack, this.pFront].forEach(e => { if (!e) return; e.classList.remove('flick'); void e.offsetWidth; e.classList.add('flick'); });
      clearTimeout(this.flickT); this.flickT = setTimeout(() => this.cls('flick', false), 420);
    },
    deal(ms) {
      this.cls('dealing', true);
      clearTimeout(this.dealT);
      this.dealT = setTimeout(() => this.cls('dealing', false), ms);
    },
    gesture() { this.cls('gesture', false); void (this.front && this.front.offsetWidth); this.cls('gesture', true); setTimeout(() => this.cls('gesture', false), 1500); },
    nod() { this.cls('nod', true); setTimeout(() => this.cls('nod', false), 950); },
    // взгляд в сторону игрока: dx от -1 (слева) до 1 (справа)
    look(dx, dy) {
      dx = Math.max(-1, Math.min(1, dx || 0)); dy = Math.max(-1, Math.min(1, dy || 0));
      this.els('.head').forEach(h => (h.style.transform = `rotate(${dx * 6}deg)`));
      this.els('.pupils').forEach(p => (p.style.transform = `translate(${dx * 2.2}px, ${dy * 1.4}px)`));
      [this.pBack, this.pFront].forEach(e => { if (!e) return; e.style.setProperty('--look', dx * 4 + 'px'); e.style.setProperty('--hl', dx * 3.2 + 'deg'); e.style.setProperty('--hx', dx * 5 + 'px'); });
    }
  };

  window.Dealer = Dealer;
  window.DealerVoice = Voice;
  window.DealerPack = Pack;
})();
