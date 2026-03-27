export const CUR = { name: "зерно", plural: "зёрен", few: "зерна", sign: "з" };

export const cur = (n) => {
  const abs = Math.abs(n);
  if (abs === 1) return `${n} ${CUR.name}`;
  if (abs >= 2 && abs <= 4) return `${n} ${CUR.few}`;
  return `${n} ${CUR.plural}`;
};

export const ROLES = { admin: "admin", moderator: "moderator", member: "member" };
export const ROLE_LABEL = { admin: "Администратор", moderator: "Модератор", member: "Участник" };
export const ROLE_COLOR = { admin: "#fbbf24", moderator: "#818cf8", member: "#4ade80" };
export const canAdmin = (r) => r === ROLES.admin;
export const canModerate = (r) => r === ROLES.admin || r === ROLES.moderator;

export const CATEGORIES = ["Все", "Еда", "Жильё", "Здоровье", "Знания", "Транспорт", "Дети", "Культура"];

export let CAT_ICONS = {
  "Еда": "🌿", "Жильё": "🏠", "Здоровье": "💙", "Знания": "📖",
  "Транспорт": "🚗", "Дети": "🌱", "Культура": "🎵", "Все": "✦",
};

export const AV_COLORS = ["#7c6ff7", "#f97316", "#22c55e", "#ec4899", "#06b6d4", "#eab308"];

export const THEMES = {
  dark: {
    bg: "#0d0f14", card: "#131720", border: "#1e2330", border2: "#2d3548",
    text: "#e2e8f0", text2: "#94a3b8", text3: "#64748b", text4: "#475569", text5: "#334155",
    input: "#0d0f14", accent: "#6366f1",
  },
  light: {
    bg: "#f1f5f9", card: "#ffffff", border: "#e2e8f0", border2: "#cbd5e1",
    text: "#0f172a", text2: "#334155", text3: "#475569", text4: "#64748b", text5: "#94a3b8",
    input: "#f8fafc", accent: "#6366f1",
  },
};

export const APP_VERSION = "1.9";

export const S_LABEL = { active: "в работе", awaiting_confirm: "ожидает подтверждения", confirmed: "завершена", cancelled: "отменена" };
export const S_COLOR = { active: "#f97316", awaiting_confirm: "#818cf8", confirmed: "#4ade80", cancelled: "#475569" };

export const DEMURRAGE_RATE = 0.02;
export const DEMURRAGE_THRESHOLD = 50;
export const DEFAULT_NEG_LIMIT = -150;

export const CAT_SYNONYMS = {
  "Еда":       ["еда","food","продукт","продукты","овощ","фрукт","мясо","масло","варенье","томат","помидор","сад","огород","рынок","закупка"],
  "Жильё":     ["жильё","жилье","ремонт","дом","квартира","розетк","кран","полк","мебель","сантехник","электрик"],
  "Здоровье":  ["здоровье","медицина","зуб","зубн","врач","помощь","стоматолог","аптечк","осмотр"],
  "Знания":    ["знания","обучение","урок","репетитор","музык","гитар","фортепиан","математик","педагог","занятие"],
  "Транспорт": ["транспорт","подвезти","машина","авто","поездк","подвоз"],
  "Дети":      ["дети","ребёнок","ребенок","коляск","детск","сын","дочь","малыш"],
  "Культура":  ["культура","искусство","театр","кино","музей"],
};
