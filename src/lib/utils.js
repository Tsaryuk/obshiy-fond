import { ROLES, CAT_SYNONYMS, DEMURRAGE_RATE, DEMURRAGE_THRESHOLD } from './constants';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const balColor = (b, T) => b > 50 ? "#4ade80" : b < -50 ? "#f87171" : (T?.text2 || "#94a3b8");

export const findM = (members, id) =>
  members.find(m => m.id === id) || { name: "Фонд", avatar: "∞", id: 0, systemRole: ROLES.member };

export const genCode = () => "FOND-" + Math.random().toString(36).slice(2, 6).toUpperCase();

export const today = () => new Date().toISOString().slice(0, 10);

export function initBalances(members, txs) {
  const b = Object.fromEntries(members.map(m => [m.id, 0]));
  txs.filter(t => t.status === "confirmed" || t.status === "active").forEach(t => {
    if (t.from > 0) b[t.from] = (b[t.from] || 0) - t.amount;
    if (t.to > 0) b[t.to] = (b[t.to] || 0) + t.amount;
  });
  return b;
}

export const walletNum = (id, joined) => {
  const yymm = (joined || "2024-03").replace("-", "").slice(0, 6);
  const num = String(id).replace(/\D/g, "") || String(id);
  return `ОФ-${yymm}-${num.padStart(4, "0")}`;
};

export const payPotential = (memberId, offers, balance) => {
  const offSum = offers
    .filter(o => o.member === memberId && o.available && (o.qty - o.reserved) > 0 && o.price > 0)
    .reduce((s, o) => s + o.price * (o.qty - o.reserved), 0);
  return balance + offSum;
};

export function matchSearch(offer, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const text = [offer.title, offer.desc, offer.category].join(" ").toLowerCase();
  if (text.includes(q)) return true;
  for (const [cat, syns] of Object.entries(CAT_SYNONYMS)) {
    const qMatchesCat = syns.some(s => q.includes(s) || s.startsWith(q));
    if (qMatchesCat && (offer.category === cat || syns.some(s => text.includes(s)))) return true;
  }
  return false;
}

export function calcDemurrage(balance, monthsHeld) {
  if (balance <= DEMURRAGE_THRESHOLD) return 0;
  const taxableAmount = balance - DEMURRAGE_THRESHOLD;
  return Math.floor(taxableAmount * DEMURRAGE_RATE * monthsHeld * 10) / 10;
}

export function getEffectiveBalance(memberId, balances, transactions) {
  const raw = balances[memberId] || 0;
  if (raw <= 0) return raw;
  const memberTxs = transactions.filter(t => (t.from === memberId || t.to === memberId) && t.status === "confirmed");
  if (memberTxs.length === 0) return raw;
  const lastDate = memberTxs.map(t => t.date).sort().reverse()[0];
  const todayStr = new Date().toISOString().slice(0, 10);
  const months = Math.max(0, (new Date(todayStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24 * 30));
  const demurrage = calcDemurrage(raw, months);
  return Math.max(0, raw - demurrage);
}
