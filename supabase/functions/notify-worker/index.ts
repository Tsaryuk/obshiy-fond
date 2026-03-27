import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://obshiy-fond.vercel.app";

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Event type → notification_prefs column mapping
const TYPE_TO_PREF: Record<string, string> = {
  booking: "notify_new_order",
  chat: "notify_message",
  mention: "notify_message",
  confirmed: "notify_confirmation",
  cancelled: "notify_confirmation",
  done: "notify_confirmation",
  bid: "notify_bid",
  accepted: "notify_bid",
  review: "notify_review",
  review_prompt: "notify_review",
  gift: "notify_gift",
  news: "notify_news",
};

// Always-on types (bypass pref check)
const ALWAYS_ON = new Set(["dispute", "invite_used"]);

// Emoji per event type
const TYPE_EMOJI: Record<string, string> = {
  booking: "\u{1F6D2}",
  chat: "\u{1F4AC}",
  mention: "\u{1F4AC}",
  confirmed: "\u2705",
  cancelled: "\u274C",
  done: "\u2705",
  bid: "\u{1F4CB}",
  accepted: "\u{1F4CB}",
  review: "\u2B50",
  review_prompt: "\u2B50",
  gift: "\u{1F381}",
  dispute: "\u26A0\uFE0F",
  invite_used: "\u{1F44B}",
  news: "\u{1F4F0}",
};

const TYPE_LABEL: Record<string, string> = {
  booking: "Новый заказ",
  chat: "Сообщение",
  mention: "Упоминание",
  confirmed: "Подтверждено",
  cancelled: "Отменено",
  done: "Выполнено",
  bid: "Отклик",
  accepted: "Отклик принят",
  review: "Отзыв",
  review_prompt: "Оставьте отзыв",
  gift: "Подарок",
  dispute: "Спор",
  invite_used: "Инвайт",
  news: "Новость",
};

function truncate(s: string | null, max = 200): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "..." : s;
}

function formatTelegramMessage(type: string, title: string | null, body: string | null): string {
  const emoji = TYPE_EMOJI[type] || "\u{1F514}";
  const label = TYPE_LABEL[type] || type;
  const parts = [`${emoji} <b>${label}</b>`];
  if (title) parts.push(title);
  if (body) parts.push(truncate(body));
  return parts.join("\n");
}

async function sendTelegram(chatId: number, text: string, url?: string) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть", url: url || APP_URL }]],
    },
  };

  const res = await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await res.json();

  // Bot blocked by user — deactivate
  if (!res.ok && result?.error_code === 403) {
    return { ok: false, blocked: true };
  }

  // Rate limited — log but don't retry in this run
  if (!res.ok && result?.error_code === 429) {
    const retryAfter = result?.parameters?.retry_after || 30;
    console.warn(`Rate limited, retry after ${retryAfter}s`);
    return { ok: false, rateLimited: true, retryAfter };
  }

  return { ok: result.ok };
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const payload = await req.json();

    // Database webhook sends { type: "INSERT", record: {...} }
    const record = payload.record;
    if (!record?.member_id || !record?.type) {
      return new Response("Missing fields", { status: 400 });
    }

    const { member_id, type, title, body, data } = record;

    // 1. Check notification preferences
    const isAlwaysOn = ALWAYS_ON.has(type);
    const prefColumn = TYPE_TO_PREF[type];

    if (!isAlwaysOn && !prefColumn) {
      // Unknown type — skip
      return new Response("Unknown type", { status: 200 });
    }

    const { data: prefs } = await db
      .from("notification_prefs")
      .select("telegram_enabled, push_enabled, " + (prefColumn || "telegram_enabled"))
      .eq("member_id", member_id)
      .single();

    // --- Telegram delivery ---
    const telegramEnabled = prefs?.telegram_enabled !== false;
    const prefEnabled = isAlwaysOn || (prefs?.[prefColumn] !== false);

    if (telegramEnabled && prefEnabled) {
      const { data: tgUser } = await db
        .from("telegram_users")
        .select("telegram_id, active")
        .eq("member_id", member_id)
        .eq("active", true)
        .single();

      if (tgUser) {
        const text = formatTelegramMessage(type, title, body);
        const deepUrl = data?.url ? `${APP_URL}${data.url}` : APP_URL;
        const result = await sendTelegram(tgUser.telegram_id, text, deepUrl);

        if (result.blocked) {
          // Deactivate user who blocked the bot
          await db
            .from("telegram_users")
            .update({ active: false })
            .eq("telegram_id", tgUser.telegram_id);
          console.log(`Deactivated blocked user tg:${tgUser.telegram_id}`);
        }
      }
    }

    // --- Web Push delivery ---
    const pushEnabled = prefs?.push_enabled !== false;
    const pushPrefEnabled = isAlwaysOn || (prefs?.[prefColumn] !== false);

    if (pushEnabled && pushPrefEnabled && VAPID_PRIVATE_KEY) {
      const { data: subs } = await db
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("member_id", member_id);

      if (subs && subs.length > 0) {
        const pushPayload = JSON.stringify({
          title: title || TYPE_LABEL[type] || "Уведомление",
          body: truncate(body, 150),
          icon: "/icon-192.png",
          url: data?.url || "/",
          type,
        });

        // Web Push requires the web-push library; in Deno Edge Functions
        // we use the web-push npm package via esm.sh
        try {
          const webpush = await import("https://esm.sh/web-push@3.6.7");
          webpush.setVapidDetails(`mailto:noreply@obshiy-fond.app`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

          for (const sub of subs) {
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                pushPayload,
                { timeout: 10000 },
              );
            } catch (pushErr: unknown) {
              const statusCode = (pushErr as { statusCode?: number })?.statusCode;
              if (statusCode === 410 || statusCode === 404) {
                // Subscription expired — clean up
                await db
                  .from("push_subscriptions")
                  .delete()
                  .eq("endpoint", sub.endpoint);
                console.log(`Removed expired push sub: ${sub.endpoint.slice(0, 50)}`);
              } else {
                console.error("Push send error:", pushErr);
              }
            }
          }
        } catch (importErr) {
          console.error("web-push import error:", importErr);
        }
      }
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("notify-worker error:", err);
    return new Response("Error", { status: 500 });
  }
});
