import { useState, useRef, useCallback } from 'react';
import { AV_COLORS, ROLE_COLOR, ROLE_LABEL, ROLES, APP_VERSION, cur } from '../../lib/constants';
import { balColor } from '../../lib/utils';

export function Avatar({ member, size = 36 }) {
  const idHash = String(member.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = AV_COLORS[idHash % AV_COLORS.length];
  const initials = (member.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (member.photo) return <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
    <img src={member.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>;
  return <div style={{
    width: size, height: size, borderRadius: "50%", background: bg, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.33, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px"
  }}>{initials}</div>;
}

export function Pill({ balance, T }) {
  const c = balColor(balance, T);
  return <span style={{
    background: `${c}18`, color: c, padding: "2px 10px",
    borderRadius: 20, fontSize: 13, fontWeight: 600, border: `1px solid ${c}30`
  }}>
    {balance > 0 ? "+" : ""}{cur(balance)}</span>;
}

export function RoleBadge({ role }) {
  if (!role || role === ROLES.member) return null;
  return <span style={{
    fontSize: 10, background: `${ROLE_COLOR[role]}20`, color: ROLE_COLOR[role],
    padding: "1px 7px", borderRadius: 8, border: `1px solid ${ROLE_COLOR[role]}30`
  }}>
    {ROLE_LABEL[role]}</span>;
}

export function QtyBar({ qty, reserved, T }) {
  const avail = qty - reserved, pct = qty > 0 ? (avail / qty) * 100 : 0;
  const c = pct > 50 ? "#4ade80" : pct > 20 ? "#fbbf24" : "#f87171";
  return <div style={{ marginTop: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T?.text3 || "#64748b", marginBottom: 3 }}>
      <span>Доступно: <b style={{ color: c }}>{avail}</b> из {qty}</span>
      {reserved > 0 && <span style={{ color: "#fbbf24" }}>забронировано: {reserved}</span>}
    </div>
    <div style={{ height: 3, background: T?.border || "#1e2330", borderRadius: 2 }}>
      <div style={{ height: "100%", borderRadius: 2, background: c, width: `${pct}%`, transition: "width 0.3s" }} /></div>
  </div>;
}

export function Sheet({ onClose, children, T }) {
  const bg = T?.card || "#131720"; const br = T?.border || "#1e2330";
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);
  const startY = useRef(null);

  const doClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 260);
  }, [onClose]);

  const onTouchStart = useCallback(e => { e.stopPropagation(); startY.current = e.touches[0].clientY; }, []);
  const onTouchMove = useCallback(e => {
    e.stopPropagation();
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) { try { e.preventDefault(); } catch (_) { } setDragY(dy); }
  }, []);
  const onTouchEnd = useCallback(e => {
    e.stopPropagation();
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy > 60) { setDragY(0); doClose(); }
    else setDragY(0);
    startY.current = null;
  }, [doClose]);

  const progress = Math.min(dragY / 120, 1);
  const sheetStyle = {
    background: bg, borderRadius: "20px 20px 0 0", padding: "24px 20px 36px",
    width: "100%", border: `1px solid ${br}`,
    animation: closing ? "slideOut 0.26s ease forwards" : "slideIn 0.25s ease",
    maxHeight: "90vh", overflowY: "auto", color: T?.text || "#e2e8f0",
    transform: `translateY(${dragY}px)`,
    transition: dragY === 0 ? "transform 0.2s ease" : "none",
  };

  return <div style={{
    position: "fixed", inset: 0,
    background: `rgba(0,0,0,${0.75 - progress * 0.5})`,
    display: "flex", alignItems: "flex-end", zIndex: 200, backdropFilter: `blur(${4 - progress * 4}px)`,
    transition: dragY === 0 ? "background 0.2s" : "none"
  }}
    onClick={e => e.target === e.currentTarget && doClose()}>
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} style={sheetStyle}>
      <div style={{
        width: 36, height: 4, background: br, borderRadius: 2, margin: "0 auto 20px",
        opacity: 1 - progress * 0.5
      }} />
      {children}
    </div>
  </div>;
}

export function SL({ children, mt = 0, T }) {
  return <div style={{
    fontSize: 11, color: T?.text4 || "#475569", letterSpacing: 1.5, textTransform: "uppercase",
    marginBottom: 8, marginTop: mt
  }}>{children}</div>;
}

export function IRow({ label, children, T }) {
  return <div style={{
    background: T?.input || "#0d0f14", borderRadius: 12, padding: "11px 14px", marginBottom: 10,
    display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${T?.border || "#1e2330"}`
  }}>
    <span style={{ fontSize: 13, color: T?.text3 || "#64748b" }}>{label}</span>{children}</div>;
}

export function FI({ value, onChange, placeholder, multi, type = "text", s = {}, T }) {
  const base = {
    width: "100%", background: T?.input || "#0d0f14", border: `1px solid ${T?.border || "#1e2330"}`, borderRadius: 10,
    color: T?.text || "#e2e8f0", padding: "11px 14px", fontSize: 14, fontFamily: "inherit", outline: "none", marginBottom: 11, ...s
  };
  return multi
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...base, resize: "none", height: 68 }} />
    : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} />;
}

export function PB({ onClick, children, v = "primary", s = {}, disabled = false, T }) {
  const acc = T?.accent || "#4f46e5";
  const vs = {
    primary: { background: acc, color: "#fff", border: "none" },
    gold: { background: "#78350f", color: "#fbbf24", border: "1px solid #92400e" },
    ghost: { background: T?.card || "#1e2330", color: T?.text2 || "#94a3b8", border: `1px solid ${T?.border || "#2d3548"}` },
    danger: { background: "#1a0d0d", color: "#f87171", border: "1px solid #7f1d1d" },
    green: { background: "#052e16", color: "#4ade80", border: "1px solid #166534" },
    orange: { background: "#431407", color: "#f97316", border: "1px solid #7c2d12" },
  };
  return <button onClick={onClick} disabled={disabled} style={{
    width: "100%", padding: "12px", borderRadius: 12,
    fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    opacity: disabled ? 0.4 : 1, ...vs[v], ...s
  }}>{children}</button>;
}

export function Notif({ msg }) {
  return <div style={{
    position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
    background: "#1e2330", border: "1px solid #2d3548", padding: "10px 20px", borderRadius: 12,
    zIndex: 1000, fontSize: 14, fontWeight: 500, color: "#e2e8f0", animation: "notif 2.8s ease forwards",
    whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
  }}>{msg}</div>;
}

export function CopyBtn({ text, T }) {
  const [copied, setCopied] = useState(false);
  function doCopy() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    } else {
      const el = document.createElement('textarea');
      el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
      document.body.appendChild(el); el.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) { }
      document.body.removeChild(el);
    }
  }
  return <button onClick={doCopy}
    style={{
      background: copied ? "#052e16" : T?.border, border: `1px solid ${copied ? "#166534" : "transparent"}`,
      color: copied ? "#4ade80" : "#6366f1", padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s"
    }}>
    {copied ? "✓ Скопировано" : "Копировать"}
  </button>;
}

export function VersionFooter({ T }) {
  return <div style={{ textAlign: "center", padding: "16px 0 8px", fontSize: 10, color: T?.text5 || "#1e2330", opacity: 0.6, fontFamily: "monospace" }}>
    Общий фонд · v{APP_VERSION}
  </div>;
}
