import { useState, useRef, useCallback } from 'react';
import { AV_COLORS, ROLE_COLOR, ROLE_LABEL, ROLES, APP_VERSION, cur } from '../../lib/constants';
import { balColor } from '../../lib/utils';

export function Avatar({ member, size = 36 }) {
  const idHash = String(member.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bg = AV_COLORS[idHash % AV_COLORS.length];
  const initials = (member.name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  if (member.photo) return <div className="avatar" style={{ width: size, height: size }}>
    <img src={member.photo} alt="" /></div>;
  return <div className="avatar" style={{
    width: size, height: size, background: bg, fontSize: size * 0.33,
  }}>{initials}</div>;
}

export function Pill({ balance }) {
  const c = balance > 0 ? "var(--color-success)" : balance < 0 ? "var(--color-danger)" : "var(--color-text-secondary)";
  return <span className="pill" style={{
    background: balance > 0 ? "var(--color-success-surface)" : balance < 0 ? "var(--color-danger-surface)" : "var(--color-surface-hover)",
    color: c, border: `1px solid ${balance > 0 ? "var(--color-success-border)" : balance < 0 ? "var(--color-danger-border)" : "var(--color-border)"}`,
  }}>
    {balance > 0 ? "+" : ""}{cur(balance)}</span>;
}

export function RoleBadge({ role }) {
  if (!role || role === ROLES.member) return null;
  return <span className="badge" style={{
    background: `${ROLE_COLOR[role]}20`, color: ROLE_COLOR[role],
    border: `1px solid ${ROLE_COLOR[role]}30`,
  }}>
    {ROLE_LABEL[role]}</span>;
}

export function QtyBar({ qty, reserved }) {
  const avail = qty - reserved, pct = qty > 0 ? (avail / qty) * 100 : 0;
  const c = pct > 50 ? "var(--color-success)" : pct > 20 ? "var(--color-gold)" : "var(--color-danger)";
  return <div className="qty-bar">
    <div className="qty-bar-labels">
      <span>Доступно: <b style={{ color: c }}>{avail}</b> из {qty}</span>
      {reserved > 0 && <span style={{ color: "var(--color-gold)" }}>забронировано: {reserved}</span>}
    </div>
    <div className="qty-bar-track">
      <div className="qty-bar-fill" style={{ background: c, width: `${pct}%` }} /></div>
  </div>;
}

export function Sheet({ onClose, children }) {
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

  return <div className="sheet-backdrop"
    style={{
      background: `rgba(0,0,0,${0.75 - progress * 0.5})`,
      backdropFilter: `blur(${4 - progress * 4}px)`,
      transition: dragY === 0 ? "background 0.2s" : "none"
    }}
    onClick={e => e.target === e.currentTarget && doClose()}>
    <div className={`sheet${closing ? " sheet-closing" : ""}`}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      style={{
        transform: `translateY(${dragY}px)`,
        transition: dragY === 0 ? "transform 0.2s ease" : "none",
      }}>
      <div className="sheet-handle" style={{ opacity: 1 - progress * 0.5 }} />
      {children}
    </div>
  </div>;
}

export function SL({ children, mt = 0 }) {
  return <div className="label" style={{ marginTop: mt }}>{children}</div>;
}

export function IRow({ label, children }) {
  return <div className="info-row">
    <span className="info-row-label">{label}</span>{children}</div>;
}

export function FI({ value, onChange, placeholder, multi, type = "text", s = {} }) {
  return multi
    ? <textarea className="input" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ marginBottom: 11, ...s }} />
    : <input className="input" type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ marginBottom: 11, ...s }} />;
}

export function PB({ onClick, children, v = "primary", s = {}, disabled = false }) {
  const classMap = {
    primary: "btn-primary",
    gold: "btn-gold",
    ghost: "btn-ghost",
    danger: "btn-danger",
    green: "btn-success",
    orange: "btn-orange",
  };
  return <button className={`btn btn-md btn-full ${classMap[v] || "btn-primary"}`}
    onClick={onClick} disabled={disabled} style={s}>{children}</button>;
}

export function Notif({ msg }) {
  return <div className="toast">{msg}</div>;
}

export function CopyBtn({ text }) {
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
  return <button className={`btn btn-sm ${copied ? "btn-success" : "btn-ghost"}`} onClick={doCopy}
    style={{ transition: "all 0.2s" }}>
    {copied ? "✓ Скопировано" : "Копировать"}
  </button>;
}

export function VersionFooter() {
  return <div style={{ textAlign: "center", padding: "16px 0 8px", fontSize: "var(--text-2xs)", color: "var(--color-text-faint)", opacity: 0.6, fontFamily: "var(--font-mono)" }}>
    Общий фонд · v{APP_VERSION}
  </div>;
}
