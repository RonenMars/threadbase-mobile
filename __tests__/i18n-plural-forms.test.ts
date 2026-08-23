import fs from 'fs';
import path from 'path';

import 'intl-pluralrules';
import i18next, { type i18n as I18n, type Resource, type ResourceKey, type ResourceLanguage } from 'i18next';

// Pins the EXACT rendered string for every count-bearing key in every locale, at
// one count per CLDR plural category. A keyword or regex assertion would not be
// enough: the strings that shipped before these keys had plural forms ("1 פעילים",
// literally "1 are-active") contain every keyword the correct string contains, so
// a loose matcher goes green both before and after the fix.
//
// This suite builds its own i18next instance rather than reusing
// test-utils/i18n-setup, for two reasons. That fixture sets fallbackLng: 'en',
// which renders English whenever a he/ar/ru form is missing — the exact failure
// this suite exists to catch — and it does not load the conversation or shared
// namespaces for the non-English locales at all.
const LOCALES = ['en', 'he', 'ar', 'ru'] as const;
const NAMESPACES = ['conversation', 'sessions', 'servers', 'settings', 'shared'] as const;

type Locale = (typeof LOCALES)[number];

/** A parsed locale bundle: nested objects bottoming out in strings. */
interface LocaleNode {
  [segment: string]: LocaleNode | string;
}

function loadNamespace(locale: Locale, namespace: string): LocaleNode {
  const file = path.join(__dirname, '..', 'locales', locale, namespace + '.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as LocaleNode;
}

function buildInstance(): I18n {
  const resources: Resource = {};
  for (const locale of LOCALES) {
    const bundle: ResourceLanguage = {};
    for (const namespace of NAMESPACES) bundle[namespace] = loadNamespace(locale, namespace) as ResourceKey;
    resources[locale] = bundle;
  }
  const instance = i18next.createInstance();
  // fallbackLng: false — a missing plural form must fail loudly, not quietly render English.
  instance.init({
    lng: 'en',
    fallbackLng: false,
    ns: [...NAMESPACES],
    resources,
    interpolation: { escapeValue: false },
  });
  return instance;
}

/**
 * One count per CLDR plural category, per locale:
 *   en  one(1)            other(0,2,3,11,21,100)
 *   he  one(1) two(2)     other(0,3,11,21,100)
 *   ar  zero(0) one(1) two(2) few(3) many(11,21) other(100)
 *   ru  one(1,21) few(2,3) many(0,11,100)
 * Russian `other` is unreachable for whole numbers, so no integer count hits it.
 */
const COUNTS = [0, 1, 2, 3, 11, 21, 100] as const;

type PluralKey =
  | 'conversation:message.tokens'
  | 'conversation:action.showAllLines'
  | 'sessions:hub.activityLive'
  | 'sessions:loading.fetchingN'
  | 'shared:quickAccess.loadMore'
  | 'servers:hostPressure.detected.agents'
  | 'servers:cacheAlert.bannerTitle'
  | 'servers:cacheAlert.confirmPruneAll'
  | 'servers:cacheAlert.confirmPruneSelected'
  | 'servers:cacheAlert.toastDetails'
  | 'settings:backup.applied'
  | 'settings:backup.exported';

interface PluralCase {
  key: PluralKey;
  server?: string;
  expected: Record<Locale, Record<number, string>>;
}

const CASES: PluralCase[] = [
  {
    key: 'conversation:message.tokens',
    expected: {
      en: {
        0: "0 tokens",
        1: "1 token",
        2: "2 tokens",
        3: "3 tokens",
        11: "11 tokens",
        21: "21 tokens",
        100: "100 tokens",
      },
      he: {
        0: "0 טוקנים",
        1: "טוקן אחד",
        2: "שני טוקנים",
        3: "3 טוקנים",
        11: "11 טוקנים",
        21: "21 טוקנים",
        100: "100 טוקנים",
      },
      ar: {
        0: "لا توكنات",
        1: "توكن واحد",
        2: "توكنان",
        3: "3 توكنات",
        11: "11 توكنًا",
        21: "21 توكنًا",
        100: "100 توكن",
      },
      ru: {
        0: "0 токенов",
        1: "1 токен",
        2: "2 токена",
        3: "3 токена",
        11: "11 токенов",
        21: "21 токен",
        100: "100 токенов",
      },
    },
  },
  {
    key: 'conversation:action.showAllLines',
    expected: {
      en: {
        0: "Show all 0 lines",
        1: "Show 1 line",
        2: "Show all 2 lines",
        3: "Show all 3 lines",
        11: "Show all 11 lines",
        21: "Show all 21 lines",
        100: "Show all 100 lines",
      },
      he: {
        0: "הצג את כל 0 השורות",
        1: "הצג שורה אחת",
        2: "הצג שתי שורות",
        3: "הצג את כל 3 השורות",
        11: "הצג את כל 11 השורות",
        21: "הצג את כל 21 השורות",
        100: "הצג את כל 100 השורות",
      },
      ar: {
        0: "لا أسطر لعرضها",
        1: "عرض سطر واحد",
        2: "عرض سطرين",
        3: "عرض كل الأسطر (3)",
        11: "عرض كل الأسطر (11)",
        21: "عرض كل الأسطر (21)",
        100: "عرض كل الأسطر (100)",
      },
      ru: {
        0: "Показать все 0 строк",
        1: "Показать 1 строку",
        2: "Показать все 2 строки",
        3: "Показать все 3 строки",
        11: "Показать все 11 строк",
        21: "Показать 21 строку",
        100: "Показать все 100 строк",
      },
    },
  },
  {
    key: 'sessions:hub.activityLive',
    expected: {
      en: {
        0: "0 live",
        1: "1 live",
        2: "2 live",
        3: "3 live",
        11: "11 live",
        21: "21 live",
        100: "100 live",
      },
      he: {
        0: "0 פעילים",
        1: "אחד פעיל",
        2: "שניים פעילים",
        3: "3 פעילים",
        11: "11 פעילים",
        21: "21 פעילים",
        100: "100 פעילים",
      },
      ar: {
        0: "لا توجد جلسات نشطة",
        1: "جلسة نشطة واحدة",
        2: "جلستان نشطتان",
        3: "3 جلسات نشطة",
        11: "11 جلسة نشطة",
        21: "21 جلسة نشطة",
        100: "100 جلسة نشطة",
      },
      ru: {
        0: "Активных: 0",
        1: "Активных: 1",
        2: "Активных: 2",
        3: "Активных: 3",
        11: "Активных: 11",
        21: "Активных: 21",
        100: "Активных: 100",
      },
    },
  },
  {
    key: 'sessions:loading.fetchingN',
    expected: {
      en: {
        0: "Fetching 0 servers in parallel",
        1: "Fetching 1 server",
        2: "Fetching 2 servers in parallel",
        3: "Fetching 3 servers in parallel",
        11: "Fetching 11 servers in parallel",
        21: "Fetching 21 servers in parallel",
        100: "Fetching 100 servers in parallel",
      },
      he: {
        0: "מושך 0 שרתים במקביל",
        1: "מושך שרת אחד",
        2: "מושך שני שרתים במקביל",
        3: "מושך 3 שרתים במקביל",
        11: "מושך 11 שרתים במקביל",
        21: "מושך 21 שרתים במקביל",
        100: "מושך 100 שרתים במקביל",
      },
      ar: {
        0: "لا خوادم لجلبها",
        1: "جارٍ جلب خادم واحد",
        2: "جارٍ جلب خادمين بالتوازي",
        3: "جارٍ جلب 3 خوادم بالتوازي",
        11: "جارٍ جلب 11 خادمًا بالتوازي",
        21: "جارٍ جلب 21 خادمًا بالتوازي",
        100: "جارٍ جلب 100 خادم بالتوازي",
      },
      ru: {
        0: "Получение 0 серверов параллельно",
        1: "Получение 1 сервера",
        2: "Получение 2 серверов параллельно",
        3: "Получение 3 серверов параллельно",
        11: "Получение 11 серверов параллельно",
        21: "Получение 21 сервера",
        100: "Получение 100 серверов параллельно",
      },
    },
  },
  {
    key: 'shared:quickAccess.loadMore',
    expected: {
      en: {
        0: "+ 0 more",
        1: "+ 1 more",
        2: "+ 2 more",
        3: "+ 3 more",
        11: "+ 11 more",
        21: "+ 21 more",
        100: "+ 100 more",
      },
      he: {
        0: "+ 0 נוספים",
        1: "+ אחד נוסף",
        2: "+ שניים נוספים",
        3: "+ 3 נוספים",
        11: "+ 11 נוספים",
        21: "+ 21 נוספים",
        100: "+ 100 נוספים",
      },
      ar: {
        0: "+ لا مزيد",
        1: "+ واحد إضافي",
        2: "+ اثنان إضافيان",
        3: "+ 3 إضافية",
        11: "+ 11 إضافيًا",
        21: "+ 21 إضافيًا",
        100: "+ 100 إضافي",
      },
      ru: {
        0: "+ ещё 0",
        1: "+ ещё 1",
        2: "+ ещё 2",
        3: "+ ещё 3",
        11: "+ ещё 11",
        21: "+ ещё 21",
        100: "+ ещё 100",
      },
    },
  },
  {
    key: 'servers:hostPressure.detected.agents',
    expected: {
      en: {
        0: "0 agents are running on this computer.",
        1: "1 agent is running on this computer.",
        2: "2 agents are running on this computer.",
        3: "3 agents are running on this computer.",
        11: "11 agents are running on this computer.",
        21: "21 agents are running on this computer.",
        100: "100 agents are running on this computer.",
      },
      he: {
        0: "0 סוכנים רצים במחשב הזה.",
        1: "סוכן אחד רץ במחשב הזה.",
        2: "שני סוכנים רצים במחשב הזה.",
        3: "3 סוכנים רצים במחשב הזה.",
        11: "11 סוכנים רצים במחשב הזה.",
        21: "21 סוכנים רצים במחשב הזה.",
        100: "100 סוכנים רצים במחשב הזה.",
      },
      ar: {
        0: "لا وكلاء قيد التشغيل على هذا الحاسوب.",
        1: "وكيل واحد قيد التشغيل على هذا الحاسوب.",
        2: "وكيلان قيد التشغيل على هذا الحاسوب.",
        3: "3 وكلاء قيد التشغيل على هذا الحاسوب.",
        11: "11 وكيلًا قيد التشغيل على هذا الحاسوب.",
        21: "21 وكيلًا قيد التشغيل على هذا الحاسوب.",
        100: "100 وكيل قيد التشغيل على هذا الحاسوب.",
      },
      ru: {
        0: "На этом компьютере активны 0 агентов.",
        1: "На этом компьютере активен 1 агент.",
        2: "На этом компьютере активны 2 агента.",
        3: "На этом компьютере активны 3 агента.",
        11: "На этом компьютере активны 11 агентов.",
        21: "На этом компьютере активен 21 агент.",
        100: "На этом компьютере активны 100 агентов.",
      },
    },
  },
  {
    key: 'servers:cacheAlert.bannerTitle',
    server: 'My Mac',
    expected: {
      en: {
        0: "0 conversation histories are missing on My Mac",
        1: "1 conversation history is missing on My Mac",
        2: "2 conversation histories are missing on My Mac",
        3: "3 conversation histories are missing on My Mac",
        11: "11 conversation histories are missing on My Mac",
        21: "21 conversation histories are missing on My Mac",
        100: "100 conversation histories are missing on My Mac",
      },
      he: {
        0: "0 היסטוריות שיחה חסרות ב-My Mac",
        1: "היסטוריית שיחה אחת חסרה ב-My Mac",
        2: "שתי היסטוריות שיחה חסרות ב-My Mac",
        3: "3 היסטוריות שיחה חסרות ב-My Mac",
        11: "11 היסטוריות שיחה חסרות ב-My Mac",
        21: "21 היסטוריות שיחה חסרות ב-My Mac",
        100: "100 היסטוריות שיחה חסרות ב-My Mac",
      },
      ar: {
        0: "لا سجلات محادثات مفقودة على My Mac",
        1: "سجل محادثة واحد مفقود على My Mac",
        2: "سجلا محادثة مفقودان على My Mac",
        3: "3 سجلات محادثات مفقودة على My Mac",
        11: "11 سجلًا من سجلات المحادثات مفقود على My Mac",
        21: "21 سجلًا من سجلات المحادثات مفقود على My Mac",
        100: "100 من سجلات المحادثات مفقودة على My Mac",
      },
      ru: {
        0: "0 историй бесед отсутствуют на My Mac",
        1: "1 история бесед отсутствует на My Mac",
        2: "2 истории бесед отсутствуют на My Mac",
        3: "3 истории бесед отсутствуют на My Mac",
        11: "11 историй бесед отсутствуют на My Mac",
        21: "21 история бесед отсутствует на My Mac",
        100: "100 историй бесед отсутствуют на My Mac",
      },
    },
  },
  {
    key: 'servers:cacheAlert.confirmPruneAll',
    expected: {
      en: {
        0: "This permanently removes all 0 missing conversations from the cache. This cannot be undone.",
        1: "This permanently removes the 1 missing conversation from the cache. This cannot be undone.",
        2: "This permanently removes all 2 missing conversations from the cache. This cannot be undone.",
        3: "This permanently removes all 3 missing conversations from the cache. This cannot be undone.",
        11: "This permanently removes all 11 missing conversations from the cache. This cannot be undone.",
        21: "This permanently removes all 21 missing conversations from the cache. This cannot be undone.",
        100: "This permanently removes all 100 missing conversations from the cache. This cannot be undone.",
      },
      he: {
        0: "פעולה זו מסירה לצמיתות את כל 0 השיחות החסרות מהמטמון. לא ניתן לבטל פעולה זו.",
        1: "פעולה זו מסירה לצמיתות את השיחה החסרה מהמטמון. לא ניתן לבטל פעולה זו.",
        2: "פעולה זו מסירה לצמיתות את שתי השיחות החסרות מהמטמון. לא ניתן לבטל פעולה זו.",
        3: "פעולה זו מסירה לצמיתות את כל 3 השיחות החסרות מהמטמון. לא ניתן לבטל פעולה זו.",
        11: "פעולה זו מסירה לצמיתות את כל 11 השיחות החסרות מהמטמון. לא ניתן לבטל פעולה זו.",
        21: "פעולה זו מסירה לצמיתות את כל 21 השיחות החסרות מהמטמון. לא ניתן לבטל פעולה זו.",
        100: "פעולה זו מסירה לצמיתות את כל 100 השיחות החסרות מהמטמון. לא ניתן לבטל פעולה זו.",
      },
      ar: {
        0: "لا توجد محادثات مفقودة لإزالتها من الذاكرة المؤقتة.",
        1: "سيؤدي هذا إلى إزالة المحادثة المفقودة الوحيدة من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        2: "سيؤدي هذا إلى إزالة المحادثتين المفقودتين من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        3: "سيؤدي هذا إلى إزالة جميع المحادثات المفقودة البالغ عددها 3 من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        11: "سيؤدي هذا إلى إزالة جميع المحادثات المفقودة البالغ عددها 11 من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        21: "سيؤدي هذا إلى إزالة جميع المحادثات المفقودة البالغ عددها 21 من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        100: "سيؤدي هذا إلى إزالة جميع المحادثات المفقودة البالغ عددها 100 من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
      },
      ru: {
        0: "Это навсегда удалит все 0 отсутствующих бесед из кэша. Это действие нельзя отменить.",
        1: "Это навсегда удалит 1 отсутствующую беседу из кэша. Это действие нельзя отменить.",
        2: "Это навсегда удалит все 2 отсутствующие беседы из кэша. Это действие нельзя отменить.",
        3: "Это навсегда удалит все 3 отсутствующие беседы из кэша. Это действие нельзя отменить.",
        11: "Это навсегда удалит все 11 отсутствующих бесед из кэша. Это действие нельзя отменить.",
        21: "Это навсегда удалит 21 отсутствующую беседу из кэша. Это действие нельзя отменить.",
        100: "Это навсегда удалит все 100 отсутствующих бесед из кэша. Это действие нельзя отменить.",
      },
    },
  },
  {
    key: 'servers:cacheAlert.confirmPruneSelected',
    expected: {
      en: {
        0: "This permanently removes 0 selected conversations from the cache. This cannot be undone.",
        1: "This permanently removes 1 selected conversation from the cache. This cannot be undone.",
        2: "This permanently removes 2 selected conversations from the cache. This cannot be undone.",
        3: "This permanently removes 3 selected conversations from the cache. This cannot be undone.",
        11: "This permanently removes 11 selected conversations from the cache. This cannot be undone.",
        21: "This permanently removes 21 selected conversations from the cache. This cannot be undone.",
        100: "This permanently removes 100 selected conversations from the cache. This cannot be undone.",
      },
      he: {
        0: "פעולה זו מסירה לצמיתות 0 שיחות נבחרות מהמטמון. לא ניתן לבטל פעולה זו.",
        1: "פעולה זו מסירה לצמיתות שיחה נבחרת אחת מהמטמון. לא ניתן לבטל פעולה זו.",
        2: "פעולה זו מסירה לצמיתות שתי שיחות נבחרות מהמטמון. לא ניתן לבטל פעולה זו.",
        3: "פעולה זו מסירה לצמיתות 3 שיחות נבחרות מהמטמון. לא ניתן לבטל פעולה זו.",
        11: "פעולה זו מסירה לצמיתות 11 שיחות נבחרות מהמטמון. לא ניתן לבטל פעולה זו.",
        21: "פעולה זו מסירה לצמיתות 21 שיחות נבחרות מהמטמון. לא ניתן לבטל פעולה זו.",
        100: "פעולה זו מסירה לצמיתות 100 שיחות נבחרות מהמטמון. לא ניתן לבטל פעולה זו.",
      },
      ar: {
        0: "لم يتم تحديد أي محادثات للإزالة.",
        1: "سيؤدي هذا إلى إزالة المحادثة المحددة من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        2: "سيؤدي هذا إلى إزالة المحادثتين المحددتين من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        3: "سيؤدي هذا إلى إزالة 3 محادثات محددة من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        11: "سيؤدي هذا إلى إزالة 11 محادثة محددة من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        21: "سيؤدي هذا إلى إزالة 21 محادثة محددة من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
        100: "سيؤدي هذا إلى إزالة 100 من المحادثات المحددة من الذاكرة المؤقتة بشكل دائم. لا يمكن التراجع عن هذا الإجراء.",
      },
      ru: {
        0: "Это навсегда удалит 0 выбранных бесед из кэша. Это действие нельзя отменить.",
        1: "Это навсегда удалит 1 выбранную беседу из кэша. Это действие нельзя отменить.",
        2: "Это навсегда удалит 2 выбранные беседы из кэша. Это действие нельзя отменить.",
        3: "Это навсегда удалит 3 выбранные беседы из кэша. Это действие нельзя отменить.",
        11: "Это навсегда удалит 11 выбранных бесед из кэша. Это действие нельзя отменить.",
        21: "Это навсегда удалит 21 выбранную беседу из кэша. Это действие нельзя отменить.",
        100: "Это навсегда удалит 100 выбранных бесед из кэша. Это действие нельзя отменить.",
      },
    },
  },
  {
    key: 'servers:cacheAlert.toastDetails',
    expected: {
      en: {
        0: "0 of the cached histories are missing. Review the list to prune, ignore, or rescan.",
        1: "1 of the cached histories is missing. Review the list to prune, ignore, or rescan.",
        2: "2 of the cached histories are missing. Review the list to prune, ignore, or rescan.",
        3: "3 of the cached histories are missing. Review the list to prune, ignore, or rescan.",
        11: "11 of the cached histories are missing. Review the list to prune, ignore, or rescan.",
        21: "21 of the cached histories are missing. Review the list to prune, ignore, or rescan.",
        100: "100 of the cached histories are missing. Review the list to prune, ignore, or rescan.",
      },
      he: {
        0: "0 מההיסטוריות שבמטמון חסרות. סקור את הרשימה כדי למחוק, להתעלם או לסרוק מחדש.",
        1: "היסטוריה אחת מהמטמון חסרה. סקור את הרשימה כדי למחוק, להתעלם או לסרוק מחדש.",
        2: "שתי היסטוריות מהמטמון חסרות. סקור את הרשימה כדי למחוק, להתעלם או לסרוק מחדש.",
        3: "3 מההיסטוריות שבמטמון חסרות. סקור את הרשימה כדי למחוק, להתעלם או לסרוק מחדש.",
        11: "11 מההיסטוריות שבמטמון חסרות. סקור את הרשימה כדי למחוק, להתעלם או לסרוק מחדש.",
        21: "21 מההיסטוריות שבמטמון חסרות. סקור את הרשימה כדי למחוק, להתעלם או לסרוק מחדש.",
        100: "100 מההיסטוריות שבמטמון חסרות. סקור את הרשימה כדי למחוק, להתעלם או לסרוק מחדש.",
      },
      ar: {
        0: "لا توجد سجلات مخزّنة مفقودة.",
        1: "سجل واحد من السجلات المخزّنة مفقود. راجع القائمة للحذف أو التجاهل أو إعادة الفحص.",
        2: "سجلان من السجلات المخزّنة مفقودان. راجع القائمة للحذف أو التجاهل أو إعادة الفحص.",
        3: "3 سجلات من السجلات المخزّنة مفقودة. راجع القائمة للحذف أو التجاهل أو إعادة الفحص.",
        11: "11 سجلًا من السجلات المخزّنة مفقود. راجع القائمة للحذف أو التجاهل أو إعادة الفحص.",
        21: "21 سجلًا من السجلات المخزّنة مفقود. راجع القائمة للحذف أو التجاهل أو إعادة الفحص.",
        100: "100 من السجلات المخزّنة مفقودة. راجع القائمة للحذف أو التجاهل أو إعادة الفحص.",
      },
      ru: {
        0: "0 из кэшированных историй отсутствуют. Проверьте список, чтобы удалить, игнорировать или пересканировать.",
        1: "1 из кэшированных историй отсутствует. Проверьте список, чтобы удалить, игнорировать или пересканировать.",
        2: "2 из кэшированных историй отсутствуют. Проверьте список, чтобы удалить, игнорировать или пересканировать.",
        3: "3 из кэшированных историй отсутствуют. Проверьте список, чтобы удалить, игнорировать или пересканировать.",
        11: "11 из кэшированных историй отсутствуют. Проверьте список, чтобы удалить, игнорировать или пересканировать.",
        21: "21 из кэшированных историй отсутствует. Проверьте список, чтобы удалить, игнорировать или пересканировать.",
        100: "100 из кэшированных историй отсутствуют. Проверьте список, чтобы удалить, игнорировать или пересканировать.",
      },
    },
  },
  {
    key: 'settings:backup.applied',
    expected: {
      en: {
        0: "Restore applied (0 projects written).",
        1: "Restore applied (1 project written).",
        2: "Restore applied (2 projects written).",
        3: "Restore applied (3 projects written).",
        11: "Restore applied (11 projects written).",
        21: "Restore applied (21 projects written).",
        100: "Restore applied (100 projects written).",
      },
      he: {
        0: "השחזור יושם (0 פרויקטים נכתבו).",
        1: "השחזור יושם (פרויקט אחד נכתב).",
        2: "השחזור יושם (שני פרויקטים נכתבו).",
        3: "השחזור יושם (3 פרויקטים נכתבו).",
        11: "השחזור יושם (11 פרויקטים נכתבו).",
        21: "השחזור יושם (21 פרויקטים נכתבו).",
        100: "השחזור יושם (100 פרויקטים נכתבו).",
      },
      ar: {
        0: "تم تطبيق الاستعادة (لم تتم كتابة أي مشروع).",
        1: "تم تطبيق الاستعادة (تمت كتابة مشروع واحد).",
        2: "تم تطبيق الاستعادة (تمت كتابة مشروعين).",
        3: "تم تطبيق الاستعادة (تمت كتابة 3 مشاريع).",
        11: "تم تطبيق الاستعادة (تمت كتابة 11 مشروعًا).",
        21: "تم تطبيق الاستعادة (تمت كتابة 21 مشروعًا).",
        100: "تم تطبيق الاستعادة (تمت كتابة 100 مشروع).",
      },
      ru: {
        0: "Восстановление применено (записано 0 проектов).",
        1: "Восстановление применено (записан 1 проект).",
        2: "Восстановление применено (записано 2 проекта).",
        3: "Восстановление применено (записано 3 проекта).",
        11: "Восстановление применено (записано 11 проектов).",
        21: "Восстановление применено (записан 21 проект).",
        100: "Восстановление применено (записано 100 проектов).",
      },
    },
  },
  {
    key: 'settings:backup.exported',
    expected: {
      en: {
        0: "Exported 0 projects.",
        1: "Exported 1 project.",
        2: "Exported 2 projects.",
        3: "Exported 3 projects.",
        11: "Exported 11 projects.",
        21: "Exported 21 projects.",
        100: "Exported 100 projects.",
      },
      he: {
        0: "יוצאו 0 פרויקטים.",
        1: "יוצא פרויקט אחד.",
        2: "יוצאו שני פרויקטים.",
        3: "יוצאו 3 פרויקטים.",
        11: "יוצאו 11 פרויקטים.",
        21: "יוצאו 21 פרויקטים.",
        100: "יוצאו 100 פרויקטים.",
      },
      ar: {
        0: "لم يتم تصدير أي مشروع.",
        1: "تم تصدير مشروع واحد.",
        2: "تم تصدير مشروعين.",
        3: "تم تصدير 3 مشاريع.",
        11: "تم تصدير 11 مشروعًا.",
        21: "تم تصدير 21 مشروعًا.",
        100: "تم تصدير 100 مشروع.",
      },
      ru: {
        0: "Экспортировано 0 проектов.",
        1: "Экспортирован 1 проект.",
        2: "Экспортировано 2 проекта.",
        3: "Экспортировано 3 проекта.",
        11: "Экспортировано 11 проектов.",
        21: "Экспортирован 21 проект.",
        100: "Экспортировано 100 проектов.",
      },
    },
  },
];

describe('locale plural forms render the exact string at every category boundary', () => {
  let i18n: I18n;

  beforeAll(() => {
    i18n = buildInstance();
  });

  describe.each(LOCALES)('%s', (locale) => {
    beforeEach(async () => {
      await i18n.changeLanguage(locale);
    });

    for (const testCase of CASES) {
      it.each(COUNTS)(testCase.key + ' at count %i', (count) => {
        const rendered = testCase.server
          ? i18n.t(testCase.key, { count, server: testCase.server })
          : i18n.t(testCase.key, { count });
        expect(rendered).toBe(testCase.expected[locale][count]);
      });
    }
  });

  it('never falls back to an unsuffixed base key', () => {
    for (const testCase of CASES) {
      const [namespace, dotted] = testCase.key.split(':');
      let node: LocaleNode | string | undefined = loadNamespace('en', namespace);
      for (const segment of dotted.split('.')) {
        node = typeof node === 'object' ? node[segment] : undefined;
      }
      expect(node).toBeUndefined();
    }
  });
});
