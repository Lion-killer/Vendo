import React, { useState, useEffect } from 'react';
import { LIGHT, DARK } from './theme';
import { Icon } from './components/Icon';
import { PhoneFrame, BottomNav } from './components/Shared';
import { LoginScreen } from './screens/LoginScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { CatalogScreen } from './screens/CatalogScreen';
import { CustomersScreen } from './screens/CustomersScreen';
import { OrderScreen } from './screens/OrderScreen';
import { OrdersListScreen } from './screens/OrdersListScreen';
import { fetchProducts, fetchCategories, fetchCustomers, fetchOrders, pingServer } from './api/client';

export default function App() {
  const [isDark, setIsDark] = useState(false);
  const [screen, setScreen] = useState("login");
  const [isOnline, setIsOnline] = useState(true);
  const [userName, setUserName] = useState("");
  const [orderItems, setOrderItems] = useState([]);
  const [editOrderId, setEditOrderId] = useState(null);
  const [editCustomer, setEditCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);

  const t = isDark ? DARK : LIGHT;

  const loadData = async () => {
    try {
      if (!navigator.onLine) {
        throw new Error("Offline mode detected via navigator");
      }

      const [prodRes, catRes, custRes, ordRes] = await Promise.all([
        fetchProducts(),
        fetchCategories(),
        fetchCustomers(),
        fetchOrders()
      ]);
      setProducts(prodRes);
      setCategories(catRes);
      setCustomers(custRes);
      setOrders(ordRes);

      // Save to cache for offline usage
      localStorage.setItem('cached_data', JSON.stringify({
        products: prodRes,
        categories: catRes,
        customers: custRes,
        orders: ordRes
      }));

      setIsOnline(true);
    } catch (e) {
      console.warn("Помилка завантаження (можливо офлайн). Завантажуємо кеш...", e);
      setIsOnline(false);

      try {
        const cached = localStorage.getItem('cached_data');
        if (cached) {
          const data = JSON.parse(cached);
          setProducts(data.products || []);
          setCategories(data.categories || []);
          setCustomers(data.customers || []);
          setOrders(data.orders || []);
        }
      } catch (cacheErr) {
        console.error("Помилка відновлення кешу", cacheErr);
      }
    }
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
          // Якщо сервер став доступним, можна опціонально перезавантажити дані
          if (isUp) loadData();
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

  const handleLogin = (name) => {
    setUserName(name || "Користувач");
    setScreen("dashboard");
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

  const handleAddToOrder = (product, qty) => {
    setOrderItems(prev => {
      const existing = prev.findIndex(i => i.product.id === product.id);
      if (existing >= 0) { const n = [...prev]; n[existing] = { ...n[existing], qty: n[existing].qty + qty }; return n; }
      return [...prev, { product, qty }];
    });
  };

  const isLoggedIn = screen !== "login";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity:0; } to { transform: translateY(0); opacity:1; } }
        button { -webkit-tap-highlight-color: transparent; }
        body { margin: 0; padding: 0; font-family: 'Nunito', sans-serif; background: ${t.bg}; color: ${t.text}; }
      `}</style>

      {/* Головний контейнер (з повноцінною висотою і нативним прокручуванням для Capacitor) */}
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: t.bg }}>

        {/* Контент екрану */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {screen === "login" && <LoginScreen t={t} onLogin={handleLogin} />}
          {screen === "dashboard" && <DashboardScreen t={t} onNav={handleNav} userName={userName} isOnline={isOnline} orders={orders} refreshOrders={loadData} />}
          {screen === "catalog" && <CatalogScreen t={t} onNav={handleNav} products={products} categories={categories} onAddToOrder={handleAddToOrder} orderItemsCount={orderItems.length} editOrderId={editOrderId} editCustomer={editCustomer} />}
          {screen === "customers" && <CustomersScreen t={t} customers={customers} />}
          {screen === "ordersList" && <OrdersListScreen t={t} onNav={handleNav} isOnline={isOnline} refreshOrders={loadData} />}
          {screen === "orders" && <OrderScreen t={t} isOnline={isOnline} orderItems={orderItems} setOrderItems={setOrderItems} customers={customers} refreshOrders={loadData} editOrderId={editOrderId} setEditOrderId={setEditOrderId} editCustomer={editCustomer} setEditCustomer={setEditCustomer} goToOrdersList={() => handleNav("ordersList")} goToCatalog={() => handleNav("catalog", { keepOrder: true })} />}
        </div>

        {/* Нижня навігація (тільки після логіну) */}
        {isLoggedIn && <BottomNav active={screen} onNav={handleNav} t={t} />}
      </div>

      {/* Floating dev tools - для тестування в браузері (у продакшн Capacitor можна сховати) */}
      <div style={{ position: "fixed", top: 10, right: 10, display: "flex", gap: 8, zIndex: 1000, background: "rgba(0,0,0,0.5)", padding: 8, borderRadius: 20 }}>
        <button onClick={() => setIsDark(!isDark)} style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={isDark ? "sun" : "moon"} size={18} color="#fff" />
        </button>
        <button onClick={() => setIsOnline(!isOnline)} style={{ height: 36, padding: "0 12px", borderRadius: 18, background: isOnline ? "rgba(0,137,123,0.5)" : "rgba(192,57,43,0.5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name={isOnline ? "wifi" : "wifiOff"} size={14} color="#fff" />
        </button>
      </div>
    </>
  );
}
