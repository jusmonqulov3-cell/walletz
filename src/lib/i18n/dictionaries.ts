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
};

export type Dict = typeof uz;

const ru = {
  menu: {
    settings: "Настройки",
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
} satisfies Dict;

const en = {
  menu: {
    settings: "Settings",
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
} satisfies Dict;

export const dictionaries: Record<Locale, Dict> = { uz, ru, en };

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}
