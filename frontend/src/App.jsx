import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LIGHT, DARK } from './theme';
import { BottomNav, TopActions } from './components/ui';
import { Snackbar } from './components/Shared';
import { LogPanel } from './components/LogPanel';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { OrderScreen } from './screens/OrderScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { fetchProducts, fetchCategories, fetchCustomers, fetchOrders, createOrder, deleteOrder, restoreOrder, fetchAuthedBlobRaw } from './api/client';
import { prefetchImages, clearImageCache } from './api/imageCache';
import { logWarn } from './logger';
import { getSession, saveSession, clearSession } from './api/session';
import { saveLocalOrder, getLocalOrders, removeLocalOrder, setLocalOrderError, nextDraftNum } from './api/localOrders';
import { idSet, checkOrderRefs, mergeOrders } from './api/refs';
import { addSyncRun } from './api/syncHistory';
import { SyncHistoryPanel } from './components/SyncHistoryPanel';
import { HelpScreen } from './screens/HelpScreen';

// Сума з рядка ("4 280 ₴") або числа → Number.
const parseMoney = (v) => typeof v === 'number' ? v : (Number(String(v || '').replace(/[^\d.-]/g, '')) || 0);

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
  const [connecting, setConnecting] = useState(true); // true на старті: до першого завантаження показуємо спінер, а не «порожньо»
  const [userName, setUserName] = useState(() => getSession()?.userName || "");
  const [orderItems, setOrderItems] = useState([]);
  const [editOrderId, setEditOrderId] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [editLocked, setEditLocked] = useState(false); // проведене в 1С замовлення — лише перегляд
  const [editDate, setEditDate] = useState(null); // дата редагованого замовлення (null = нове)
  const [editStatus, setEditStatus] = useState("Нове"); // статус замовлення на екрані (Нове/Відправлено/Проведено)
  const [editNum, setEditNum] = useState(null); // номер документа (null для невідправленого) — лише для показу
  const [editVersion, setEditVersion] = useState(null); // токен версії на момент відкриття (для виявлення конфліктів)
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [toast, setToast] = useState(""); // плаваюче повідомлення (збереження/відправка)
  const [loadError, setLoadError] = useState(null); // {what, message} — постійна помилка завантаження (банер), null = немає
  const [showLog, setShowLog] = useState(false); // відкрита панель журналу помилок
  const [showSyncHistory, setShowSyncHistory] = useState(false); // відкрита панель історії синхронізацій
  const [showHelp, setShowHelp] = useState(false); // відкрита вбудована довідка
  const [syncing, setSyncing] = useState(false); // активна ручна синхронізація (для індикатора)
  const fetchingRef = useRef(false); // мережеве перечитування в процесі — не накладати цикли (повільний сервер)
  const orderHandled = useRef(false); // OrderScreen уже зберіг/відправив — не дублювати на виході
  const orderBaseline = useRef(""); // знімок замовлення на момент відкриття (щоб зберігати лише за змінами)

  const t = isDark ? DARK : LIGHT;

  // Плаваюче повідомлення, що переживає навігацію (на відміну від снека всередині екрана).
  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };
  // Людський лейбл замовлення: номер документа, якщо присвоєний; інакше короткий №<id>.
  const orderLabel = (o) => (o && o.num) ? o.num : (o && o.id ? `№${String(o.id).slice(0, 8)}` : "");
  const fmtDate = (iso) => iso ? String(iso).split("-").reverse().join(".") : "";

  // Зберегти поточне (нове/редаговане) замовлення як чернетку при виході з екрана.
  // Викликається з handleNav; пропускається, якщо OrderScreen уже сам зберіг/відправив.
  const saveLeavingDraft = () => {
    if (orderHandled.current) { orderHandled.current = false; return; }
    if (editLocked || orderItems.length === 0) return;
    // Черга охоплює нові ("Нове") та правки вже відправлених ("Відправлено") замовлень.
    // Проведені/видалені редагувати не можна (editLocked) — у чергу не потраплять.
    if (editOrderId && !["Нове", "Відправлено"].includes(editStatus)) return;
    // Нічого не змінилось від моменту відкриття — не зберігаємо й не показуємо повідомлення.
    if (orderSig(orderItems, editCustomer?.id, editDate) === orderBaseline.current) return;
    const total = orderItems.reduce((s, it) => s + it.product.price * it.qty, 0);
    // Зберігаємо реальний статус: правка відправленого лишається "Відправлено" (черга
    // на оновлення), нове — "Нове". Так doSync зробить upsert із правильним статусом.
    const queueStatus = editStatus === "Відправлено" ? "Відправлено" : "Нове";
    const id = saveLocalOrder({
      id: editOrderId || undefined,
      num: editNum || undefined,
      customer: editCustomer || null,
      customerId: editCustomer?.id || null,
      client: editCustomer?.name || tr("common.unknownClient"),
      items: orderItems,
      date: editDate || undefined,
      total: `${total.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`,
      status: queueStatus,
      sColor: queueStatus === "Відправлено" ? t.ok : t.warn,
      // База версії лише для правок серверного замовлення (виявлення конфлікту).
      baseVersion: queueStatus === "Відправлено" ? editVersion : undefined,
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

  const toggleTheme = () => setIsDark(d => {
    const next = !d;
    localStorage.setItem('vendo_theme', next ? 'dark' : 'light');
    return next;
  });

  // 1) Миттєво показуємо кеш (offline-first), щоб UI не чекав мережі.
  const loadFromCache = () => {
    try {
      const cached = localStorage.getItem('cached_data_v2'); // v2: GUID-ідентифікація (старий кеш із цілими id ігноруємо)
      if (!cached) return false;
      const data = JSON.parse(cached);
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
      // allSettled, а не all: один повільний/таймнутий запит НЕ валить усе в офлайн.
      const [prodR, catR, custR, ordR] = await Promise.allSettled([
        fetchProducts(), fetchCategories(), fetchCustomers(), fetchOrders()
      ]);
      const all = [prodR, catR, custR, ordR];
      const okCount = all.filter(r => r.status === 'fulfilled').length;
      if (okCount === 0) { setIsOnline(false); return false; } // справді недоступно — лишаємось на кеші
      setIsOnline(true);

      // Оновлюємо лише ті колекції, що прийшли; rejected (мережевий таймаут) не затирає дані.
      // arr() коерсить {success:false} до [], інакше .map на екрані валить у білий екран.
      if (prodR.status === 'fulfilled') setProducts(arr(prodR.value));
      if (catR.status === 'fulfilled') setCategories(arr(catR.value));
      if (custR.status === 'fulfilled') setCustomers(arr(custR.value));
      if (ordR.status === 'fulfilled') setOrders(arr(ordR.value));

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
      // Кеш даних — лише з повного знімка (усі 4), щоб не зберігати часткове.
      if (okCount === 4) {
        localStorage.setItem('cached_data_v2', JSON.stringify({
          products: arr(prodR.value), categories: arr(catR.value), customers: arr(custR.value), orders: arr(ordR.value)
        }));
        localStorage.setItem('vendo_last_sync', String(Date.now())); // час останньої успішної синхронізації
      }
      return true;
    } catch (e) {
      console.warn("Мережа недоступна — лишаємось на кеші.", e);
      setIsOnline(false);
      return false;
    } finally {
      fetchingRef.current = false;
      if (!silent) setConnecting(false);
    }
  };

  // Запуск: спершу кеш (одразу), далі мережа у фоні (не блокує UI).
  const loadData = async () => {
    loadFromCache();
    await fetchFromNetwork();
  };

  // Оновлення після дій (видалення/відновлення/збереження замовлення): форсований
  // мережевий рефетч БЕЗ скидання в кеш (інакше loadFromCache повернув би стару версію,
  // а guard заблокував би оновлення). Тихо, щоб не миготів індикатор.
  const refreshOrders = () => fetchFromNetwork(true, true);

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
          }
          removeLocalOrder(o.id); sent++; rec(o, 'sent'); continue;
        }
        if (o.op === 'restore') {
          const r = await restoreOrder(o.id, o.baseVersion);
          if (r && r.conflict) { setLocalOrderError(o.id, r.message || "Конфлікт версій", true, r.serverState || null); conflict++; rec(o, 'conflict', r.message); continue; }
          if (!r || !r.success) throw new Error(r?.message || "Відновлення відхилено");
          removeLocalOrder(o.id); sent++; rec(o, 'sent'); continue;
        }
        if (canCheck && !checkOrderRefs(o, prodIds, custIds).ok) { setLocalOrderError(o.id, "Посилання на видалені дані"); skipped++; rec(o, 'skipped', "Посилання на видалені дані"); continue; }
        const res = await createOrder(o.id, o.items, o.customerId, parseMoney(o.total), "Відправлено", o.date, o.baseVersion, o.deletionMark);
        if (res && res.conflict) { setLocalOrderError(o.id, res.message || "Конфлікт версій", true, res.serverState || null); conflict++; rec(o, 'conflict', res.message); continue; }
        if (!res || !res.success) throw new Error(res?.message || "Сервер відхилив замовлення");
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
  };

  useEffect(() => {
    // Повернення звʼязку/додатку на передній план — одразу тягнемо свіже.
    const handleOnline = () => fetchFromNetwork(true);
    const handleOffline = () => setIsOnline(false);
    const handleVisible = () => { if (document.visibilityState === 'visible') fetchFromNetwork(true); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisible);

    loadData();

    // Фонова синхронізація: тихо перечитуємо дані кожні 20с (цей же запит визначає
    // онлайн/офлайн). Так нові товари/замовлення з сервера підтягуються самі, поки
    // додаток онлайн, — а не лише при переході офлайн→онлайн, як було раніше.
    const syncInterval = setInterval(() => { fetchFromNetwork(true); }, 20000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
      clearInterval(syncInterval);
    };
  }, []);

  // Апаратна кнопка «Назад» (Android): без обробника Capacitor одразу виходить із додатку.
  // Перехоплюємо й навігуємо всередині: журнал → закрити; підекран → на головну; головна/
  // логін → вихід. Перепідписка на зміну screen/showLog, щоб у замиканні були свіжі значення.
  useEffect(() => {
    let handle, cancelled = false;
    import('@capacitor/app').then(async ({ App: CapApp }) => {
      const h = await CapApp.addListener('backButton', () => {
        if (showHelp) { setShowHelp(false); return; }
        if (showLog) { setShowLog(false); return; }
        if (screen !== 'dashboard' && screen !== 'login') { handleNav('dashboard'); return; }
        CapApp.exitApp();
      });
      if (cancelled) h.remove(); else handle = h;
    }).catch(() => {});
    return () => { cancelled = true; if (handle) handle.remove(); };
  }, [screen, showLog, showHelp]);

  const handleLogin = (name, token) => {
    const resolvedName = name || tr("common.user");
    saveSession({ userName: resolvedName, token: token || null, ts: Date.now() });
    setUserName(resolvedName);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    clearSession();
    localStorage.removeItem('vendo_token'); // bearer-токен; повторний вхід видасть новий
    setUserName("");
    setOrderItems([]);
    setEditOrderId(null);
    setEditCustomer(null);
    setScreen("login");
  };

  // #34: очистити всі локальні дані, ОКРІМ авторизації/налаштувань. Видаляємо все з
  // localStorage, крім keep-списку (підхід «все крім дозволеного» ловить і ключі через
  // константи: журнал, чернетки), + кеш зображень (IndexedDB), скидаємо стан і тягнемо заново.
  const clearData = () => {
    const KEEP = ['vendo_token', 'vendo_device_id', 'vendo_api_url', 'vendo_session', 'vendo_theme', 'vendo_lang'];
    Object.keys(localStorage).forEach(k => { if (!KEEP.includes(k)) localStorage.removeItem(k); });
    clearImageCache();
    setProducts([]); setCategories([]); setCustomers([]); setOrders([]); setLoadError(null);
    setOrderItems([]); setEditOrderId(null); setEditCustomer(null);
    notify(tr('toast.dataCleared'));
    loadData(); // перезавантажити з сервера у фоні
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
    setEditStatus("Нове");
    setEditLocked(false);
    setEditDate(null);
    setEditNum(nextDraftNum());
    setEditVersion(null);
    orderHandled.current = false;
    notify(tr("toast.copied"));
  };

  const handleNav = (s, params = {}) => {
    // Вихід з екрана замовлення (окрім переходу в каталог за товарами) — зберігаємо чернетку.
    if (screen === "orders" && !(s === "catalog" && params.keepOrder)) {
      saveLeavingDraft();
    }

    if (s === "orders" && params.order) {
      // Редагування існуючого замовлення з дашборду (ідентичність — GUID id)
      setEditOrderId(params.order.id);
      setEditCustomer(params.order.customer || null);
      setOrderItems(params.order.items || []);
      setEditLocked(["Проведено", "Видалено"].includes(params.order.status)); // проведене/видалене — лише перегляд
      setEditDate(params.order.date || null);
      setEditStatus(params.order.status || "Нове");
      setEditNum(params.order.num || null);
      setEditVersion(params.order.version ?? null);
      orderBaseline.current = orderSig(params.order.items, params.order.customer?.id, params.order.date);
    } else if (s === "orders" && params.newOrder) {
      // Явно створюємо нове замовлення (наприклад, кнопка з дашборду)
      setEditOrderId(null);
      setEditCustomer(null);
      setOrderItems([]);
      setEditLocked(false);
      setEditDate(null);
      setEditStatus("Нове");
      setEditNum(nextDraftNum());
      setEditVersion(null);
      orderBaseline.current = orderSig([], null, null);
    } else if (s === "catalog" && !params.keepOrder) {
      // Просто перехід в Товари - створюємо нове (скидаємо редаговане замовлення)
      setEditOrderId(null);
      setEditCustomer(null);
      setOrderItems([]);
      setEditLocked(false);
      setEditDate(null);
      setEditStatus("Нове");
      setEditNum(nextDraftNum());
      setEditVersion(null);
      orderBaseline.current = orderSig([], null, null);
    }
    // В іншому випадку (наприклад, при переході з Каталогу в Orders) стан кошика зберігається
    setScreen(s);
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

  const isLoggedIn = screen !== "login";

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
          {screen === "login" && <LoginScreen t={t} onLogin={handleLogin} onOpenHelp={() => setShowHelp(true)} />}
          {screen === "dashboard" && <DashboardScreen t={t} onNav={handleNav} userName={userName} isOnline={isOnline} orders={orders} products={products} customers={customers} productsCount={products.length} customersCount={customers.length} refreshOrders={refreshOrders} onSync={doSync} syncing={syncing} onLogout={handleLogout} isDark={isDark} onToggleTheme={toggleTheme} onOpenLog={() => setShowLog(true)} hasErrors={!!loadError} connecting={connecting} onClearData={clearData} onOpenSyncHistory={() => setShowSyncHistory(true)} onOpenHelp={() => setShowHelp(true)} />}
          {screen === "catalog" && <CatalogScreen t={t} onNav={handleNav} products={products} categories={categories} onAddToOrder={handleAddToOrder} orderItems={orderItems} editOrderId={editOrderId} editCustomer={editCustomer} isOnline={isOnline} notify={notify} connecting={connecting} />}
          {screen === "customers" && <CustomersScreen t={t} customers={customers} isOnline={isOnline} connecting={connecting} />}
          {screen === "ordersList" && <OrdersListScreen t={t} onNav={handleNav} isOnline={isOnline} refreshOrders={refreshOrders} products={products} customers={customers} orders={orders} connecting={connecting} />}
          {screen === "orders" && <OrderScreen t={t} isOnline={isOnline} locked={editLocked} date={editDate} status={editStatus} num={editNum} baseVersion={editVersion} pushDate={setEditDate} notify={notify} onCopy={copyOrderToNew} markHandled={() => { orderHandled.current = true; }} orderItems={orderItems} setOrderItems={setOrderItems} customers={customers} products={products} refreshOrders={refreshOrders} editOrderId={editOrderId} setEditOrderId={setEditOrderId} editCustomer={editCustomer} setEditCustomer={setEditCustomer} goToOrdersList={() => handleNav("ordersList")} goToCatalog={() => handleNav("catalog", { keepOrder: true })} />}
        </div>

        {/* Нижня навігація (тільки після логіну) */}
        {isLoggedIn && <BottomNav active={screen} onNav={handleNav} t={t} />}
      </div>

      {/* Індикатор онлайн/офлайн — завжди в правому верхньому куті, однакове положення на всіх екранах */}
      {!showLog && !showSyncHistory && !showHelp && ["dashboard", "catalog", "customers", "ordersList"].includes(screen) &&
        <TopActions t={t} online={isOnline} connecting={connecting} syncing={syncing} pending={getLocalOrders().length} onSync={doSync} offsetTop={loadError ? 42 : 0} />}

      {/* Плаваюче повідомлення (збереження/відправка) — на рівні App, переживає навігацію */}
      <Snackbar msg={toast} t={t} />

      {/* Журнал помилок: деталі + надсилання логу розробнику */}
      {showLog && <LogPanel t={t} onClose={() => setShowLog(false)} />}

      {/* Історія синхронізацій: прогони + per-order результат, перехід у замовлення */}
      {showSyncHistory && <SyncHistoryPanel t={t} onClose={() => setShowSyncHistory(false)} onOpenOrder={openOrderFromHistory} />}

      {/* Вбудована довідка (markdown із docs/user-guide) */}
      {showHelp && <HelpScreen t={t} onClose={() => setShowHelp(false)} />}
    </>
  );
}
