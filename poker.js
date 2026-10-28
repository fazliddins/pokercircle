// Логика техасского холдема: колода, оценка комбинаций, названия на русском
'use strict';
const crypto = require('crypto');

const SUITS = ['s', 'h', 'd', 'c'];
const RANK_NOM = { 2: 'двойка', 3: 'тройка', 4: 'четвёрка', 5: 'пятёрка', 6: 'шестёрка', 7: 'семёрка', 8: 'восьмёрка', 9: 'девятка', 10: 'десятка', 11: 'валет', 12: 'дама', 13: 'король', 14: 'туз' };
const RANK_GEN_PL = { 2: 'двоек', 3: 'троек', 4: 'четвёрок', 5: 'пятёрок', 6: 'шестёрок', 7: 'семёрок', 8: 'восьмёрок', 9: 'девяток', 10: 'десяток', 11: 'валетов', 12: 'дам', 13: 'королей', 14: 'тузов' };
const RANK_GEN_SG = { 2: 'двойки', 3: 'тройки', 4: 'четвёрки', 5: 'пятёрки', 6: 'шестёрки', 7: 'семёрки', 8: 'восьмёрки', 9: 'девятки', 10: 'десятки', 11: 'валета', 12: 'дамы', 13: 'короля', 14: 'туза' };
const SUIT_GEN = { s: 'пик', h: 'червей', d: 'бубен', c: 'треф' };
const CAT_NAMES = ['Старшая карта', 'Пара', 'Две пары', 'Тройка (сет)', 'Стрит', 'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш', 'Роял-флеш'];

// Колода, перемешанная криптостойким генератором (Фишер–Йетс)
function newDeck() {
  const d = [];
  for (const s of SUITS) for (let r = 2; r <= 14; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Оценка ровно 5 карт -> массив для сравнения [категория, кикеры...]
function eval5(cs) {
  const rs = cs.map(c => c.r).sort((a, b) => b - a);
  const flush = cs.every(c => c.s === cs[0].s);
  const uniq = [...new Set(rs)];
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (rs[0] - rs[4] === 4) straightHigh = rs[0];
    else if (rs[0] === 14 && rs[1] === 5 && rs[4] === 2) straightHigh = 5; // колесо A-2-3-4-5
  }
  const cnt = {};
  rs.forEach(r => (cnt[r] = (cnt[r] || 0) + 1));
  const groups = Object.entries(cnt).map(([r, c]) => [c, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const byGroup = groups.map(g => g[1]);
  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0][0] === 4) return [7, ...byGroup];
  if (groups[0][0] === 3 && groups[1][0] === 2) return [6, ...byGroup];
  if (flush) return [5, ...rs];
  if (straightHigh) return [4, straightHigh];
  if (groups[0][0] === 3) return [3, ...byGroup];
  if (groups[0][0] === 2 && groups[1][0] === 2) return [2, ...byGroup];
  if (groups[0][0] === 2) return [1, ...byGroup];
  return [0, ...rs];
}

function cmp(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

// Лучшая пятёрка из 5–7 карт
function best(cards) {
  let bestScore = null, bestCards = null;
  const n = cards.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++)
    for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) {
      const five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
      const sc = eval5(five);
      if (!bestScore || cmp(sc, bestScore) > 0) { bestScore = sc; bestCards = five; }
    }
  return { score: bestScore, cards: bestCards, desc: describe(bestScore), cat: catIndex(bestScore) };
}

function catIndex(score) { return score[0] === 8 && score[1] === 14 ? 9 : score[0]; }

function describe(s) {
  const [c, a, b] = s;
  switch (c) {
    case 8: return a === 14 ? 'Роял-флеш' : `Стрит-флеш до ${RANK_GEN_SG[a]}`;
    case 7: return `Каре ${RANK_GEN_PL[a]}`;
    case 6: return `Фулл-хаус: ${RANK_GEN_PL[a]} и ${RANK_GEN_PL[b]}`;
    case 5: return `Флеш до ${RANK_GEN_SG[a]}`;
    case 4: return `Стрит до ${RANK_GEN_SG[a]}`;
    case 3: return `Тройка ${RANK_GEN_PL[a]}`;
    case 2: return `Две пары: ${RANK_GEN_PL[a]} и ${RANK_GEN_PL[b]}`;
    case 1: return `Пара ${RANK_GEN_PL[a]}`;
    default: return `Старшая карта — ${RANK_NOM[a]}`;
  }
}

function cardName(c) { return `${RANK_NOM[c.r]} ${SUIT_GEN[c.s]}`; }

module.exports = { newDeck, eval5, best, cmp, describe, cardName, CAT_NAMES };
