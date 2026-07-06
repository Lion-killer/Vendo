import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LIGHT, DARK } from './theme';
import { BottomNav, TopActions, Lightbox, closeLightbox, ConfirmDialog } from './components/ui';
import { Snackbar } from './components/Shared';
import { LogPanel } from './components/LogPanel';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { OrderScreen } from './screens/OrderScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { fetchProducts, fetchCategories, fetchCustomers, fetchOrders, fetchPriceTypes, createOrder, deleteOrder, restoreOrder, fetchAuthedBlobRaw, setOnAuthReject, pingServer } from './api/client';
import { sendTelemetry, enableErrorTelemetry } from './api/telemetry';
import { prefetchImages, clearImageCache } from './api/imageCache';
import { dataGet, dataPut, clearDataCache } from './api/dataCache';
import { logWarn } from './logger';
import { getSession, saveSession, clearSession } from './api/session';
import { saveLocalOrder, getLocalOrders, removeLocalOrder, setLocalOrderError, nextDraftNum } from './api/localOrders';
import { idSet, checkOrderRefs, mergeOrders } from './api/refs';
import { addSyncRun } from './api/syncHistory';
import { SyncHistoryPanel } from './components/SyncHistoryPanel';
import { HelpScreen } from './screens/HelpScreen';
import { UpdatePrompt } from './components/UpdatePrompt';
import { checkForUpdate, isUpdatePromptShown, markUpdatePromptShown, downloadAndInstall, openInstallSettings } from './api/updates';
import { parseMoney, orderNum as orderLabel, fmtDate, DEFAULT_CURRENCY } from './i18n';
import { STATUS } from './status';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

// Сигнатура замовлення (товари+контрагент+дата) — для порівняння «чи щось змінилось».
const orderSig = (items, custId, date) =>
  JSON.stringify({ i: (items || []).map(it => [it.product?.id, it.qty]), c: custId ?? null, d: date || null });

// Коерсія будь-якого значення до масиву: API чи кеш можуть повернути {success:false}
// замість масиву — без цього .map/.filter на екранах валить додаток у білий екран.
const arr = (x) => Array.isArray(x) ? x : [];

// Тема: збережений вибір користувача (vendo_theme) має пріоритет; інакше — системна.
const getInitialDark = () => {
  const saved = localStorage.getItem('vendo_theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

export default function App() {
  const { t: tr } = useTranslation();
  const [isDark, setIsDark] = useState(getInitialDark);
  // Відновлюємо збережену сесію (#24): якщо вона є, пропускаємо екран логіну.
  const [screen, setScreen] = useState(() => getSession() ? "dashboard" : "login");
  const [isOnline, setIsOnline] = useState(true);
  const onlineRef = useRef(true); // свіже значення для пінга (стан у замиканні ефекту застаріває)
  const [connecting, setConnecting] = useState(true); // true на старті: до першого завантаження показуємо спінер, а не «порожньо»
  const [userName, setUserName] = useState(() => getSession()?.userName || "");
  const [orderItems, setOrderItems] = useState([]);
  const [editOrderId, setEditOrderId] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [editLocked, setEditLocked] = useState(false); // проведене в 1С замовлення — лише перегляд
  const [editDate, setEditDate] = useState(null); // дата редагованого замовлення (null = нове)
  const [editStatus, setEditStatus] = useState(STATUS.NEW); // статус замовлення на екрані (Нове/Відправлено/Проведено)
  const [editNum, setEditNum] = useState(null); // номер документа (null для невідправленого) — лише для показу
  const [editVersion, setEditVersion] = useState(null); // токен версії на момент відкриття (для виявлення конфліктів)
  const [editCurrency, setEditCurrency] = useState(DEFAULT_CURRENCY); // валюта замовлення (заморожена/пристрою)
  const [editPriceType, setEditPriceType] = useState(""); // тип цін замовлення (заморожений/вибраний)
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [priceTypes, setPriceTypes] = useState([]); // доступні типи цін пристрою (для селектора)
  const [selectedPriceType, setSelectedPriceType] = useState(() => localStorage.getItem('vendo_price_type') || ""); // вибраний тип у каталозі
  const [pendingPriceType, setPendingPriceType] = useState(""); // тип, на який чекаємо підтвердження перерахунку (є позиції)
  // Оновлення додатка (#37) — на рівні App, щоб промпт з'являвся НЕЗАЛЕЖНО від входу
  // (нова версія може виправляти саму авторизацію). Перевірка анонімна (токен не потрібен).
  const [update, setUpdate] = useState(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [updPhase, setUpdPhase] = useState(null); // null → downloading → installing/permission/error
  const [updProgress, setUpdProgress] = useState(0);
  const [toast, setToast] = useState(""); // плаваюче повідомлення (збереження/відправка)
  // #40: чому користувача викинуло на екран входу (i18n-ключ). Персистентний банер на
  // LoginScreen (переживає перезапуск, на відміну від снека) — стирається при вході.
  const [loginNotice, setLoginNotice] = useState(() => localStorage.getItem('vendo_login_notice') || "");
  const [loadError, setLoadError] = useState(null); // {what, message} — постійна помилка завантаження (банер), null = немає
  const [showLog, setShowLog] = useState(false); // відкрита панель журналу помилок
  const [showSyncHistory, setShowSyncHistory] = useState(false); // відкрита панель історії синхронізацій
  const [showHelp, setShowHelp] = useState(false); // відкрита вбудована довідка
  const [syncing, setSyncing] = useState(false); // активна ручна синхронізація (для індикатора)
  const fetchingRef = useRef(false); // мережеве перечитування в процесі — не накладати цикли (повільний сервер)
  const collectionsFpRef = useRef({}); // JSON-відбитки колекцій: guard від зайвих setState/перезапису кешу, коли фоновий цикл приніс те саме
  const orderHandled = useRef(false); // OrderScreen уже зберіг/відправив — не дублювати на виході
  const orderBaseline = useRef(""); // знімок замовлення на момент відкриття (щоб зберігати лише за змінами)
  const navStack = useRef([]); // стек попередніх екранів для апаратного «назад»
  const screenRef = useRef(screen); // актуальний екран для колбеків поза React (обробник 401)
  screenRef.current = screen;

  const t = isDark ? DARK : LIGHT;

  // Плаваюче повідомлення, що переживає навігацію (на відміну від снека всередині екрана).
  // Тривалість — від довжини тексту (#46): короткі ~2.8 с, довгі (переліки товарів) — до 8 с.
  // Новий виклик скасовує попередній таймер, щоб повідомлення жило свій повний строк.
  const toastTimer = useRef(null);
  const notify = (msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), Math.min(8000, 2800 + Math.max(0, msg.length - 40) * 45));
  };
  // Зберегти поточне (нове/редаговане) замовлення як чернетку при виході з екрана.
  // Викликається з handleNav; пропускається, якщо OrderScreen уже сам зберіг/відправив.
  const saveLeavingDraft = () => {
    if (orderHandled.current) { orderHandled.current = false; return; }
    if (editLocked || orderItems.length === 0) return;
    // Черга охоплює нові ("Нове") та правки вже відправлених ("Відправлено") замовлень.
    // Проведені/видалені редагувати не можна (editLocked) — у чергу не потраплять.
    if (editOrderId && ![STATUS.NEW, STATUS.SENT].includes(editStatus)) return;
    // Нічого не змінилось від моменту відкриття — не зберігаємо й не показуємо повідомлення.
    if (orderSig(orderItems, editCustomer?.id, editDate) === orderBaseline.current) return;
    const total = orderItems.reduce((s, it) => s + it.product.price * it.qty, 0);
    // Зберігаємо реальний статус: правка відправленого лишається "Відправлено" (черга
    // на оновлення), нове — "Нове". Так doSync зробить upsert із правильним статусом.
    const queueStatus = editStatus === STATUS.SENT ? STATUS.SENT : STATUS.NEW;
    const id = saveLocalOrder({
      id: editOrderId || undefined,
      num: editNum || undefined,
      customer: editCustomer || null,
      customerId: editCustomer?.id || null,
      client: editCustomer?.name || tr("common.unknownClient"),
      items: orderItems,
      date: editDate || undefined,
      total: total,            // число (контракт #35)
      currency: editCurrency,  // заморожена валюта замовлення
      priceType: editPriceType, // тип цін замовлення (→ 1С Заказ.ТипЦен)
      status: queueStatus,
      sColor: queueStatus === STATUS.SENT ? t.ok : t.warn,
      // База версії лише для правок серверного замовлення (виявлення конфлікту).
      baseVersion: queueStatus === STATUS.SENT ? editVersion : undefined,
    });
    notify(tr("toast.saved", { label: orderLabel({ id, num: editNum }), date: fmtDate(editDate) || tr("common.today") }));
  };

  // Поки користувач не обрав тему вручну — слідуємо за системною.
  useEffect(() => {
    if (localStorage.getItem('vendo_theme')) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = e => setIsDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Вибраний тип цін переживає перезапуск (валідується проти списку в applyPriceTypes).
  useEffect(() => { if (selectedPriceType) localStorage.setItem('vendo_price_type', selectedPriceType); }, [selectedPriceType]);

  // Перевірка оновлень раз за сесію — на маунті App, НЕЗАЛЕЖНО від входу (анонімний GitHub
  // Releases). Знайдене — показуємо повноекранним промптом одразу (навіть на екрані логіну).
  useEffect(() => {
    checkForUpdate(APP_VERSION).then(u => {
      setUpdate(u);
      if (u && !isUpdatePromptShown()) { markUpdatePromptShown(); setShowUpdatePrompt(true); }
    }).catch(() => { });
  }, []);

  const startUpdate = async () => {
    setUpdPhase('downloading'); setUpdProgress(0);
    try {
      const r = await downloadAndInstall(update, setUpdProgress);
      if (r === 'permission') setUpdPhase('permission');
      else if (r === 'installing') setUpdPhase('installing');
      else { setUpdPhase(null); setShowUpdatePrompt(false); } // web-фолбек: URL відкрито
    } catch { setUpdPhase('error'); }
  };
  const closeUpdate = () => { setShowUpdatePrompt(false); setUpdPhase(null); };

  const toggleTheme = () => setIsDark(d => {
    const next = !d;
    localStorage.setItem('vendo_theme', next ? 'dark' : 'light');
    return next;
  });

  // 1) Показуємо кеш (offline-first), щоб UI не чекав мережі. Кеш — в IndexedDB
  // (vendo_data): localStorage має ліміт ~5 МБ і на великому знімку кидав QuotaExceeded,
  // а синхронна серіалізація фризила UI (див. api/dataCache.js).
  const loadFromCache = async () => {
    try {
      let data = await dataGet('collections');
      if (!data) {
        // Одноразова міграція зі старого localStorage-кешу (cached_data_v2).
        const legacy = localStorage.getItem('cached_data_v2');
        if (!legacy) return false;
        data = JSON.parse(legacy);
        dataPut('collections', data); // у фоні; невдача не критична
      }
      localStorage.removeItem('cached_data_v2'); // легасі-ключ більше не потрібен (і не тисне на квоту)
      setProducts(arr(data.products));
      setCategories(arr(data.categories));
      setCustomers(arr(data.customers));
      setOrders(arr(data.orders));
      return true;
    } catch (e) {
      console.error("Помилка відновлення кешу", e);
      return false;
    }
  };

  // 2) Тягнемо мережу у фоні; на успіх — оновлюємо стан і кеш.
  // silent=true — тихе фонове перечитування (без анімації індикатора): дані й стан
  // онлайн оновлюються, але "connecting" не вмикаємо, щоб значок не миготів щоразу.
  const fetchFromNetwork = async (silent = false, force = false) => {
    // force=true — для оновлення після дій (видалення/відновлення): минаємо guard, бо
    // інакше на повільному сервері фоновий цикл майже завжди «зайнятий» і дія не оновиться.
    if (!force && fetchingRef.current) return false; // фоновий цикл ще йде — не накладаємо
    fetchingRef.current = true;
    if (!silent) setConnecting(true);
    try {
      // Замовлення — без клієнтського фільтра дат: глибиною історії керує ЛИШЕ бекенд
      // (картка пристрою, ГлубинаИсторииЗаказов; 0 = 30 днів). Так оператор може
      // свідомо збільшити глибину конкретному пристрою — додаток це поважає.
      // allSettled, а не all: один повільний/таймнутий запит НЕ валить усе в офлайн.
      const [prodR, catR, custR, ordR] = await Promise.allSettled([
        fetchProducts(), fetchCategories(), fetchCustomers(), fetchOrders()
      ]);
      const all = [prodR, catR, custR, ordR];
      const okCount = all.filter(r => r.status === 'fulfilled').length;
      // Офлайн вирішує ЛИШЕ дешевий пінг HEAD /health (ефект нижче): таймаут важких
      // запитів даних — це повільний сервер, не відсутність мережі. Успіх даних —
      // позитивний сигнал (прапорець можна підняти, але опускати звідси — ні).
      if (okCount === 0) { return false; } // лишаємось на кеші; офлайн визначить пінг
      onlineRef.current = true;
      setIsOnline(true);

      // Оновлюємо лише ті колекції, що прийшли; rejected (мережевий таймаут) не затирає дані.
      // arr() коерсить {success:false} до [], інакше .map на екрані валить у білий екран.
      // Guard незмінності: фоновий цикл (20 с) найчастіше приносить те саме — тоді ані
      // setState (повний ре-рендер), ані перезапис кешу не потрібні. Відбиток — JSON;
      // із серверним капом історії замовлень це десятки мс, а не секунди (#41).
      let changed = false;
      const applyIfChanged = (r, key, setter) => {
        if (r.status !== 'fulfilled') return;
        const val = arr(r.value);
        const fp = JSON.stringify(val);
        if (collectionsFpRef.current[key] === fp) return;
        collectionsFpRef.current[key] = fp;
        changed = true;
        setter(val);
      };
      applyIfChanged(prodR, 'products', setProducts);
      applyIfChanged(catR, 'categories', setCategories);
      applyIfChanged(custR, 'customers', setCustomers);
      applyIfChanged(ordR, 'orders', setOrders);

      // Банер серверної помилки — лише коли колекція ПРИЙШЛА, але не масивом ({success:false}).
      // Мережевий таймаут (rejected) тут не вважаємо помилкою даних (це повільність сервера).
      const failed = [];
      let serverMsg = "";
      const checkRes = (r, key) => { if (r.status === 'fulfilled' && !Array.isArray(r.value)) { failed.push(tr(key)); if (r.value && r.value.message) serverMsg = r.value.message; } };
      checkRes(prodR, "nav.catalog"); checkRes(catR, "nav.catalog");
      checkRes(custR, "nav.customers"); checkRes(ordR, "nav.ordersList");
      if (failed.length) {
        const what = [...new Set(failed)].join(", ");
        logWarn("Сервер повернув помилку завантаження: " + what, serverMsg);
        setLoadError({ what, message: serverMsg });
      } else if (okCount === 4) {
        setLoadError(null); // повний свіжий знімок без помилок — прибираємо банер
      }

      // Прехеш фото каталогу — ЗАВЖДИ у фоні, щойно є товари (незалежно від решти колекцій),
      // щоб картинки були готові, а не вантажились поштучно при скролі.
      if (prodR.status === 'fulfilled') {
        const imgPaths = arr(prodR.value).filter(p => typeof p.img === 'string' && p.img.charAt(0) === '/').map(p => p.img);
        if (imgPaths.length) prefetchImages(imgPaths, fetchAuthedBlobRaw);
      }
      // Кеш даних — лише з повного знімка (усі 4), щоб не зберігати часткове; пишемо
      // в IndexedDB асинхронно і лише якщо щось змінилось. Час синхронізації — незалежно
      // від успіху запису кешу (це різні факти).
      if (okCount === 4) {
        if (changed) {
          dataPut('collections', {
            products: arr(prodR.value), categories: arr(catR.value), customers: arr(custR.value), orders: arr(ordR.value)
          });
        }
        localStorage.setItem('vendo_last_sync', String(Date.now())); // час останньої успішної синхронізації
      }
      return true;
    } catch (e) {
      console.warn("Цикл даних не вдався — лишаємось на кеші (офлайн визначає пінг).", e);
      return false;
    } finally {
      fetchingRef.current = false;
      if (!silent) setConnecting(false);
    }
  };

  // Типи цін пристрою (для селектора в каталозі): кеш одразу (offline-first), далі мережа.
  // Рідко змінюються — поза 20-с циклом даних. Вибраний тип валідуємо проти списку;
  // невалідний/порожній → тип за замовчуванням.
  const applyPriceTypes = (types) => {
    if (!Array.isArray(types) || !types.length) return;
    setPriceTypes(types);
    setSelectedPriceType(prev => (prev && types.some(t => t.id === prev)) ? prev : (types.find(t => t.default) || types[0]).id);
  };
  const loadPriceTypes = async () => {
    try { const cached = await dataGet('priceTypes'); if (cached) applyPriceTypes(cached); } catch { /* немає кешу */ }
    try {
      const fresh = await fetchPriceTypes();
      if (Array.isArray(fresh) && fresh.length) { dataPut('priceTypes', fresh); applyPriceTypes(fresh); }
    } catch { /* офлайн — лишаємось на кеші */ }
  };

  // Запуск: спершу кеш (одразу), далі мережа у фоні (не блокує UI).
  const loadData = async () => {
    collectionsFpRef.current = {}; // нова сесія/перезавантаження — перший знімок застосовується завжди
    await loadFromCache();
    loadPriceTypes(); // паралельно, не блокує основні дані
    await fetchFromNetwork();
  };

  // Оновлення після дій (видалення/відновлення/збереження замовлення): форсований
  // мережевий рефетч БЕЗ скидання в кеш (інакше loadFromCache повернув би стару версію,
  // а guard заблокував би оновлення). Тихо, щоб не миготів індикатор.
  const refreshOrders = () => fetchFromNetwork(true, true);

  // Миттєвий upsert серверної копії замовлення у стан (відповіді POST/PUT/DELETE вже
  // гідратовані). Закриває розрив «локальну копію видалено → серверна ще не дотяглася»:
  // на повільній 1С щойно синхронізоване замовлення зникало зі списку й дашборду на
  // секунди-хвилини, поки не долетить повний рефетч.
  const upsertOrder = (o) => setOrders(prev => {
    const i = prev.findIndex(x => x.id === o.id);
    if (i < 0) return [o, ...prev];
    const next = [...prev]; next[i] = o; return next;
  });

  // Ручна синхронізація офлайн-черги на сервер (доступна з усіх екранів через TopActions).
  // Стійка: одна помилка не валить чергу; кожен запис — успіх/конфлікт/помилка/пропуск.
  const doSync = async () => {
    if (!isOnline) { notify(tr("toast.offline")); return; }
    setSyncing(true);
    const locals = getLocalOrders();
    const canCheck = products.length > 0 && customers.length > 0;
    const prodIds = idSet(products), custIds = idSet(customers);
    let sent = 0, failed = 0, skipped = 0, conflict = 0;
    const items = []; // per-record результат для історії синхронізацій (#20)
    const opCode = (o) => o.op === 'delete' ? 'delete' : o.op === 'restore' ? 'restore' : (o.num ? 'edit' : 'new');
    const rec = (o, result, message) => items.push({ id: o.id, label: o.num || ('№' + String(o.id || '').slice(0, 8)), op: opCode(o), result, message: message || '' });
    for (const o of locals) {
      try {
        if (o.op === 'delete') {
          if (o.num) {
            const r = await deleteOrder(o.id, o.baseVersion);
            if (r && r.conflict) { setLocalOrderError(o.id, r.message || "Конфлікт версій", true, r.serverState || null); conflict++; rec(o, 'conflict', r.message); continue; }
            if (!r || !r.success) throw new Error(r?.message || "Видалення відхилено");
            if (r.order) upsertOrder(r.order); // одразу показуємо серверний стан (з поміткою)
          }
          removeLocalOrder(o.id); sent++; rec(o, 'sent'); continue;
        }
        if (o.op === 'restore') {
          const r = await restoreOrder(o.id, o.baseVersion);
          if (r && r.conflict) { setLocalOrderError(o.id, r.message || "Конфлікт версій", true, r.serverState || null); conflict++; rec(o, 'conflict', r.message); continue; }
          if (!r || !r.success) throw new Error(r?.message || "Відновлення відхилено");
          if (r.order) upsertOrder(r.order);
          removeLocalOrder(o.id); sent++; rec(o, 'sent'); continue;
        }
        // Без контрагента не відправляємо: 1С не прийме ЗаказПокупателя без Контрагент.
        // Чернетка лишається в черзі з помилкою — користувач обирає клієнта й синкає знову.
        if (!o.customerId) { setLocalOrderError(o.id, "Не вибрано контрагента"); skipped++; rec(o, 'skipped', "Не вибрано контрагента"); continue; }
        if (canCheck && !checkOrderRefs(o, prodIds, custIds).ok) { setLocalOrderError(o.id, "Посилання на видалені дані"); skipped++; rec(o, 'skipped', "Посилання на видалені дані"); continue; }
        const res = await createOrder(o.id, o.items, o.customerId, parseMoney(o.total), STATUS.SENT, o.date, o.baseVersion, o.deletionMark, o.priceType);
        if (res && res.conflict) { setLocalOrderError(o.id, res.message || "Конфлікт версій", true, res.serverState || null); conflict++; rec(o, 'conflict', res.message); continue; }
        if (!res || !res.success) throw new Error(res?.message || "Сервер відхилив замовлення");
        if (res.order) upsertOrder(res.order); // серверна версія (з номером) видима одразу, без розриву
        removeLocalOrder(o.id); sent++; rec(o, 'sent');
      } catch (e) {
        console.error("Sync error", o.id, e);
        setLocalOrderError(o.id, e.message || "Помилка"); failed++; rec(o, 'failed', e.message || "Помилка");
      }
    }
    await fetchFromNetwork(true);
    if (items.length) addSyncRun({ sent, failed, conflict, skipped, items }); // запис прогону в історію
    const parts = [];
    if (sent) parts.push(tr("toast.syncSent", { count: sent }));
    if (conflict) parts.push(tr("toast.syncConflict", { count: conflict }));
    if (failed) parts.push(tr("toast.syncFailed", { count: failed }));
    if (skipped) parts.push(tr("toast.syncSkipped", { count: skipped }));
    notify(parts.length ? tr("toast.syncResult", { parts: parts.join(", ") }) : tr("toast.syncNothing"));
    setSyncing(false);
    sendTelemetry(); // #42: снапшот після синхронізації (fire-and-forget)
  };

  const isLoggedIn = screen !== "login";

  useEffect(() => {
    // #40: на екрані логіну не синкаємо — токена ще немає, кожен запит закінчився б 401
    // (шум у лозі, зайве навантаження на повільну 1С). Перший fetch — одразу після входу
    // (isLoggedIn стає true), вже з новим токеном.
    if (!isLoggedIn) return;

    // Повернення звʼязку/додатку на передній план — одразу тягнемо свіже.
    const handleOnline = () => fetchFromNetwork(true);
    const handleOffline = () => { onlineRef.current = false; setIsOnline(false); };
    const handleVisible = () => { if (document.visibilityState === 'visible') fetchFromNetwork(true); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisible);

    loadData();
    enableErrorTelemetry(); // при помилці додатка — позачерговий снапшот із логом
    sendTelemetry(); // #42: снапшот при старті сесії

    // Онлайн/офлайн визначає ТІЛЬКИ дешевий пінг HEAD /health (12 с таймаут, без БД):
    // важкі запити даних можуть хвилинами таймаутити на повільній 1С — це «синхронізація
    // повзе», а не офлайн. Гістерезис: в офлайн — лише після 2 невдач поспіль (одиночний
    // пропуск на повільному тунелі — шум, бойовий лог 06.07.2026 миготів саме так).
    // Повернення зв'язку після офлайну → одразу свіжий рефетч.
    let pingFails = 0;
    const ping = async () => {
      const ok = await pingServer();
      pingFails = ok ? 0 : pingFails + 1;
      const was = onlineRef.current;
      const next = ok ? true : (pingFails >= 2 ? false : was);
      onlineRef.current = next;
      setIsOnline(next);
      if (ok && !was) fetchFromNetwork(true); // зв'язок повернувся — тягнемо свіже
    };
    ping();
    const pingInterval = setInterval(ping, 15000);

    // Фонова синхронізація: тихо перечитуємо дані кожні 20с. Так нові товари/замовлення
    // з сервера підтягуються самі, поки додаток онлайн, — а не лише при переході
    // офлайн→онлайн.
    const syncInterval = setInterval(() => { fetchFromNetwork(true); }, 20000);
    const telemetryInterval = setInterval(() => { sendTelemetry(); }, 15 * 60 * 1000); // #42

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
      clearInterval(pingInterval);
      clearInterval(syncInterval);
      clearInterval(telemetryInterval);
    };
  }, [isLoggedIn]);

  // Апаратна кнопка «Назад» (Android): без обробника Capacitor одразу виходить із додатку.
  // Перехоплюємо й навігуємо всередині: журнал → закрити; підекран → на головну; головна/
  // логін → вихід. Перепідписка на зміну screen/showLog, щоб у замиканні були свіжі значення.
  useEffect(() => {
    let handle, cancelled = false;
    import('@capacitor/app').then(async ({ App: CapApp }) => {
      const h = await CapApp.addListener('backButton', () => {
        if (showHelp) { setShowHelp(false); return; }
        if (showLog) { setShowLog(false); return; }
        if (showSyncHistory) { setShowSyncHistory(false); return; }
        if (closeLightbox()) return;      // відкритий лайтбокс фото — спершу закриваємо його
        if (screen === 'dashboard') { CapApp.exitApp(); return; } // головна — вихід із додатку
        if (navigateBack()) return;       // інакше — на попередній екран зі стека
        CapApp.exitApp();                 // стек порожній — виходимо
      });
      if (cancelled) h.remove(); else handle = h;
    }).catch(() => {});
    return () => { cancelled = true; if (handle) handle.remove(); };
  }, [screen, showLog, showHelp, showSyncHistory]);

  const handleLogin = (name, token) => {
    const resolvedName = name || tr("common.user");
    localStorage.removeItem('vendo_login_notice');
    setLoginNotice("");
    saveSession({ userName: resolvedName, token: token || null, ts: Date.now() });
    setUserName(resolvedName);
    navStack.current = []; // нова сесія — чистий стек навігації
    setScreen("dashboard");
  };

  const handleLogout = () => {
    clearSession();
    localStorage.removeItem('vendo_token'); // bearer-токен; повторний вхід видасть новий
    setUserName("");
    setOrderItems([]);
    setEditOrderId(null);
    setEditCustomer(null);
    navStack.current = [];
    setScreen("login");
  };

  // #40: сервер відхилив ПОТОЧНИЙ токен (401) — пристрій відв'язано (перегенерація коду
  // прив'язки в 1С). Виходимо на екран входу з поясненням; чернетки й офлайн-черга
  // лишаються (handleLogout їх не стирає, purgeOnDeviceSwitch для того ж пристрою — теж).
  // Пояснення — постійний банер на екрані входу (не снек: той зникає за 3 с, і причину
  // можна пропустити), звідти ж доступний журнал помилок для надсилання лога.
  const sessionRevoked = () => {
    if (screenRef.current === "login") return; // повторні 401 того самого циклу
    logWarn("Пристрій відв'язано сервером (401 із чинним токеном) — вихід на екран входу");
    localStorage.setItem('vendo_login_notice', 'login.revoked'); // i18n-ключ, не текст (мова може змінитися)
    setLoginNotice('login.revoked');
    handleLogout();
  };
  const sessionRevokedRef = useRef(sessionRevoked);
  sessionRevokedRef.current = sessionRevoked;
  useEffect(() => {
    setOnAuthReject(() => sessionRevokedRef.current());
    return () => setOnAuthReject(null);
  }, []);

  // #34: очистити всі локальні дані, ОКРІМ авторизації/налаштувань. Видаляємо все з
  // localStorage, крім keep-списку (підхід «все крім дозволеного» ловить і ключі через
  // константи: журнал, чернетки), + кеш зображень (IndexedDB), скидаємо стан і тягнемо заново.
  const clearData = () => {
    const KEEP = ['vendo_token', 'vendo_device_id', 'vendo_api_url', 'vendo_session', 'vendo_theme', 'vendo_lang'];
    Object.keys(localStorage).forEach(k => { if (!KEEP.includes(k)) localStorage.removeItem(k); });
    clearImageCache();
    clearDataCache();
    setProducts([]); setCategories([]); setCustomers([]); setOrders([]); setLoadError(null);
    setOrderItems([]); setEditOrderId(null); setEditCustomer(null);
    notify(tr('toast.dataCleared'));
    // Перезавантаження з сервера — ФОРСОВАНЕ (минаємо guard): на повільній 1С фоновий
    // цикл майже завжди «в польоті», і звичайний виклик пропустився б — екран лишався б
    // порожнім до наступного вдалого циклу. Кеш читати нема сенсу (щойно стерли).
    collectionsFpRef.current = {};
    fetchFromNetwork(false, true);
  };

  // Відкрити замовлення з історії синхронізацій (для вирішення конфлікту/помилки).
  const openOrderFromHistory = (id) => {
    const o = mergeOrders(orders, getLocalOrders()).find(x => x.id === id);
    if (o) { setShowSyncHistory(false); handleNav("orders", { order: o }); }
  };

  // Копіювати поточне замовлення в нове: лишаємо товари й контрагента, скидаємо
  // прив'язку до існуючого документа (стає "Нове", редаговане).
  const copyOrderToNew = () => {
    setEditOrderId(null);
    setEditStatus(STATUS.NEW);
    setEditLocked(false);
    setEditDate(null);
    setEditNum(nextDraftNum());
    setEditVersion(null);
    orderHandled.current = false;
    notify(tr("toast.copied"));
  };

  // Апаратний «назад»: повертаємось на попередній екран зі стека (а не завжди на головну).
  // Порожній стек (ми на стартовому екрані) → false, тоді дозволяємо вихід із додатку.
  const navigateBack = () => {
    if (navStack.current.length === 0) return false;
    if (screen === "orders") saveLeavingDraft(); // зберегти чернетку при виході з замовлення
    setScreen(navStack.current.pop());
    return true;
  };

  const handleNav = (s, params = {}) => {
    // Корінь навігації — завжди «Головна». Тап по таб-бару (params.root) скидає історію:
    // для Головної — порожньо (з неї «назад» = вихід), для решти табів — база [dashboard],
    // тож «назад» веде на Головну, а вже звідти — вихід. Інші переходи штовхають поточний
    // екран у стек (не штовхаємо при переході на той самий екран).
    if (params.root) navStack.current = s === "dashboard" ? [] : ["dashboard"];
    else if (s !== screen) navStack.current.push(screen);
    // Вихід з екрана замовлення (окрім переходу в каталог за товарами) — зберігаємо чернетку.
    if (screen === "orders" && !(s === "catalog" && params.keepOrder)) {
      saveLeavingDraft();
    }

    const deviceCurrency = products?.[0]?.currency || DEFAULT_CURRENCY;
    if (s === "orders" && params.order) {
      // Редагування існуючого замовлення з дашборду (ідентичність — GUID id)
      setEditOrderId(params.order.id);
      setEditCustomer(params.order.customer || null);
      setOrderItems(params.order.items || []);
      setEditLocked([STATUS.POSTED, STATUS.DELETED].includes(params.order.status)); // проведене/видалене — лише перегляд
      setEditDate(params.order.date || null);
      setEditStatus(params.order.status || STATUS.NEW);
      setEditNum(params.order.num || null);
      setEditVersion(params.order.version ?? null);
      setEditCurrency(params.order.currency || deviceCurrency); // заморожена валюта; старі → пристрою
      setEditPriceType(params.order.priceType || selectedPriceType); // тип цін замовлення
      orderBaseline.current = orderSig(params.order.items, params.order.customer?.id, params.order.date);
    } else if (s === "orders" && params.newOrder) {
      // Явно створюємо нове замовлення (наприклад, кнопка з дашборду)
      setEditOrderId(null);
      setEditCustomer(null);
      setOrderItems([]);
      setEditLocked(false);
      setEditDate(null);
      setEditStatus(STATUS.NEW);
      setEditNum(nextDraftNum());
      setEditVersion(null);
      setEditCurrency(deviceCurrency);
      setEditPriceType(selectedPriceType);
      orderBaseline.current = orderSig([], null, null);
    } else if (s === "catalog" && !params.keepOrder) {
      // Просто перехід в Товари - створюємо нове (скидаємо редаговане замовлення)
      setEditOrderId(null);
      setEditCustomer(null);
      setOrderItems([]);
      setEditLocked(false);
      setEditDate(null);
      setEditStatus(STATUS.NEW);
      setEditNum(nextDraftNum());
      setEditVersion(null);
      setEditCurrency(deviceCurrency);
      setEditPriceType(selectedPriceType);
      orderBaseline.current = orderSig([], null, null);
    }
    // В іншому випадку (наприклад, при переході з Каталогу в Orders) стан кошика зберігається
    setScreen(s);
  };

  // Вибір типу цін у каталозі. Одне замовлення = один тип цін (без мішанини):
  // • порожній кошик → просто перемикаємо тип (і глобальний дефолт);
  // • є позиції й тип інший → питаємо, чи перерахувати ціни (ConfirmDialog нижче).
  //   «Так» — recalcPriceType; «Ні» — лишаємо поточний тип і ціни (перемикання скасовано).
  const handleSelectPriceType = (id) => {
    if (editLocked || id === editPriceType) return; // проведене — лише перегляд; той самий — нічого
    if (orderItems.length === 0) { setSelectedPriceType(id); setEditPriceType(id); return; }
    // Одне замовлення = один тип. Якщо хоч одна позиція не має ціни нового типу (нуль або
    // відсутність — #45) — перемикання блокуємо (без мішанини) і перелічуємо ВСІ проблемні
    // товари, щоб продавець їх прибрав або лишив поточний тип. Ціну беремо з живого
    // каталогу (працює і для серверного замовлення).
    const noPrice = orderItems.filter(it => {
      const v = products.find(p => p.id === it.product.id)?.prices?.[id];
      return v == null || Number(v) <= 0;
    });
    if (noPrice.length) {
      const names = noPrice.map(it => it.product.name).join(", ");
      notify(tr("catalog.switchBlocked", { type: priceTypes.find(p => p.id === id)?.name || "", names }));
      return;
    }
    setPendingPriceType(id); // усі позиції мають ціну нового типу — питаємо про перерахунок
  };
  // Перерахунок цін усіх позицій на новий тип (гарантовано мають ціну — перевірено вище).
  const recalcPriceType = (id) => {
    setOrderItems(orderItems.map(it => ({ ...it, product: { ...it.product, price: products.find(p => p.id === it.product.id).prices[id] } })));
    setSelectedPriceType(id);
    setEditPriceType(id);
    setPendingPriceType("");
  };

  // Зміна кількості позиції в кошику. Додатна/від'ємна дельта; при <=0 — видалення.
  const handleAddToOrder = (product, qty) => {
    setOrderItems(prev => {
      const i = prev.findIndex(it => it.product.id === product.id);
      if (i >= 0) {
        const nq = prev[i].qty + qty;
        if (nq <= 0) return prev.filter((_, j) => j !== i);
        const n = [...prev]; n[i] = { ...n[i], qty: nq }; return n;
      }
      if (qty <= 0) return prev;
      return [...prev, { product, qty }];
    });
  };

  // Зсув плаваючих верхніх кластерів (глобальний TopActions + власні дії каталогу) на
  // висоту банера помилки, щоб вони лишались вирівняними з посунутим донизу контентом.
  const topOffset = loadError ? 42 : 0;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        button { -webkit-tap-highlight-color: transparent; color: inherit; }
        body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, system-ui, sans-serif; background: ${t.bg}; color: ${t.ink}; }
      `}</style>

      {/* Головний контейнер (з повноцінною висотою і нативним прокручуванням для Capacitor) */}
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: t.bg }}>

        {/* Постійний банер помилки завантаження — не зникає, доки завантаження не пройде.
            Тап відкриває журнал помилок (деталі + надсилання розробнику). */}
        {isLoggedIn && loadError && (
          <button onClick={() => setShowLog(true)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", border: "none", cursor: "pointer", background: t.errSoft, color: t.err, padding: "10px 16px", fontFamily: "inherit", borderBottom: `1px solid ${t.err}33` }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tr("error.loadBanner", { what: loadError.what })}</span>
            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, whiteSpace: "nowrap", flexShrink: 0 }}>{tr("error.details")} ›</span>
          </button>
        )}

        {/* Контент екрану */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {screen === "login" && <LoginScreen t={t} onLogin={handleLogin} onOpenHelp={() => setShowHelp(true)} notice={loginNotice} onOpenLog={() => setShowLog(true)} />}
          {screen === "dashboard" && <DashboardScreen t={t} onNav={handleNav} userName={userName} isOnline={isOnline} orders={orders} products={products} customers={customers} productsCount={products.length} customersCount={customers.length} refreshOrders={refreshOrders} onSync={doSync} syncing={syncing} onLogout={handleLogout} isDark={isDark} onToggleTheme={toggleTheme} onOpenLog={() => setShowLog(true)} hasErrors={!!loadError} connecting={connecting} onClearData={clearData} onOpenSyncHistory={() => setShowSyncHistory(true)} onOpenHelp={() => setShowHelp(true)} update={update} onShowUpdate={() => { setUpdPhase(null); setShowUpdatePrompt(true); }} />}
          {screen === "catalog" && <CatalogScreen t={t} onNav={handleNav} products={products} categories={categories} priceTypes={priceTypes} activePriceType={editPriceType || selectedPriceType} onSelectPriceType={handleSelectPriceType} onAddToOrder={handleAddToOrder} orderItems={orderItems} editOrderId={editOrderId} editNum={editNum} editDate={editDate} editCustomer={editCustomer} isOnline={isOnline} notify={notify} connecting={connecting} offsetTop={topOffset} />}
          {screen === "customers" && <CustomersScreen t={t} customers={customers} orders={orders} onNav={handleNav} isOnline={isOnline} connecting={connecting} />}
          {screen === "ordersList" && <OrdersListScreen t={t} onNav={handleNav} isOnline={isOnline} refreshOrders={refreshOrders} products={products} customers={customers} orders={orders} connecting={connecting} />}
          {screen === "orders" && <OrderScreen t={t} isOnline={isOnline} locked={editLocked} date={editDate} status={editStatus} num={editNum} baseVersion={editVersion} currency={editCurrency} priceType={editPriceType} pushDate={setEditDate} notify={notify} onCopy={copyOrderToNew} markHandled={() => { orderHandled.current = true; }} orderItems={orderItems} setOrderItems={setOrderItems} customers={customers} products={products} refreshOrders={refreshOrders} editOrderId={editOrderId} setEditOrderId={setEditOrderId} editCustomer={editCustomer} setEditCustomer={setEditCustomer} goToOrdersList={() => handleNav("ordersList")} goToCatalog={() => handleNav("catalog", { keepOrder: true })} />}
        </div>

        {/* Нижня навігація (тільки після логіну) */}
        {isLoggedIn && screen !== "orders" && <BottomNav active={screen} onNav={(s) => handleNav(s, { root: true })} t={t} />}
      </div>

      {/* Індикатор онлайн/офлайн — завжди в правому верхньому куті, однакове положення на всіх екранах */}
      {!showLog && !showSyncHistory && !showHelp && ["dashboard", "catalog", "customers", "ordersList"].includes(screen) &&
        <TopActions t={t} online={isOnline} connecting={connecting} syncing={syncing} pending={getLocalOrders().length} onSync={doSync} offsetTop={topOffset} />}

      {/* Плаваюче повідомлення (збереження/відправка) — на рівні App, переживає навігацію */}
      <Snackbar msg={toast} t={t} />

      {/* Журнал помилок: деталі + надсилання логу розробнику */}
      {showLog && <LogPanel t={t} onClose={() => setShowLog(false)} />}

      {/* Історія синхронізацій: прогони + per-order результат, перехід у замовлення */}
      {showSyncHistory && <SyncHistoryPanel t={t} onClose={() => setShowSyncHistory(false)} onOpenOrder={openOrderFromHistory} />}

      {/* Вбудована довідка (markdown із docs/user-guide) */}
      {showHelp && <HelpScreen t={t} onClose={() => setShowHelp(false)} />}

      {/* Єдиний лайтбокс фото (каталог + замовлення); закривається апаратним «назад» */}
      <Lightbox />

      {/* Промпт оновлення — глобальний, поверх будь-якого екрана (зокрема логіну) */}
      {showUpdatePrompt && <UpdatePrompt t={t} appVersion={APP_VERSION} update={update} phase={updPhase} progress={updProgress} onStart={startUpdate} onLater={closeUpdate} onOpenSettings={openInstallSettings} />}

      {/* Підтвердження зміни типу цін для замовлення з позиціями (перерахувати / лишити поточний) */}
      {pendingPriceType && (
        <ConfirmDialog t={t} icon="info" danger={false}
          title={tr("catalog.recalcTitle")}
          body={tr("catalog.recalcBody", { type: priceTypes.find(p => p.id === pendingPriceType)?.name || "" })}
          confirmLabel={tr("catalog.recalcYes")} cancelLabel={tr("catalog.recalcNo")}
          onConfirm={() => recalcPriceType(pendingPriceType)}
          onCancel={() => setPendingPriceType("")} />
      )}
    </>
  );
}
