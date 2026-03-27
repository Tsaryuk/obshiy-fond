import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://obshiy-fond.vercel.app";

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendMessage(chatId: number, text: string, replyMarkup?: object) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  const res = await fetch(`${TG_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function appButton(path = "/") {
  return {
    inline_keyboard: [[{ text: "Открыть приложение", url: `${APP_URL}${path}` }]],
  };
}

async function handleStart(chatId: number, telegramId: number, username: string | undefined, token?: string) {
  if (!token) {
    await sendMessage(
      chatId,
      "Привет! Чтобы привязать аккаунт, перейдите в приложение → Настройки → Привязать Telegram.",
      appButton("/profile/notifications"),
    );
    return;
  }

  // Validate link token
  const { data: linkToken, error } = await db
    .from("telegram_link_tokens")
    .select("member_id, expires_at, used")
    .eq("token", token)
    .single();

  if (error || !linkToken) {
    await sendMessage(chatId, "Ссылка недействительна. Попробуйте заново в приложении.");
    return;
  }

  if (linkToken.used) {
    await sendMessage(chatId, "Эта ссылка уже была использована.");
    return;
  }

  if (new Date(linkToken.expires_at) < new Date()) {
    await sendMessage(chatId, "Ссылка истекла. Создайте новую в настройках приложения.");
    return;
  }

  // Check if this telegram_id is already linked to another member
  const { data: existing } = await db
    .from("telegram_users")
    .select("member_id")
    .eq("telegram_id", telegramId)
    .single();

  if (existing && existing.member_id !== linkToken.member_id) {
    await sendMessage(
      chatId,
      "Этот Telegram-аккаунт уже привязан к другому профилю. Сначала отвяжите его командой /unlink.",
    );
    return;
  }

  // Link account
  const { error: upsertErr } = await db.from("telegram_users").upsert(
    {
      member_id: linkToken.member_id,
      telegram_id: telegramId,
      telegram_username: username || null,
      linked_at: new Date().toISOString(),
      active: true,
    },
    { onConflict: "member_id" },
  );

  if (upsertErr) {
    console.error("Link error:", upsertErr);
    await sendMessage(chatId, "Ошибка привязки. Попробуйте позже.");
    return;
  }

  // Mark token as used
  await db.from("telegram_link_tokens").update({ used: true }).eq("token", token);

  // Enable telegram notifications
  await db
    .from("notification_prefs")
    .upsert(
      { member_id: linkToken.member_id, telegram_enabled: true },
      { onConflict: "member_id" },
    );

  // Get member name for confirmation
  const { data: member } = await db
    .from("members")
    .select("name")
    .eq("id", linkToken.member_id)
    .single();

  const name = member?.name || "аккаунту";
  await sendMessage(
    chatId,
    `Привязано к <b>${name}</b>. Уведомления включены.`,
    appButton("/profile/notifications"),
  );
}

async function handleUnlink(chatId: number, telegramId: number) {
  const { data: linked } = await db
    .from("telegram_users")
    .select("member_id")
    .eq("telegram_id", telegramId)
    .single();

  if (!linked) {
    await sendMessage(chatId, "Ваш Telegram не привязан ни к одному аккаунту.");
    return;
  }

  await db.from("telegram_users").delete().eq("telegram_id", telegramId);
  await db
    .from("notification_prefs")
    .update({ telegram_enabled: false })
    .eq("member_id", linked.member_id);

  await sendMessage(chatId, "Аккаунт отвязан. Telegram-уведомления отключены.");
}

async function handleStatus(chatId: number, telegramId: number) {
  const { data: linked } = await db
    .from("telegram_users")
    .select("member_id, active")
    .eq("telegram_id", telegramId)
    .single();

  if (!linked) {
    await sendMessage(chatId, "Telegram не привязан. Привяжите в настройках приложения.", appButton("/profile/notifications"));
    return;
  }

  const { data: prefs } = await db
    .from("notification_prefs")
    .select("telegram_enabled, notify_new_order, notify_message, notify_confirmation, notify_bid, notify_review, notify_gift, notify_news")
    .eq("member_id", linked.member_id)
    .single();

  const on = (v: boolean | null) => (v !== false ? "вкл" : "выкл");
  const lines = [
    `<b>Статус Telegram-уведомлений</b>`,
    ``,
    `Telegram: ${prefs?.telegram_enabled ? "включены" : "выключены"}`,
    `Заказы: ${on(prefs?.notify_new_order)}`,
    `Сообщения: ${on(prefs?.notify_message)}`,
    `Подтверждения: ${on(prefs?.notify_confirmation)}`,
    `Отклики: ${on(prefs?.notify_bid)}`,
    `Отзывы: ${on(prefs?.notify_review)}`,
    `Дары: ${on(prefs?.notify_gift)}`,
    `Новости: ${on(prefs?.notify_news)}`,
  ];

  await sendMessage(chatId, lines.join("\n"), appButton("/profile/notifications"));
}

async function handleHelp(chatId: number) {
  await sendMessage(
    chatId,
    [
      "<b>Команды бота</b>",
      "",
      "/start — привязать аккаунт",
      "/unlink — отвязать аккаунт",
      "/status — настройки уведомлений",
      "/help — справка",
      "",
      "Управляйте уведомлениями в приложении.",
    ].join("\n"),
    appButton("/profile/notifications"),
  );
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  // Verify webhook secret
  if (WEBHOOK_SECRET) {
    const secret = req.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  try {
    const update = await req.json();
    const message = update.message;
    if (!message?.text) {
      return new Response("OK", { status: 200 });
    }

    const chatId = message.chat.id;
    const telegramId = message.from.id;
    const username = message.from.username;
    const text = message.text.trim();

    if (text.startsWith("/start")) {
      const token = text.split(" ")[1];
      await handleStart(chatId, telegramId, username, token);
    } else if (text === "/unlink") {
      await handleUnlink(chatId, telegramId);
    } else if (text === "/status") {
      await handleStatus(chatId, telegramId);
    } else if (text === "/help") {
      await handleHelp(chatId);
    } else {
      await sendMessage(chatId, "Используйте /help для списка команд.");
    }
  } catch (err) {
    console.error("Telegram bot error:", err);
  }

  return new Response("OK", { status: 200 });
});
