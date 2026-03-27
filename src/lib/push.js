import sb from "./supabase";

// VAPID public key — stored in Supabase settings table (key: "vapid_public_key")
// Generate keypair with: npx web-push generate-vapid-keys
// Store public key in settings, private key as env var for the push server

let vapidPublicKey = null;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getVapidKey() {
  if (vapidPublicKey) return vapidPublicKey;
  const settings = await sb.select("settings", "key=eq.vapid_public_key");
  if (settings.length > 0) {
    vapidPublicKey = settings[0].value;
    return vapidPublicKey;
  }
  return null;
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushPermission() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestPushPermission() {
  if (!isPushSupported()) return "unsupported";
  const result = await Notification.requestPermission();
  return result;
}

export async function subscribeToPush(memberId) {
  if (!isPushSupported()) return null;

  const permission = await requestPushPermission();
  if (permission !== "granted") return null;

  const key = await getVapidKey();
  if (!key) {
    console.warn("VAPID public key not configured in settings table");
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await savePushSubscription(memberId, existing);
    return existing;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });

  await savePushSubscription(memberId, subscription);
  return subscription;
}

export async function unsubscribeFromPush(memberId) {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    await removePushSubscription(memberId);
  }
}

async function savePushSubscription(memberId, subscription) {
  const sub = subscription.toJSON();
  await sb.upsert("push_subscriptions", {
    member_id: memberId,
    endpoint: sub.endpoint,
    p256dh: sub.keys?.p256dh || "",
    auth: sub.keys?.auth || "",
    created_at: new Date().toISOString(),
  }, "member_id,endpoint");
}

async function removePushSubscription(memberId) {
  await sb.delete("push_subscriptions", { member_id: memberId });
}

export async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
}

// ── Notification preferences ───────────────────────────────────────────────

const DEFAULT_PREFS = {
  push_enabled: false,
  notify_new_order: true,
  notify_message: true,
  notify_confirmation: true,
  notify_bid: true,
  notify_review: true,
  notify_gift: true,
  notify_news: true,
};

export async function getNotificationPrefs(memberId) {
  const rows = await sb.select("notification_prefs", `member_id=eq.${memberId}`);
  if (rows.length > 0) {
    return { ...DEFAULT_PREFS, ...rows[0] };
  }
  return { ...DEFAULT_PREFS, member_id: memberId };
}

export async function saveNotificationPrefs(memberId, prefs) {
  const data = { member_id: memberId, ...prefs };
  await sb.upsert("notification_prefs", data, "member_id");
}
