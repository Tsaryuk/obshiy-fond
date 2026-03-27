import { useState, useMemo } from "react";
import { Avatar, Pill } from "./ui";
import { S_LABEL, S_COLOR, cur } from "../lib/constants";
import { findM } from "../lib/utils";
import useSwipe from "../hooks/useSwipe";

// ── helpers ──
const DAY_MS = 86400000;
const daysSince = (dateStr) => {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / DAY_MS);
};

const PIPELINE_STEPS = [
  { key: "active", label: "В работе", color: "#f97316" },
  { key: "awaiting_confirm", label: "Ожидание", color: "#818cf8" },
  { key: "confirmed", label: "Завершена", color: "#4ade80" },
];
const STEP_IDX = { active: 0, awaiting_confirm: 1, confirmed: 2, cancelled: -1 };

function PipelineBar({ status }) {
  const idx = STEP_IDX[status] ?? -1;
  return (
    <div style={{ display: "flex", gap: 3, margin: "8px 0 4px" }}>
      {PIPELINE_STEPS.map((s, i) => (
        <div key={s.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <div style={{
            width: "100%", height: 4, borderRadius: 2,
            background: i <= idx ? s.color : "#334155",
            transition: "background 0.3s",
          }} />
          <span style={{ fontSize: 9, color: i <= idx ? s.color : "#475569", fontWeight: i === idx ? 700 : 400 }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function StaleIndicator({ tx, T }) {
  const days = daysSince(tx.date);
  if (days < 3 || tx.status === "confirmed" || tx.status === "cancelled") return null;
  const urgent = days >= 7;
  return (
    <div style={{
      fontSize: 10, padding: "3px 8px", borderRadius: 6, marginTop: 6,
      background: urgent ? "#7f1d1d20" : "#78350f20",
      color: urgent ? "#f87171" : "#fbbf24",
      display: "flex", alignItems: "center", gap: 4,
    }}>
      {urgent ? "🔴" : "⚠️"} {days} дн. без действия
    </div>
  );
}

function TxCard({ tx, role, reviews, onReview, meId, members, T, onSelectMember, onConfirmTx, onCancelTx, onMarkDone, onOpenDispute }) {
  const other = role === "buyer" ? findM(members, tx.to) : findM(members, tx.from);
  const sc = S_COLOR[tx.status] || "#475569";
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 4 }}>{tx.what}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.text3 }}>
            <Avatar member={other} size={18} />
            <span onClick={() => onSelectMember(other.id)} style={{ cursor: "pointer", color: T.accent }}>{other.name}</span>
            <span style={{ fontSize: 11, fontFamily: "monospace", marginLeft: 4, color: T.text5 }}>{tx.date}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: role === "buyer" ? "#f87171" : "#4ade80" }}>
            {role === "buyer" ? "-" : "+"}{cur(tx.amount)}
          </div>
          <span style={{ fontSize: 10, background: `${sc}18`, color: sc, padding: "1px 6px", borderRadius: 5 }}>
            {S_LABEL[tx.status]}
          </span>
        </div>
      </div>

      <PipelineBar status={tx.status} />
      <StaleIndicator tx={tx} T={T} />

      {(tx.status === "active" || tx.status === "awaiting_confirm") && (
        <div style={{ display: "flex", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
          {role === "buyer" && tx.status === "active" && !tx.reqId && (
            <button onClick={() => onConfirmTx(tx.id)} style={btnStyle("#052e16", "#166534", "#4ade80")}>
              ✓ Подтвердить получение
            </button>
          )}
          {role === "buyer" && tx.status === "active" && tx.reqId && (
            <div style={{ fontSize: 11, color: "#818cf8", padding: "7px 10px", background: "#6366f110", borderRadius: 8, flex: 1, textAlign: "center" }}>
              ⏳ Ждём выполнения от исполнителя
            </div>
          )}
          {role === "buyer" && tx.status === "awaiting_confirm" && (
            <button onClick={() => onConfirmTx(tx.id)} style={btnStyle("#052e16", "#166534", "#4ade80")}>
              ✓ Принять работу
            </button>
          )}
          {role === "seller" && tx.status === "active" && tx.reqId && (
            <button onClick={() => onMarkDone && onMarkDone(tx.id)} style={btnStyle("#1e3a5f", "#1d4ed8", "#60a5fa")}>
              ✓ Выполнено
            </button>
          )}
          {role === "seller" && tx.status === "active" && !tx.reqId && (
            <div style={{ fontSize: 11, color: T.text5, padding: "7px 10px", background: T.border, borderRadius: 8, flex: 1, textAlign: "center" }}>
              в работе у покупателя
            </div>
          )}
          {role === "seller" && tx.status === "awaiting_confirm" && (
            <div style={{ fontSize: 11, color: "#4ade80", padding: "7px 10px", background: "#4ade8010", borderRadius: 8, flex: 1, textAlign: "center" }}>
              ✓ Ждём подтверждения заказчика
            </div>
          )}
          {((tx.status === "active" && !tx.reqId) || (tx.status === "active" && role === "buyer" && tx.reqId))
            ? <button onClick={() => onCancelTx && onCancelTx(tx.id)} style={{ background: T.input, border: "1px solid #7f1d1d", color: "#f87171", padding: "7px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              Отменить
            </button>
            : null}
        </div>
      )}

      {/* Dispute button for active/awaiting deals */}
      {(tx.status === "active" || tx.status === "awaiting_confirm") && onOpenDispute && (
        <button onClick={() => onOpenDispute(tx)} style={{
          marginTop: 7, width: "100%", background: "none", border: `1px solid ${T.border}`,
          color: T.text4, padding: "5px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
        }}>
          ⚖️ Открыть спор
        </button>
      )}

      {tx.status === "confirmed" && onReview && (
        (reviews || []).find(r => r.txId === tx.id && r.from === meId)
          ? <div style={{ marginTop: 7, fontSize: 11, color: "#4ade80", padding: "5px 10px", background: "#4ade8010", borderRadius: 8, textAlign: "center" }}>⭐ Отзыв оставлен</div>
          : <button onClick={() => onReview(tx)} style={{ marginTop: 7, width: "100%", background: T.input, border: `1px solid ${T.border}`, color: T.text3, padding: "5px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>⭐ Оставить отзыв</button>
      )}
    </div>
  );
}

function btnStyle(bg, border, color) {
  return { flex: 1, background: bg, border: `1px solid ${border}`, color, padding: "7px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" };
}

// ── Dispute Modal ──
function DisputeModal({ tx, T, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, maxWidth: 400, width: "100%" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12 }}>⚖️ Открыть спор</div>
        <div style={{ fontSize: 12, color: T.text3, marginBottom: 10 }}>Сделка: {tx.what} — {cur(tx.amount)}</div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Опишите причину спора..."
          style={{
            width: "100%", minHeight: 80, background: T.input, border: `1px solid ${T.border}`,
            borderRadius: 10, padding: 10, color: T.text, fontSize: 13, fontFamily: "inherit", resize: "vertical",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, background: "none", border: `1px solid ${T.border}`, color: T.text4, padding: "9px", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Отмена
          </button>
          <button
            onClick={() => { if (reason.trim()) { onSubmit(tx.id, reason.trim()); onClose(); } }}
            disabled={!reason.trim()}
            style={{
              flex: 1, background: "#7f1d1d", border: "1px solid #991b1b", color: "#fca5a5",
              padding: "9px", borderRadius: 10, fontSize: 13, cursor: reason.trim() ? "pointer" : "not-allowed",
              fontFamily: "inherit", opacity: reason.trim() ? 1 : 0.5,
            }}>
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stats Panel ──
function StatsPanel({ transactions, meId, T }) {
  const myTxs = transactions.filter(t => (t.from === meId || t.to === meId) && t.type === "exchange");
  const confirmed = myTxs.filter(t => t.status === "confirmed");
  const total = confirmed.length;
  const volume = confirmed.reduce((s, t) => s + t.amount, 0);
  const avgCheck = total > 0 ? Math.round(volume / total) : 0;

  // conversion: active+awaiting+confirmed / total deals started
  const started = myTxs.filter(t => t.status !== "cancelled").length;
  const conversion = started > 0 ? Math.round((total / started) * 100) : 0;

  const purchases = confirmed.filter(t => t.from === meId).length;
  const sales = confirmed.filter(t => t.to === meId).length;

  const stats = [
    { l: "Объём", v: cur(volume), c: "#4ade80" },
    { l: "Завершено", v: total, c: "#818cf8" },
    { l: "Ср. чек", v: cur(avgCheck), c: "#fbbf24" },
    { l: "Конверсия", v: `${conversion}%`, c: "#f97316" },
  ];

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text3, marginBottom: 8 }}>📊 Статистика</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.text4, marginBottom: 2 }}>{s.l}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#f87171" }}>↑ Покупки: {purchases}</span>
        <span style={{ fontSize: 11, color: "#4ade80" }}>↓ Продажи: {sales}</span>
      </div>
    </div>
  );
}

// ── Main Component ──
function DealsScreen({
  meId, members, transactions, requests, T, onBack,
  onConfirmTx, onCancelTx, onMarkDone, onCancelRequest, onCancelBid,
  onSelectMember, onOpenReq, reviews, onReview, onOpenDispute,
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // all | buy | sell
  const [searchQ, setSearchQ] = useState("");
  const [disputeTx, setDisputeTx] = useState(null);
  const swipe = useSwipe(onBack);

  // Gather all my deals
  const myDeals = useMemo(() => {
    return transactions
      .filter(t => t.type === "exchange" && (t.from === meId || t.to === meId))
      .map(t => ({ ...t, role: t.from === meId ? "buyer" : "seller" }));
  }, [transactions, meId]);

  // My open requests
  const myReqs = useMemo(() => requests.filter(r => r.member === meId), [requests, meId]);
  // My bids on others' requests
  const myBidReqs = useMemo(() =>
    requests.filter(r => r.bids.some(b => b.from === meId && b.status === "pending") && r.status === "open"),
    [requests, meId]
  );

  // Summary counts
  const activeCnt = myDeals.filter(t => t.status === "active" || t.status === "awaiting_confirm").length;
  const confirmedCnt = myDeals.filter(t => t.status === "confirmed").length;
  const staleCnt = myDeals.filter(t => (t.status === "active" || t.status === "awaiting_confirm") && daysSince(t.date) >= 3).length;

  // Apply filters for "all deals" tab
  const filteredDeals = useMemo(() => {
    let list = myDeals;
    if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
    if (typeFilter === "buy") list = list.filter(t => t.role === "buyer");
    if (typeFilter === "sell") list = list.filter(t => t.role === "seller");
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase().trim();
      list = list.filter(t => {
        const other = t.role === "buyer" ? findM(members, t.to) : findM(members, t.from);
        return t.what.toLowerCase().includes(q) || other.name.toLowerCase().includes(q);
      });
    }
    return list;
  }, [myDeals, statusFilter, typeFilter, searchQ, members]);

  const tabs = [
    { key: "all", l: "Все сделки" },
    { key: "active", l: `Активные (${activeCnt})` },
    { key: "reqs", l: "Запросы" },
    { key: "stats", l: "📊" },
  ];

  const handleDispute = (txId, reason) => {
    if (onOpenDispute) onOpenDispute(txId, reason);
  };

  // For "active" tab: only show active/awaiting deals
  const activeDeals = myDeals.filter(t => t.status === "active" || t.status === "awaiting_confirm");
  // Sort stale ones first
  const sortedActiveDeals = [...activeDeals].sort((a, b) => daysSince(b.date) - daysSince(a.date));

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans',sans-serif" }} {...swipe}>
      <div style={{ padding: "18px 20px 0" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.text4, fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          ← назад
        </button>
      </div>

      <div style={{ padding: "12px 20px 0" }}>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4, color: T.text }}>Мои сделки</div>

        {/* Summary stat boxes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7, marginBottom: 14 }}>
          {[
            { l: "Активных", v: activeCnt, c: "#fbbf24" },
            { l: "Завершено", v: confirmedCnt, c: "#4ade80" },
            { l: "Запросы", v: myReqs.filter(r => r.status === "open").length, c: "#818cf8" },
            { l: staleCnt > 0 ? "⚠️ Зависших" : "Зависших", v: staleCnt, c: staleCnt > 0 ? "#f87171" : "#475569" },
          ].map((s, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: T.text4, marginBottom: 2 }}>{s.l}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.v > 0 ? s.c : T.text5 }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, marginBottom: 14, overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              background: "none", border: "none", padding: "10px 0", marginRight: 14, fontSize: 12,
              fontWeight: activeTab === t.key ? 600 : 400, color: activeTab === t.key ? T.text : T.text4,
              borderBottom: activeTab === t.key ? `2px solid ${T.accent}` : "2px solid transparent",
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>{t.l}</button>
          ))}
        </div>

        {/* ── All Deals Tab ── */}
        {activeTab === "all" && (
          <div>
            {/* Filters row */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={selectStyle(T)}>
                <option value="all">Все статусы</option>
                <option value="active">В работе</option>
                <option value="awaiting_confirm">Ожидание</option>
                <option value="confirmed">Завершена</option>
                <option value="cancelled">Отменена</option>
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                style={selectStyle(T)}>
                <option value="all">Все типы</option>
                <option value="buy">Покупки</option>
                <option value="sell">Продажи</option>
              </select>
            </div>
            {/* Search */}
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="🔍 Поиск по сделкам..."
              style={{
                width: "100%", padding: "9px 12px", background: T.input, border: `1px solid ${T.border}`,
                borderRadius: 10, color: T.text, fontSize: 13, fontFamily: "inherit", marginBottom: 12,
                boxSizing: "border-box",
              }}
            />
            {filteredDeals.length === 0 && (
              <div style={{ textAlign: "center", color: T.text5, padding: "28px 0", fontSize: 13 }}>Нет сделок</div>
            )}
            {filteredDeals.map(tx => (
              <TxCard key={tx.id} tx={tx} role={tx.role} reviews={reviews} onReview={onReview} meId={meId}
                members={members} T={T} onSelectMember={onSelectMember}
                onConfirmTx={onConfirmTx} onCancelTx={onCancelTx} onMarkDone={onMarkDone}
                onOpenDispute={(tx) => setDisputeTx(tx)} />
            ))}
          </div>
        )}

        {/* ── Active Deals Tab ── */}
        {activeTab === "active" && (
          <div>
            {staleCnt > 0 && (
              <div style={{
                background: "#78350f15", border: "1px solid #78350f40", borderRadius: 10,
                padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#fbbf24",
              }}>
                ⚠️ {staleCnt} {staleCnt === 1 ? "сделка зависла" : "сделок зависли"} (более 3 дней без действия)
              </div>
            )}
            {sortedActiveDeals.length === 0 && (
              <div style={{ textAlign: "center", color: T.text5, padding: "28px 0", fontSize: 13 }}>Нет активных сделок</div>
            )}
            {sortedActiveDeals.map(tx => (
              <TxCard key={tx.id} tx={tx} role={tx.role} reviews={reviews} onReview={onReview} meId={meId}
                members={members} T={T} onSelectMember={onSelectMember}
                onConfirmTx={onConfirmTx} onCancelTx={onCancelTx} onMarkDone={onMarkDone}
                onOpenDispute={(tx) => setDisputeTx(tx)} />
            ))}
          </div>
        )}

        {/* ── Requests Tab ── */}
        {activeTab === "reqs" && (
          <div>
            {myReqs.length === 0 && myBidReqs.length === 0 && (
              <div style={{ textAlign: "center", color: T.text5, padding: "28px 0", fontSize: 13 }}>Нет запросов</div>
            )}
            {myReqs.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: "#818cf8", fontWeight: 600, marginBottom: 8 }}>Мои запросы ({myReqs.length})</div>
                {myReqs.map(r => {
                  const pb = r.bids.filter(b => b.status === "pending").length;
                  return (
                    <div key={r.id} style={{
                      background: T.card, border: `1px solid ${r.status === "closed" ? "#4ade8040" : pb > 0 ? "#f9713040" : T.border}`,
                      borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: pb > 0 || r.status === "open" ? "pointer" : "default",
                    }} onClick={() => (pb > 0 || r.status === "open" || r.status === "in_progress") && onOpenReq && onOpenReq(r)}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: T.text, flex: 1 }}>{r.title}</div>
                        {pb > 0 && <span style={{ fontSize: 11, background: "#f9713020", color: "#f97316", padding: "3px 9px", borderRadius: 6, fontWeight: 600, flexShrink: 0 }}>
                          {pb} {pb === 1 ? "предложение" : "предложений"} →</span>}
                        {r.status === "closed" && <span style={{ fontSize: 11, color: "#4ade80", flexShrink: 0 }}>✓ выполнен</span>}
                        {r.status === "in_progress" && <span style={{ fontSize: 11, color: "#fbbf24", flexShrink: 0 }}>⏳ в работе</span>}
                      </div>
                      <div style={{ fontSize: 12, color: T.text3, marginBottom: 5, lineHeight: 1.4 }}>{r.desc}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        {r.budget && <span style={{ fontSize: 11, color: "#fbbf24" }}>бюджет: {cur(r.budget)}</span>}
                        {pb > 0 && <span style={{ fontSize: 11, color: "#f97316" }}>Нажми чтобы принять →</span>}
                        {r.status === "open" && pb === 0 && (
                          <button onClick={e => { e.stopPropagation(); onCancelRequest && onCancelRequest(r.id); }}
                            style={{ fontSize: 11, background: "none", border: "1px solid #7f1d1d", color: "#f87171", padding: "3px 10px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", marginLeft: "auto" }}>
                            Отменить
                          </button>
                        )}
                        {r.status === "cancelled" && <span style={{ fontSize: 11, color: T.text5 }}>отменён</span>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {myBidReqs.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: "#4ade80", fontWeight: 600, marginTop: 12, marginBottom: 8 }}>💬 Мои отклики ({myBidReqs.length})</div>
                {myBidReqs.map(r => {
                  const bid = r.bids.find(b => b.from === meId && b.status === "pending");
                  const auth = findM(members, r.member);
                  return (
                    <div key={r.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 4 }}>{r.title}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.text3, marginBottom: 8 }}>
                        <Avatar member={auth} size={18} />
                        <span onClick={() => onSelectMember(auth.id)} style={{ cursor: "pointer", color: T.accent }}>{auth.name}</span>
                        <span style={{ marginLeft: "auto", color: "#818cf8", fontWeight: 600 }}>{cur(bid.price)}</span>
                      </div>
                      <button onClick={() => onCancelBid && onCancelBid(r.id, bid.id)}
                        style={{ width: "100%", background: "none", border: "1px solid #7f1d1d", color: "#f87171", padding: "5px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                        Отозвать отклик
                      </button>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── Stats Tab ── */}
        {activeTab === "stats" && (
          <StatsPanel transactions={transactions} meId={meId} T={T} />
        )}
      </div>

      {/* Dispute Modal */}
      {disputeTx && (
        <DisputeModal tx={disputeTx} T={T} onSubmit={handleDispute} onClose={() => setDisputeTx(null)} />
      )}
    </div>
  );
}

function selectStyle(T) {
  return {
    background: T.input, border: `1px solid ${T.border}`, borderRadius: 8,
    color: T.text, fontSize: 12, padding: "6px 10px", fontFamily: "inherit",
    cursor: "pointer", appearance: "auto",
  };
}

export default DealsScreen;
