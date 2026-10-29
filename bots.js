// Боты для покера: три уровня сложности.
// Решение строится на шансах выиграть (эквити), которые бот считает методом Монте-Карло:
// много раз раздаёт оставшиеся карты соперникам и на стол и смотрит, как часто его рука лучше.
'use strict';

const LEVELS = {
  easy: { name: 'Лёгкий', noise: 0.16, iters: 220, think: [500, 1300] },
  medium: { name: 'Средний', noise: 0.07, iters: 380, think: [600, 1600] },
  hard: { name: 'Сложный', noise: 0.025, iters: 650, think: [700, 2000] }
};

const NAMES = ['Артём', 'Вадим', 'Олег', 'Ирина', 'Макс', 'Дима', 'Лёха', 'Серёга', 'Катя', 'Тимур', 'Рустам', 'Жасур',
  'Нодир', 'Алишер', 'Бахтиёр', 'Камила', 'Санжар', 'Диёра', 'Шерзод', 'Азиз', 'Лола', 'Фарход', 'Миша', 'Настя'];

// ── быстрая оценка 7 карт: одно число, чем больше — тем сильнее
const B = 15;
function eval7(cards) {
  const cnt = new Array(15).fill(0), suitCnt = { s: 0, h: 0, d: 0, c: 0 };
  let mask = 0;
  for (const c of cards) { cnt[c.r]++; suitCnt[c.s]++; mask |= 1 << c.r; }
  const straightHigh = m => {
    if (m & (1 << 14)) m |= 1 << 1;               // туз как единица
    for (let h = 14; h >= 5; h--) {
      const need = 0b11111 << (h - 4);
      if ((m & need) === need) return h;
    }
    return 0;
  };
  // флеш и стрит-флеш
  let fs = null;
  for (const s in suitCnt) if (suitCnt[s] >= 5) fs = s;
  if (fs) {
    let fm = 0; const fr = [];
    for (const c of cards) if (c.s === fs) { fm |= 1 << c.r; fr.push(c.r); }
    const sf = straightHigh(fm);
    if (sf) return enc(8, [sf]);
    fr.sort((a, b) => b - a);
    return enc(5, fr.slice(0, 5));
  }
  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 14; r >= 2; r--) {
    if (cnt[r] === 4) quads.push(r); else if (cnt[r] === 3) trips.push(r);
    else if (cnt[r] === 2) pairs.push(r); else if (cnt[r] === 1) singles.push(r);
  }
  if (quads.length) {
    const k = Math.max(...[...trips, ...pairs, ...singles, ...quads.slice(1)]);
    return enc(7, [quads[0], k]);
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pr = Math.max(trips[1] || 0, pairs[0] || 0);
    return enc(6, [trips[0], pr]);
  }
  const st = straightHigh(mask);
  if (st) return enc(4, [st]);
  if (trips.length) return enc(3, [trips[0], ...singles.slice(0, 2)]);
  if (pairs.length >= 2) {
    const k = Math.max(pairs[2] || 0, singles[0] || 0);
    return enc(2, [pairs[0], pairs[1], k]);
  }
  if (pairs.length) return enc(1, [pairs[0], ...singles.slice(0, 3)]);
  return enc(0, singles.slice(0, 5));
}
function enc(cat, ks) { let v = cat; for (let i = 0; i < 5; i++) v = v * B + (ks[i] || 0); return v; }

// ── эквити против nOpp случайных рук
function equity(hole, board, nOpp, iters) {
  nOpp = Math.max(1, Math.min(nOpp, 5));
  const used = new Set([...hole, ...board].map(c => c.r * 4 + 'shdc'.indexOf(c.s)));
  const rest = [];
  for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) if (!used.has(r * 4 + s)) rest.push({ r, s: 'shdc'[s] });
  const needBoard = 5 - board.length;
  let score = 0;
  const deck = rest.slice();
  for (let it = 0; it < iters; it++) {
    // частичное перемешивание: берём нужное количество случайных карт
    const take = needBoard + nOpp * 2;
    for (let k = 0; k < take; k++) {
      const j = k + Math.floor(Math.random() * (deck.length - k));
      const t = deck[k]; deck[k] = deck[j]; deck[j] = t;
    }
    const full = board.concat(deck.slice(0, needBoard));
    const mine = eval7(hole.concat(full));
    let best = 0, ties = 0, lost = false;
    for (let o = 0; o < nOpp; o++) {
      const oh = [deck[needBoard + o * 2], deck[needBoard + o * 2 + 1]];
      const v = eval7(oh.concat(full));
      if (v > mine) { lost = true; break; }
      if (v === mine) ties++;
      best = Math.max(best, v);
    }
    if (!lost) score += ties ? 1 / (ties + 1) : 1;
  }
  return score / iters;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const spr0 = (stack, pot) => stack / Math.max(1, pot);
const chance = p => Math.random() < p;

// ── главное: что делает бот
// v — видимая боту ситуация (только то, что знает игрок за столом)
function decide(level, v) {
  const L = LEVELS[level] || LEVELS.medium;
  const { hole, board, toCall, pot, stack, myBet, currentBet, minRaise, bb, nOpp, canRaise, street, inPosition, facingRaises } = v;
  const maxTo = myBet + stack;
  let eq = equity(hole, board, nOpp, L.iters);
  eq = Math.max(0, Math.min(1, eq + rnd(-L.noise, L.noise)));
  const potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const betRatio = toCall / Math.max(1, pot);           // насколько большая ставка против нас
  // сильные игроки понимают: против крупной ставки диапазон соперника сильнее случайного
  if (level === 'hard') eq -= Math.min(0.12, betRatio * 0.09 + facingRaises * 0.03);
  if (level === 'medium') eq -= Math.min(0.08, betRatio * 0.05);
  const heads = nOpp <= 1;
  const strongLine = heads ? 0.62 : 0.5 + 0.06 * Math.min(nOpp, 4) / 2;   // порог «сильной руки» зависит от числа соперников
  const pre = street === 'preflop';

  const raiseTo = frac => {
    let to;
    if (pre) {
      // префлоп: открытие 2.5–3 ББ, против повышения — x3
      to = currentBet <= bb ? Math.round(bb * rnd(2.4, 3.2)) + (pot > bb * 2 ? Math.round(pot * 0.3) : 0) : Math.round(currentBet * rnd(2.6, 3.4));
    } else {
      const size = Math.max(minRaise, Math.round((pot + toCall) * frac));
      to = currentBet + size;
      if (currentBet === 0) to = Math.max(bb, Math.round(pot * frac));
    }
    const minTo = currentBet === 0 ? bb : currentBet + minRaise;
    to = Math.max(to, minTo);
    to = Math.round(to / 50) * 50 || to;
    if (to >= maxTo * 0.72) to = maxTo;                  // почти весь стек — тогда уж олл-ин
    return Math.min(to, maxTo);
  };
  const R = frac => ({ type: 'raise', amount: raiseTo(frac) });
  const CALL = { type: 'call' }, CHECK = { type: 'check' }, FOLD = { type: 'fold' };
  const passive = toCall === 0 ? CHECK : CALL;

  // ── префлоп: сила руки как в один на один (AA≈0.85, AK≈0.65, 72o≈0.35)
  if (pre) {
    let hs = equity(hole, [], 1, Math.round(L.iters * 0.8));
    hs = Math.max(0, Math.min(1, hs + rnd(-L.noise, L.noise) * 0.6));
    const T = {
      easy: { open: 0.78, call: 0.45, reraise: 0.84, limp: 0.36 },
      medium: { open: 0.62, call: 0.56, reraise: 0.76, limp: 0.5 },
      hard: { open: 0.58 + 0.012 * nOpp - (inPosition ? 0.03 : 0), call: 0.6, reraise: 0.72, limp: 0.6 }
    }[level] || {};
    const raised = currentBet > bb;                       // кто-то уже повысил
    if (!raised) {
      if (canRaise && hs >= T.open && (level !== 'easy' || chance(0.6))) return R(0);
      if (toCall === 0) return CHECK;                         // большой блайнд без повышения
      if (hs >= T.limp || (level === 'easy' && chance(0.5))) return CALL;
      return FOLD;
    }
    const big = toCall > stack * 0.35;
    if (canRaise && hs >= T.reraise + (big ? 0.05 : 0) && (level !== 'easy' || chance(0.4))) return big || spr0(stack, pot) < 1.5 ? { type: 'raise', amount: maxTo } : R(0);
    if (hs >= T.call + (big ? 0.1 : 0) + Math.min(0.08, facingRaises * 0.03) || hs > potOdds + 0.25) return CALL;
    if (level === 'easy' && toCall <= bb * 3 && chance(0.45)) return CALL;
    return FOLD;
  }

  if (level === 'easy') {
    // «рыба»: много коллирует, редко повышает, не блефует, иногда ошибается
    if (canRaise && eq > 0.78 && chance(0.55)) return R(rnd(0.4, 0.7));
    if (toCall === 0) return chance(0.12) && canRaise && eq > 0.5 ? R(0.5) : CHECK;
    if (toCall <= bb * 2 && chance(0.75)) return CALL;
    if (eq > potOdds * 0.7 || chance(0.22)) return toCall >= stack && eq < 0.45 && chance(0.6) ? FOLD : CALL;
    return FOLD;
  }

  if (level === 'medium') {
    if (canRaise && eq > strongLine + 0.05) return chance(0.8) ? R(rnd(0.5, 0.8)) : passive;
    if (toCall === 0) {
      if (canRaise && eq > strongLine - 0.08 && chance(0.55)) return R(rnd(0.4, 0.65));
      if (canRaise && !pre && inPosition && nOpp <= 2 && chance(0.09)) return R(rnd(0.4, 0.6));  // редкий блеф
      return CHECK;
    }
    if (eq > potOdds + 0.06) return CALL;
    if (pre && toCall <= bb && eq > 0.3) return CALL;
    return FOLD;
  }

  // ── сложный: позиция, размеры ставок, полублеф, ловушки, блеф
  const spr = stack / Math.max(1, pot);
  if (canRaise && eq > strongLine + 0.12) {
    if (!pre && street === 'flop' && toCall === 0 && chance(0.22)) return CHECK;        // ловушка с монстром
    if (spr < 1.3) return { type: 'raise', amount: maxTo };
    return R(rnd(0.6, 1.0));
  }
  if (canRaise && eq > strongLine) return toCall === 0 || chance(0.55) ? R(rnd(0.5, 0.75)) : CALL;
  if (toCall === 0) {
    // ставка-продолжение / полублеф / блеф по позиции
    if (canRaise && !pre && street !== 'river' && eq > 0.3 && chance(inPosition ? 0.42 : 0.24)) return R(rnd(0.33, 0.55));
    if (canRaise && street === 'river' && nOpp <= 1 && inPosition && chance(0.16)) return R(rnd(0.55, 0.8));
    if (canRaise && pre && eq > (heads ? 0.48 : 0.24 + 0.05 * nOpp) && chance(0.7)) return R(0);
    return CHECK;
  }
  if (pre) {
    if (canRaise && eq > (heads ? 0.6 : 0.3 + 0.06 * nOpp) && chance(0.6)) return R(0);
    if (eq > potOdds + 0.02 || (toCall <= bb && eq > 0.28)) return CALL;
    return FOLD;
  }
  if (eq > potOdds + 0.03) return canRaise && chance(0.08) && betRatio < 0.5 ? R(rnd(0.7, 1)) : CALL;
  if (canRaise && betRatio < 0.35 && nOpp <= 1 && chance(0.05)) return R(rnd(0.8, 1.1));     // редкий блеф-рейз
  return FOLD;
}

function thinkMs(level, big) {
  const L = LEVELS[level] || LEVELS.medium;
  return Math.round(rnd(L.think[0], L.think[1]) * (big ? 1.4 : 1));
}

const CHAT = {
  win: ['gg', 'Хорошая раздача 😎', 'Повезло 😏', 'Вот так вот', 'Ха!', 'Спасибо за фишки 🙂', 'nh'],
  bigLoss: ['Ну и ну…', 'Не повезло', 'Ривер, ты серьёзно?', '😤', 'Ладно, отыграюсь'],
  allin: ['Всё или ничего!', 'Олл-ин, господа', '🔥']
};

module.exports = { LEVELS, NAMES, decide, thinkMs, equity, eval7, CHAT };
