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
  { key: "active", label: "В работе", color: "var(--color-orange)" },
  { key: "awaiting_confirm", label: "Ожидание", color: "var(--color-purple)" },
  { key: "confirmed", label: "Завершена", color: "var(--color-success)" },
];
const STEP_IDX = { active: 0, awaiting_confirm: 1, confirmed: 2, cancelled: -1 };

function PipelineBar({ status }) {
  const idx = STEP_IDX[status] ?? -1;
  return (
    <div className="steps" style={{ margin: "8px 0 4px" }}>
      {PIPELINE_STEPS.map((s, i) => (
        <div key={s.key} className="flex-1 flex-col items-center gap-1" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{
            width: "100%", height: 4, borderRadius: 2,
            background: i <= idx ? s.color : "var(--color-border-strong)",
            transition: "background 0.3s",
          }} />
          <span style={{ fontSize: 9, color: i <= idx ? s.color : "var(--color-text-muted)", fontWeight: i === idx ? 700 : 400 }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function StaleIndicator({ tx }) {
  const days = daysSince(tx.date);
  if (days < 3 || tx.status === "confirmed" || tx.status === "cancelled") return null;
  const urgent = days >= 7;
  return (
    <div className={`badge ${urgent ? "badge-danger" : "badge-warning"}`} style={{ marginTop: 6, gap: 4 }}>
      {urgent ? "🔴" : "⚠️"} {days} дн. без действия
    </div>
  );
}

function TxCard({ tx, role, reviews, onReview, meId, members, onSelectMember, onConfirmTx, onCancelTx, onMarkDone, onOpenDispute }) {
  const other = role === "buyer" ? findM(members, tx.to) : findM(members, tx.from);
  const sc = S_COLOR[tx.status] || "#475569";
  return (
    <div className="tx-card" style={{ marginBottom: 8 }}>
      <div className="flex justify-between" style={{alignItems:"flex-start"}}>
        <div className="flex-1">
          <div style={{ fontWeight: 600, fontSize: "var(--text-base)", marginBottom: 4 }}>{tx.what}</div>
          <div className="flex items-center gap-2" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)" }}>
            <Avatar member={other} size={18} />
            <span className="profile-invite-link" onClick={() => onSelectMember(other.id)}>{other.name}</span>
            <span style={{ fontSize: "var(--text-xs)", fontFamily: "var(--font-mono)", marginLeft: 4, color: "var(--color-text-faint)" }}>{tx.date}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", marginLeft: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-lg)", color: role === "buyer" ? "var(--color-danger)" : "var(--color-success)" }}>
            {role === "buyer" ? "-" : "+"}{cur(tx.amount)}
          </div>
          <span className="badge" style={{ background: `${sc}18`, color: sc }}>
            {S_LABEL[tx.status]}
          </span>
        </div>
      </div>

      <PipelineBar status={tx.status} />
      <StaleIndicator tx={tx} />

      {(tx.status === "active" || tx.status === "awaiting_confirm") && (
        <div className="tx-actions">
          {role === "buyer" && tx.status === "active" && !tx.reqId && (
            <button className="btn btn-sm btn-success flex-1" onClick={() => onConfirmTx(tx.id)}>✓ Подтвердить получение</button>
          )}
          {role === "buyer" && tx.status === "active" && tx.reqId && (
            <div className="badge badge-accent flex-1" style={{ textAlign: "center", padding: "7px 10px" }}>⏳ Ждём выполнения от исполнителя</div>
          )}
          {role === "buyer" && tx.status === "awaiting_confirm" && (
            <button className="btn btn-sm btn-success flex-1" onClick={() => onConfirmTx(tx.id)}>✓ Принять работу</button>
          )}
          {role === "seller" && tx.status === "active" && tx.reqId && (
            <button className="btn btn-sm btn-primary flex-1" onClick={() => onMarkDone && onMarkDone(tx.id)}>✓ Выполнено</button>
          )}
          {role === "seller" && tx.status === "active" && !tx.reqId && (
            <div className="badge flex-1" style={{ textAlign: "center", padding: "7px 10px", color: "var(--color-text-faint)", background: "var(--color-surface-hover)" }}>в работе у покупателя</div>
          )}
          {role === "seller" && tx.status === "awaiting_confirm" && (
            <div className="badge badge-success flex-1" style={{ textAlign: "center", padding: "7px 10px" }}>✓ Ждём подтверждения заказчика</div>
          )}
          {((tx.status === "active" && !tx.reqId) || (tx.status === "active" && role === "buyer" && tx.reqId))
            ? <button className="btn btn-sm btn-danger" onClick={() => onCancelTx && onCancelTx(tx.id)}>Отменить</button>
            : null}
        </div>
      )}

      {(tx.status === "active" || tx.status === "awaiting_confirm") && onOpenDispute && (
        <button className="btn btn-sm btn-ghost w-full" onClick={() => onOpenDispute(tx)} style={{ marginTop: 7 }}>⚖️ Открыть спор</button>
      )}

      {tx.status === "confirmed" && onReview && (
        (reviews || []).find(r => r.txId === tx.id && r.from === meId)
          ? <div className="badge badge-success w-full" style={{ marginTop: 7, textAlign: "center", padding: "5px 10px", justifyContent: "center" }}>⭐ Отзыв оставлен</div>
          : <button className="btn btn-sm btn-ghost w-full" onClick={() => onReview(tx)} style={{ marginTop: 7 }}>⭐ Оставить отзыв</button>
      )}
    </div>
  );
}

// ── Dispute Modal ──
function DisputeModal({ tx, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  return (
    <div className="sheet-backdrop" style={{ alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 400, width: "100%", borderRadius: "var(--radius-xl)", padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: 12 }}>⚖️ Открыть спор</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", marginBottom: 10 }}>Сделка: {tx.what} — {cur(tx.amount)}</div>
        <textarea className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Опишите причину спора..." style={{ minHeight: 80, resize: "vertical" }} />
        <div className="flex gap-2" style={{ marginTop: 12 }}>
          <button className="btn btn-md btn-ghost flex-1" onClick={onClose}>Отмена</button>
          <button className="btn btn-md btn-danger flex-1" onClick={() => { if (reason.trim()) { onSubmit(tx.id, reason.trim()); onClose(); } }}
            disabled={!reason.trim()}>Отправить</button>
        </div>
      </div>
    </div>
  );
}

// ── Stats Panel ──
function StatsPanel({ transactions, meId }) {
  const myTxs = transactions.filter(t => (t.from === meId || t.to === meId) && t.type === "exchange");
  const confirmed = myTxs.filter(t => t.status === "confirmed");
  const total = confirmed.length;
  const volume = confirmed.reduce((s, t) => s + t.amount, 0);
  const avgCheck = total > 0 ? Math.round(volume / total) : 0;
  const started = myTxs.filter(t => t.status !== "cancelled").length;
  const conversion = started > 0 ? Math.round((total / started) * 100) : 0;
  const purchases = confirmed.filter(t => t.from === meId).length;
  const sales = confirmed.filter(t => t.to === meId).length;

  const stats = [
    { l: "Объём", v: cur(volume), c: "var(--color-success)" },
    { l: "Завершено", v: total, c: "var(--color-purple)" },
    { l: "Ср. чек", v: cur(avgCheck), c: "var(--color-gold)" },
    { l: "Конверсия", v: `${conversion}%`, c: "var(--color-orange)" },
  ];

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="section-label-sm" style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>📊 Статистика</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7 }}>
        {stats.map((s, i) => (
          <div key={i} className="stat-card" style={{ textAlign: "center" }}>
            <div className="stat-label">{s.l}</div>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 justify-center" style={{ marginTop: 8 }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-danger)" }}>↑ Покупки: {purchases}</span>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)" }}>↓ Продажи: {sales}</span>
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQ, setSearchQ] = useState("");
  const [disputeTx, setDisputeTx] = useState(null);
  const swipe = useSwipe(onBack);

  const myDeals = useMemo(() => {
    return transactions
      .filter(t => t.type === "exchange" && (t.from === meId || t.to === meId))
      .map(t => ({ ...t, role: t.from === meId ? "buyer" : "seller" }));
  }, [transactions, meId]);

  const myReqs = useMemo(() => requests.filter(r => r.member === meId), [requests, meId]);
  const myBidReqs = useMemo(() =>
    requests.filter(r => r.bids.some(b => b.from === meId && b.status === "pending") && r.status === "open"),
    [requests, meId]
  );

  const activeCnt = myDeals.filter(t => t.status === "active" || t.status === "awaiting_confirm").length;
  const confirmedCnt = myDeals.filter(t => t.status === "confirmed").length;
  const staleCnt = myDeals.filter(t => (t.status === "active" || t.status === "awaiting_confirm") && daysSince(t.date) >= 3).length;

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

  const activeDeals = myDeals.filter(t => t.status === "active" || t.status === "awaiting_confirm");
  const sortedActiveDeals = [...activeDeals].sort((a, b) => daysSince(b.date) - daysSince(a.date));

  return (
    <div className="anim-fade-up" style={{ minHeight: "100vh" }} {...swipe}>
      <div style={{ padding: "18px 20px 0" }}>
        <button className="back-btn" onClick={onBack}>← назад</button>
      </div>

      <div className="page-section" style={{ paddingTop: 12 }}>
        <div className="page-title" style={{ marginBottom: 4 }}>Мои сделки</div>

        {/* Summary stat boxes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7, marginBottom: 14 }}>
          {[
            { l: "Активных", v: activeCnt, c: "var(--color-gold)" },
            { l: "Завершено", v: confirmedCnt, c: "var(--color-success)" },
            { l: "Запросы", v: myReqs.filter(r => r.status === "open").length, c: "var(--color-purple)" },
            { l: staleCnt > 0 ? "⚠️ Зависших" : "Зависших", v: staleCnt, c: staleCnt > 0 ? "var(--color-danger)" : "var(--color-text-muted)" },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ textAlign: "center" }}>
              <div className="stat-label">{s.l}</div>
              <div style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: s.v > 0 ? s.c : "var(--color-text-faint)" }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="htabs" style={{ position: "relative", padding: 0, marginBottom: 14 }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`htab${activeTab === t.key ? " htab-active" : ""}`}>{t.l}</button>
          ))}
        </div>

        {/* ── All Deals Tab ── */}
        {activeTab === "all" && (
          <div>
            <div className="flex gap-2 wrap" style={{ marginBottom: 10 }}>
              <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", fontSize: "var(--text-xs)" }}>
                <option value="all">Все статусы</option>
                <option value="active">В работе</option>
                <option value="awaiting_confirm">Ожидание</option>
                <option value="confirmed">Завершена</option>
                <option value="cancelled">Отменена</option>
              </select>
              <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                style={{ flex: 1, padding: "6px 10px", fontSize: "var(--text-xs)" }}>
                <option value="all">Все типы</option>
                <option value="buy">Покупки</option>
                <option value="sell">Продажи</option>
              </select>
            </div>
            <input className="input" type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="🔍 Поиск по сделкам..." style={{ marginBottom: 12 }} />
            {filteredDeals.length === 0 && <div className="empty">Нет сделок</div>}
            <div className="stagger">
              {filteredDeals.map(tx => (
                <TxCard key={tx.id} tx={tx} role={tx.role} reviews={reviews} onReview={onReview} meId={meId}
                  members={members} onSelectMember={onSelectMember}
                  onConfirmTx={onConfirmTx} onCancelTx={onCancelTx} onMarkDone={onMarkDone}
                  onOpenDispute={(tx) => setDisputeTx(tx)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Active Deals Tab ── */}
        {activeTab === "active" && (
          <div>
            {staleCnt > 0 && (
              <div className="card" style={{
                background: "var(--color-warning-surface)", borderColor: "var(--color-warning-border)",
                marginBottom: 12, fontSize: "var(--text-xs)", color: "var(--color-gold)",
              }}>
                ⚠️ {staleCnt} {staleCnt === 1 ? "сделка зависла" : "сделок зависли"} (более 3 дней без действия)
              </div>
            )}
            {sortedActiveDeals.length === 0 && <div className="empty">Нет активных сделок</div>}
            <div className="stagger">
              {sortedActiveDeals.map(tx => (
                <TxCard key={tx.id} tx={tx} role={tx.role} reviews={reviews} onReview={onReview} meId={meId}
                  members={members} onSelectMember={onSelectMember}
                  onConfirmTx={onConfirmTx} onCancelTx={onCancelTx} onMarkDone={onMarkDone}
                  onOpenDispute={(tx) => setDisputeTx(tx)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Requests Tab ── */}
        {activeTab === "reqs" && (
          <div>
            {myReqs.length === 0 && myBidReqs.length === 0 && <div className="empty">Нет запросов</div>}
            {myReqs.length > 0 && (
              <>
                <div className="section-label-sm" style={{ color: "var(--color-purple)", fontWeight: 600 }}>Мои запросы ({myReqs.length})</div>
                <div className="stagger">
                  {myReqs.map(r => {
                    const pb = r.bids.filter(b => b.status === "pending").length;
                    return (
                      <div key={r.id} className="card card-interactive" style={{
                        borderColor: r.status === "closed" ? "var(--color-success-border)" : pb > 0 ? "var(--color-orange-border)" : undefined,
                        marginBottom: 8,
                      }} onClick={() => (pb > 0 || r.status === "open" || r.status === "in_progress") && onOpenReq && onOpenReq(r)}>
                        <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: "var(--text-base)", flex: 1 }}>{r.title}</div>
                          {pb > 0 && <span className="badge badge-warning" style={{ flexShrink: 0, fontWeight: 600 }}>
                            {pb} {pb === 1 ? "предложение" : "предложений"} →</span>}
                          {r.status === "closed" && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", flexShrink: 0 }}>✓ выполнен</span>}
                          {r.status === "in_progress" && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gold)", flexShrink: 0 }}>⏳ в работе</span>}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", marginBottom: 5, lineHeight: 1.4 }}>{r.desc}</div>
                        <div className="flex justify-between items-center" style={{ marginTop: 6 }}>
                          {r.budget && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-gold)" }}>бюджет: {cur(r.budget)}</span>}
                          {pb > 0 && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-orange)" }}>Нажми чтобы принять →</span>}
                          {r.status === "open" && pb === 0 && (
                            <button className="btn btn-sm btn-danger" onClick={e => { e.stopPropagation(); onCancelRequest && onCancelRequest(r.id); }}
                              style={{ marginLeft: "auto" }}>Отменить</button>
                          )}
                          {r.status === "cancelled" && <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-faint)" }}>отменён</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {myBidReqs.length > 0 && (
              <>
                <div className="section-label-sm" style={{ color: "var(--color-success)", fontWeight: 600, marginTop: 12 }}>💬 Мои отклики ({myBidReqs.length})</div>
                <div className="stagger">
                  {myBidReqs.map(r => {
                    const bid = r.bids.find(b => b.from === meId && b.status === "pending");
                    const auth = findM(members, r.member);
                    return (
                      <div key={r.id} className="card" style={{ marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: "var(--text-base)", marginBottom: 4 }}>{r.title}</div>
                        <div className="flex items-center gap-2" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)", marginBottom: 8 }}>
                          <Avatar member={auth} size={18} />
                          <span className="profile-invite-link" onClick={() => onSelectMember(auth.id)}>{auth.name}</span>
                          <span style={{ marginLeft: "auto", color: "var(--color-purple)", fontWeight: 600 }}>{cur(bid.price)}</span>
                        </div>
                        <button className="btn btn-sm btn-danger w-full" onClick={() => onCancelBid && onCancelBid(r.id, bid.id)}>Отозвать отклик</button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Stats Tab ── */}
        {activeTab === "stats" && (
          <StatsPanel transactions={transactions} meId={meId} />
        )}
      </div>

      {disputeTx && (
        <DisputeModal tx={disputeTx} onSubmit={handleDispute} onClose={() => setDisputeTx(null)} />
      )}
    </div>
  );
}

export default DealsScreen;
