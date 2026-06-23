import React, { useState, useEffect, useRef } from 'react';
import { LIGHT, DARK } from './theme';
import { BottomNav, OnlineIndicator } from './components/ui';
import { Snackbar } from './components/Shared';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { OrderScreen } from './screens/OrderScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { fetchProducts, fetchCategories, fetchCustomers, fetchOrders } from './api/client';
import { getSession, saveSession, clearSession } from './api/session';
import { saveLocalOrder } from './api/localOrders';

// Сигнатура замовлення (товари+контрагент+дата) — для порівняння «чи щось змінилось».
const orderSig = (items, custId, date) =>
  JSON.stringify({ i: (items || []).map(it => [it.product?.id, it.qty]), c: custId ?? null, d: date || null });

// Тема: збережений вибір користувача (vendo_theme) має пріоритет; інакше — системна.
const getInitialDark = () => {
  const saved = localStorage.getItem('vendo_theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
};

export default function App() {
  const [isDark, setIsDark] = useState(getInitialDark);
  // Відновлюємо збережену сесію (#24): якщо вона є, пропускаємо екран логіну.
  const [screen, setScreen] = useState(() => getSession() ? "dashboard" : "login");
  const [isOnline, setIsOnline] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [userName, setUserName] = useState(() => getSession()?.userName || "");
  const [orderItems, setOrderItems] = useState([]);
  const [editOrderId, setEditOrderId] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [editLocked, setEditLocked] = useState(false); // проведене в 1С замовлення — лише перегляд
  const [editDate, setEditDate] = useState(null); // дата редагованого замовлення (null = нове)
  const [editStatus, setEditStatus] = useState("Нове"); // статус замовлення на екрані (Нове/Відправлено/Проведено)
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [toast, setToast] = useState(""); // плаваюче повідомлення (збереження/відправка)
  const orderHandled = useRef(false); // OrderScreen уже зберіг/відправив — не дублювати на виході
  const orderBaseline = useRef(""); // знімок замовлення на момент відкриття (щоб зберігати лише за змінами)

  const t = isDark ? DARK : LIGHT;

  // Плаваюче повідомлення, що переживає навігацію (на відміну від снека всередині екрана).
  const notify = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };
  const orderLabel = (num) => String(num).startsWith("local_") ? `№${String(num).slice(-4)}` : num;
  const fmtDate = (iso) => iso ? String(iso).split("-").reverse().join(".") : "";

  // Зберегти поточне (нове/редаговане) замовлення як чернетку при виході з екрана.
  // Викликається з handleNav; пропускається, якщо OrderScreen уже сам зберіг/відправив.
  const saveLeavingDraft = () => {
    if (orderHandled.current) { orderHandled.current = false; return; }
    if (editLocked || orderItems.length === 0) return;
    // Лише нові/локальні чернетки. Наявне серверне замовлення (реальний номер) при
    // простому перегляді не дублюємо в локальну чергу — його зберігають явно (Відправити).
    if (editOrderId && !String(editOrderId).startsWith("local_")) return;
    // Нічого не змінилось від моменту відкриття — не зберігаємо й не показуємо повідомлення.
    if (orderSig(orderItems, editCustomer?.id, editDate) === orderBaseline.current) return;
    const total = orderItems.reduce((s, it) => s + it.product.price * it.qty, 0);
    const num = saveLocalOrder({
      num: editOrderId || undefined,
      customer: editCustomer || null,
      customerId: editCustomer?.id || null,
      client: editCustomer?.name || "Невідомий клієнт",
      items: orderItems,
      date: editDate || undefined,
      total: `${total.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`,
      status: "Нове",
      sColor: t.warn,
    });
    notify(`Збережено ${orderLabel(num)} · ${fmtDate(editDate) || "сьогодні"}`);
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
      const cached = localStorage.getItem('cached_data');
      if (!cached) return false;
      const data = JSON.parse(cached);
      setProducts(data.products || []);
      setCategories(data.categories || []);
      setCustomers(data.customers || []);
      setOrders(data.orders || []);
      return true;
    } catch (e) {
      console.error("Помилка відновлення кешу", e);
      return false;
    }
  };

  // 2) Тягнемо мережу у фоні; на успіх — оновлюємо стан і кеш.
  // silent=true — тихе фонове перечитування (без анімації індикатора): дані й стан
  // онлайн оновлюються, але "connecting" не вмикаємо, щоб значок не миготів щоразу.
  const fetchFromNetwork = async (silent = false) => {
    if (!silent) setConnecting(true);
    try {
      const [prodRes, catRes, custRes, ordRes] = await Promise.all([
        fetchProducts(), fetchCategories(), fetchCustomers(), fetchOrders()
      ]);
      setProducts(prodRes);
      setCategories(catRes);
      setCustomers(custRes);
      setOrders(ordRes);
      localStorage.setItem('cached_data', JSON.stringify({
        products: prodRes, categories: catRes, customers: custRes, orders: ordRes
      }));
      localStorage.setItem('vendo_last_sync', String(Date.now())); // час останньої успішної синхронізації
      setIsOnline(true);
      return true;
    } catch (e) {
      console.warn("Мережа недоступна — лишаємось на кеші.", e);
      setIsOnline(false);
      return false;
    } finally {
      if (!silent) setConnecting(false);
    }
  };

  // Запуск: спершу кеш (одразу), далі мережа у фоні (не блокує UI).
  const loadData = async () => {
    loadFromCache();
    await fetchFromNetwork();
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

  const handleLogin = (name, token) => {
    const resolvedName = name || "Користувач";
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

  // Копіювати поточне замовлення в нове: лишаємо товари й контрагента, скидаємо
  // прив'язку до існуючого документа (стає "Нове", редаговане).
  const copyOrderToNew = () => {
    setEditOrderId(null);
    setEditStatus("Нове");
    setEditLocked(false);
    setEditDate(null);
    orderHandled.current = false;
    notify("Замовлення скопійовано в нове");
  };

  const handleNav = (s, params = {}) => {
    // Вихід з екрана замовлення (окрім переходу в каталог за товарами) — зберігаємо чернетку.
    if (screen === "orders" && !(s === "catalog" && params.keepOrder)) {
      saveLeavingDraft();
    }

    if (s === "orders" && params.order) {
      // Редагування існуючого замовлення з дашборду
      setEditOrderId(params.order.num);
      setEditCustomer(params.order.customer || null);
      setOrderItems(params.order.items || []);
      setEditLocked(params.order.status === "Проведено"); // проведене в 1С — лише перегляд
      setEditDate(params.order.date || null);
      setEditStatus(params.order.status || "Нове");
      orderBaseline.current = orderSig(params.order.items, params.order.customer?.id, params.order.date);
    } else if (s === "orders" && params.newOrder) {
      // Явно створюємо нове замовлення (наприклад, кнопка з дашборду)
      setEditOrderId(null);
      setEditCustomer(null);
      setOrderItems([]);
      setEditLocked(false);
      setEditDate(null);
      setEditStatus("Нове");
      orderBaseline.current = orderSig([], null, null);
    } else if (s === "catalog" && !params.keepOrder) {
      // Просто перехід в Товари - створюємо нове (скидаємо редаговане замовлення)
      setEditOrderId(null);
      setEditCustomer(null);
      setOrderItems([]);
      setEditLocked(false);
      setEditDate(null);
      setEditStatus("Нове");
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

        {/* Контент екрану */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {screen === "login" && <LoginScreen t={t} onLogin={handleLogin} />}
          {screen === "dashboard" && <DashboardScreen t={t} onNav={handleNav} userName={userName} isOnline={isOnline} orders={orders} productsCount={products.length} customersCount={customers.length} refreshOrders={loadData} onLogout={handleLogout} isDark={isDark} onToggleTheme={toggleTheme} />}
          {screen === "catalog" && <CatalogScreen t={t} onNav={handleNav} products={products} categories={categories} onAddToOrder={handleAddToOrder} orderItems={orderItems} editOrderId={editOrderId} editCustomer={editCustomer} isOnline={isOnline} />}
          {screen === "customers" && <CustomersScreen t={t} customers={customers} isOnline={isOnline} />}
          {screen === "ordersList" && <OrdersListScreen t={t} onNav={handleNav} isOnline={isOnline} refreshOrders={loadData} />}
          {screen === "orders" && <OrderScreen t={t} isOnline={isOnline} locked={editLocked} date={editDate} status={editStatus} pushDate={setEditDate} notify={notify} onCopy={copyOrderToNew} markHandled={() => { orderHandled.current = true; }} orderItems={orderItems} setOrderItems={setOrderItems} customers={customers} refreshOrders={loadData} editOrderId={editOrderId} setEditOrderId={setEditOrderId} editCustomer={editCustomer} setEditCustomer={setEditCustomer} goToOrdersList={() => handleNav("ordersList")} goToCatalog={() => handleNav("catalog", { keepOrder: true })} />}
        </div>

        {/* Нижня навігація (тільки після логіну) */}
        {isLoggedIn && <BottomNav active={screen} onNav={handleNav} t={t} />}
      </div>

      {/* Індикатор онлайн/офлайн — завжди в правому верхньому куті, однакове положення на всіх екранах */}
      {isLoggedIn && <OnlineIndicator t={t} online={isOnline} connecting={connecting} floating />}

      {/* Плаваюче повідомлення (збереження/відправка) — на рівні App, переживає навігацію */}
      <Snackbar msg={toast} t={t} />
    </>
  );
}
