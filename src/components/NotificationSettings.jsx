import { useState, useEffect } from "react";
import { PB } from "./ui";
import {
  isPushSupported,
  getPushPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  getNotificationPrefs,
  saveNotificationPrefs,
} from "../lib/push";

const NOTIF_TYPES = [
  { key: "notify_new_order", label: "Новый заказ", desc: "Когда кто-то бронирует ваше предложение" },
  { key: "notify_message", label: "Сообщения", desc: "Новые личные и групповые сообщения" },
  { key: "notify_confirmation", label: "Подтверждения", desc: "Подтверждение или отмена сделки" },
  { key: "notify_bid", label: "Отклики", desc: "Новый отклик на ваш запрос" },
  { key: "notify_review", label: "Отзывы", desc: "Новый отзыв о вас" },
  { key: "notify_gift", label: "Дары", desc: "Когда вам передают дар" },
  { key: "notify_news", label: "Новости", desc: "Новые публикации в ленте" },
];

function Toggle({ checked, onChange, T }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none",
        background: checked ? "#6366f1" : ("var(--color-border-strong)" || "#2d3548"),
        position: "relative", cursor: "pointer", transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", background: "#fff",
        position: "absolute", top: 3,
        left: checked ? 22 : 4,
        transition: "left 0.2s",
      }} />
    </button>
  );
}

export default function NotificationSettings({ meId, T, onBack, notify }) {
  const [supported] = useState(isPushSupported);
  const [permission, setPermission] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function init() {
      const perm = await getPushPermission();
      setPermission(perm);
      const sub = await getCurrentSubscription();
      setSubscribed(!!sub);
      const p = await getNotificationPrefs(meId);
      setPrefs(p);
    }
    init();
  }, [meId]);

  async function handleTogglePush(enable) {
    if (enable) {
      const sub = await subscribeToPush(meId);
      if (sub) {
        setSubscribed(true);
        setPermission("granted");
        updatePref("push_enabled", true);
        notify("Push-уведомления включены");
      } else {
        const perm = await getPushPermission();
        setPermission(perm);
        if (perm === "denied") {
          notify("Уведомления заблокированы в настройках браузера");
        }
      }
    } else {
      await unsubscribeFromPush(meId);
      setSubscribed(false);
      updatePref("push_enabled", false);
      notify("Push-уведомления отключены");
    }
  }

  async function updatePref(key, value) {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);
    await saveNotificationPrefs(meId, updated);
    setSaving(false);
  }

  if (!prefs) return (
    <div style={{ padding: "20px", textAlign: "center", color: "var(--color-text-tertiary)" }}>Загрузка...</div>
  );

  return (
    <div style={{ animation: "fadeUp 0.25s ease" }}>
      <div style={{ padding: "18px 20px 0" }}>
        <button onClick={onBack} style={{
          background: "none", border: "none", color: "var(--color-text-muted)", fontSize: 13,
          cursor: "pointer", fontFamily: "inherit", padding: 0,
        }}>
          ← назад
        </button>
      </div>

      <div style={{ padding: "14px 20px" }}>
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Уведомления</div>
        <div style={{ fontSize: 13, color: "var(--color-text-tertiary)", marginBottom: 18 }}>
          Настройте какие уведомления вы хотите получать
        </div>

        {/* Push toggle */}
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14,
          padding: "14px 16px", marginBottom: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Push-уведомления</div>
              <div style={{ fontSize: 12, color: "var(--color-text-tertiary)", marginTop: 3 }}>
                {!supported
                  ? "Не поддерживается этим браузером"
                  : permission === "denied"
                  ? "Заблокировано в настройках браузера"
                  : subscribed
                  ? "Уведомления активны"
                  : "Получайте уведомления даже когда приложение закрыто"}
              </div>
            </div>
            {supported && permission !== "denied" && (
              <Toggle checked={subscribed} onChange={handleTogglePush} T={T} />
            )}
          </div>

          {permission === "denied" && (
            <div style={{
              marginTop: 10, fontSize: 12, color: "#f97316",
              background: "#f9731610", padding: "8px 12px", borderRadius: 8,
            }}>
              Чтобы включить push-уведомления, разрешите их в настройках браузера для этого сайта
            </div>
          )}
        </div>

        {/* Notification type toggles */}
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", marginBottom: 10 }}>
          Типы уведомлений
        </div>

        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14,
          overflow: "hidden",
        }}>
          {NOTIF_TYPES.map((nt, i) => (
            <div
              key={nt.key}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 16px",
                borderBottom: i < NOTIF_TYPES.length - 1 ? "1px solid var(--color-border)" : "none",
              }}
            >
              <div style={{ flex: 1, marginRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{nt.label}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>{nt.desc}</div>
              </div>
              <Toggle
                checked={prefs[nt.key] !== false}
                onChange={(val) => updatePref(nt.key, val)}
                T={T}
              />
            </div>
          ))}
        </div>

        {/* Telegram section — placeholder */}
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14,
          padding: "14px 16px", marginTop: 12, opacity: 0.6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>✈</span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Telegram-бот</span>
            <span style={{
              fontSize: 10, background: "#fbbf2420", color: "#fbbf24",
              padding: "2px 7px", borderRadius: 8,
            }}>
              скоро
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
            Привяжите Telegram-аккаунт чтобы получать уведомления в мессенджере
          </div>
        </div>

        {saving && (
          <div style={{
            fontSize: 11, color: "var(--color-text-muted)", textAlign: "center", marginTop: 10,
          }}>
            Сохранение...
          </div>
        )}
      </div>
    </div>
  );
}
