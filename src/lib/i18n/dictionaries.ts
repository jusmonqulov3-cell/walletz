// App translations. This module is plain TS (no "use client", no server-only)
// so it can be imported from both Server and Client Components. The active
// locale comes from a cookie — see ./server (read) and ./actions (write).

export const locales = ["uz", "ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const DEFAULT_LOCALE: Locale = "uz";

// Native language names, shown the same in every locale.
export const LANGUAGE_NAMES: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
};

// The "uz" object is the source of truth for the dictionary shape; the others
// are checked against it with `satisfies Dict`.
const uz = {
  menu: {
    settings: "Sozlamalar",
    profile: "Profil",
    telegram: "Telegram ulanish",
    darkMode: "Tungi rejim",
    lightMode: "Yorug' rejim",
    language: "Til",
    logout: "Chiqish",
  },
  nav: {
    dashboard: "Asosiy",
    income: "Daromad",
    goals: "Maqsad",
    debts: "Qarz",
    investments: "Invest",
  },
  dashboard: {
    greet: "Xayrli kun",
    today: "Bugun",
    week: "Hafta",
    month: "Oy",
    breakdown: "Xarajatlar taqsimoti",
    total: "Jami",
    som: "so'm",
    newEntry: "Yangi yozuv",
    coach: "Murabbiy maslahatlari",
  },
  income: {
    title: "Daromad",
    sub: "Joriy oy · daromad manbalari",
  },
  goals: {
    title: "Maqsadlar",
    activeGoals: (n: number) => `${n} ta faol jamg'arma`,
  },
  debts: {
    title: "Qarzlar",
    sub: "Olingan va berilgan",
  },
  investments: {
    title: "Investitsiya",
    sub: "Valyuta · kripto · aksiya · jamg'arma",
  },
  chat: {
    title: "Pul — moliyaviy yordamchingiz",
    subtitle: "Xarajatlaringiz haqida so'rang yoki amal qo'shing.",
    placeholder: "Savol yoki buyruq yozing...",
    send: "Yuborish",
    suggestions: [
      "Bu oy nimaga ko'p pul ketdi?",
      "50 ming taksiga ishlatdim",
      "Byudjetni 3 mln qil",
    ],
    confirm: "Tasdiqlash",
    cancel: "Bekor",
    done: "Bajarildi",
    cancelled: "Bekor qilindi",
    failed: "Xatolik",
    error: "Javob olishda xatolik",
  },
  insights: {
    title: "Tahlil va prognoz",
    forecast: "Oy oxiri prognozi",
    runway: "Byudjet yetadi",
    days: "kun",
    overBudget: "Byudjetdan oshishi mumkin",
    anomalies: "G'ayrioddiy xarajatlar",
    recurring: "Takroriy to'lovlar",
    dueSoon: "tez orada",
    perMonth: "oyiga",
    vsTypical: "odatdagidan ko'p",
  },
};

export type Dict = typeof uz;

const ru = {
  menu: {
    settings: "Настройки",
    profile: "Профиль",
    telegram: "Подключить Telegram",
    darkMode: "Тёмная тема",
    lightMode: "Светлая тема",
    language: "Язык",
    logout: "Выйти",
  },
  nav: {
    dashboard: "Главная",
    income: "Доход",
    goals: "Цели",
    debts: "Долги",
    investments: "Инвест",
  },
  dashboard: {
    greet: "Добрый день",
    today: "Сегодня",
    week: "Неделя",
    month: "Месяц",
    breakdown: "Распределение расходов",
    total: "Всего",
    som: "сум",
    newEntry: "Новая запись",
    coach: "Советы коуча",
  },
  income: {
    title: "Доход",
    sub: "Текущий месяц · источники дохода",
  },
  goals: {
    title: "Цели",
    activeGoals: (n: number) => `${n} активных накоплений`,
  },
  debts: {
    title: "Долги",
    sub: "Полученные и выданные",
  },
  investments: {
    title: "Инвестиции",
    sub: "Валюта · крипто · акции · фонды",
  },
  chat: {
    title: "Pul — ваш финансовый помощник",
    subtitle: "Спросите о расходах или добавьте операцию.",
    placeholder: "Вопрос или команда...",
    send: "Отправить",
    suggestions: [
      "На что ушло больше всего в этом месяце?",
      "Потратил 50 тысяч на такси",
      "Поставь бюджет 3 млн",
    ],
    confirm: "Подтвердить",
    cancel: "Отмена",
    done: "Готово",
    cancelled: "Отменено",
    failed: "Ошибка",
    error: "Ошибка получения ответа",
  },
  insights: {
    title: "Анализ и прогноз",
    forecast: "Прогноз на конец месяца",
    runway: "Бюджета хватит на",
    days: "дн.",
    overBudget: "Возможен перерасход бюджета",
    anomalies: "Необычные траты",
    recurring: "Повторяющиеся платежи",
    dueSoon: "скоро",
    perMonth: "в месяц",
    vsTypical: "больше обычного",
  },
} satisfies Dict;

const en = {
  menu: {
    settings: "Settings",
    profile: "Profile",
    telegram: "Connect Telegram",
    darkMode: "Dark mode",
    lightMode: "Light mode",
    language: "Language",
    logout: "Log out",
  },
  nav: {
    dashboard: "Home",
    income: "Income",
    goals: "Goals",
    debts: "Debts",
    investments: "Invest",
  },
  dashboard: {
    greet: "Good day",
    today: "Today",
    week: "Week",
    month: "Month",
    breakdown: "Spending breakdown",
    total: "Total",
    som: "so'm",
    newEntry: "New entry",
    coach: "Coach tips",
  },
  income: {
    title: "Income",
    sub: "This month · income sources",
  },
  goals: {
    title: "Goals",
    activeGoals: (n: number) => `${n} active goals`,
  },
  debts: {
    title: "Debts",
    sub: "Borrowed and lent",
  },
  investments: {
    title: "Investments",
    sub: "Currency · crypto · stocks · funds",
  },
  chat: {
    title: "Pul — your finance assistant",
    subtitle: "Ask about your spending or add an entry.",
    placeholder: "Ask or command...",
    send: "Send",
    suggestions: [
      "What did I spend most on this month?",
      "Spent 50k on a taxi",
      "Set my budget to 3M",
    ],
    confirm: "Confirm",
    cancel: "Cancel",
    done: "Done",
    cancelled: "Cancelled",
    failed: "Error",
    error: "Failed to get a response",
  },
  insights: {
    title: "Insights & forecast",
    forecast: "Month-end forecast",
    runway: "Budget lasts",
    days: "days",
    overBudget: "May exceed budget",
    anomalies: "Unusual spending",
    recurring: "Recurring",
    dueSoon: "due soon",
    perMonth: "/mo",
    vsTypical: "more than usual",
  },
} satisfies Dict;

export const dictionaries: Record<Locale, Dict> = { uz, ru, en };

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
