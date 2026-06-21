import React, { useState, useEffect } from 'react';
import { LIGHT, DARK } from './theme';
import { BottomNav, OnlineIndicator } from './components/ui';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { OrderScreen } from './screens/OrderScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { fetchProducts, fetchCategories, fetchCustomers, fetchOrders, pingServer } from './api/client';
import { getSession, saveSession, clearSession } from './api/session';

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
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);

  const t = isDark ? DARK : LIGHT;

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
  const fetchFromNetwork = async () => {
    setConnecting(true);
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
      setIsOnline(true);
      return true;
    } catch (e) {
      console.warn("Мережа недоступна — лишаємось на кеші.", e);
      setIsOnline(false);
      return false;
    } finally {
      setConnecting(false);
    }
  };

  // Запуск: спершу кеш (одразу), далі мережа у фоні (не блокує UI).
  const loadData = async () => {
    loadFromCache();
    await fetchFromNetwork();
  };

  useEffect(() => {
    // В реальному додатку можна слухати Capacitor Network API
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadData();

    // Фоновий пінг для перевірки доступності бекенду
    const pingInterval = setInterval(async () => {
      const isUp = await pingServer();
      setIsOnline(prev => {
        if (prev !== isUp) {
          // Сервер знову доступний — тягнемо свіжі дані (без миготіння кешем)
          if (isUp) fetchFromNetwork();
          return isUp;
        }
        return prev;
      });
    }, 15000); // кожні 15 секунд

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
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
    setUserName("");
    setOrderItems([]);
    setEditOrderId(null);
    setEditCustomer(null);
    setScreen("login");
  };

  const handleNav = (s, params = {}) => {
    if (s === "orders" && params.order) {
      // Редагування існуючого замовлення з дашборду
      setEditOrderId(params.order.num);
      setEditCustomer(params.order.customer || null);
      setOrderItems(params.order.items || []);
    } else if (s === "orders" && params.newOrder) {
      // Явно створюємо нове замовлення (наприклад, кнопка з дашборду)
      setEditOrderId(null);
      setEditCustomer(null);
      setOrderItems([]);
    } else if (s === "catalog" && !params.keepOrder) {
      // Просто перехід в Товари - створюємо нове (скидаємо редаговане замовлення)
      setEditOrderId(null);
      setEditCustomer(null);
      setOrderItems([]);
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
          {screen === "orders" && <OrderScreen t={t} isOnline={isOnline} orderItems={orderItems} setOrderItems={setOrderItems} customers={customers} refreshOrders={loadData} editOrderId={editOrderId} setEditOrderId={setEditOrderId} editCustomer={editCustomer} setEditCustomer={setEditCustomer} goToOrdersList={() => handleNav("ordersList")} goToCatalog={() => handleNav("catalog", { keepOrder: true })} />}
        </div>

        {/* Нижня навігація (тільки після логіну) */}
        {isLoggedIn && <BottomNav active={screen} onNav={handleNav} t={t} />}
      </div>

      {/* Індикатор онлайн/офлайн — завжди в правому верхньому куті, однакове положення на всіх екранах */}
      {isLoggedIn && <OnlineIndicator t={t} online={isOnline} connecting={connecting} floating />}
    </>
  );
}
