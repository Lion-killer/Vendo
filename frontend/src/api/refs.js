// Виявлення «зниклих» посилань: товар/клієнт, чий GUID відсутній серед щойно
// завантажених даних, вважається недоступним (видаленим на бекенді). Завдяки
// GUID-ідентичності зіставлення надійне — «точно знаємо, що є і чого немає».

// Set GUID-ів із колекції (товари/клієнти).
export const idSet = (items) => new Set((items || []).map(x => x.id));

// Злиття серверних і локальних замовлень: локальна черга ВИГРАЄ за id (її незбережені
// зміни/видалення перекривають серверну версію до синхронізації — pull не затирає).
// Локальні позначаються _pending. Сортування — за датою, новіші згори.
export const mergeOrders = (serverOrders = [], localOrders = []) => {
    const merged = localOrders.map(o => ({ ...o, _pending: true }));
    const seen = new Set(merged.map(o => o.id));
    for (const r of serverOrders) if (!seen.has(r.id)) merged.push(r);
    return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
};

// Останні кількості товарів для контрагента (#63): для кожного productId — до `limit`
// найновіших замовлень цього контрагента, що містять товар, як { qty, date } (найновіші
// перші). Джерело — вікно кешованих замовлень (тому лише недавні); видалені (deletionMark)
// пропускаємо. Кілька рядків одного товару в межах одного замовлення сумуємо (один запис
// на замовлення — «скільки взяли того разу»).
export const recentQtysForCustomer = (orders = [], customerId, limit = 3) => {
    const map = new Map();
    if (!customerId) return map;
    const mine = orders
        .filter(o => !o.deletionMark && (o.customerId || o.customer?.id) === customerId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    for (const o of mine) {
        const perOrder = new Map(); // productId -> сума кількостей у цьому замовленні
        for (const it of (o.items || [])) {
            const pid = it.productId ?? it.product?.id;
            if (pid == null) continue;
            perOrder.set(pid, (perOrder.get(pid) || 0) + (Number(it.qty) || 0));
        }
        for (const [pid, qty] of perOrder) {
            const arr = map.get(pid) || [];
            if (arr.length < limit) { arr.push({ qty, date: o.date }); map.set(pid, arr); }
        }
    }
    return map;
};

// Множина GUID товарів, які контрагент замовляв (недовидалені замовлення) — для підсвітки
// «замовляв раніше» в каталозі (#62). Ключі recentQtysForCustomer — саме цей набір pid
// (limit впливає на кількість записів у значенні, не на набір ключів), тож не дублюємо предикат.
export const orderedIdsFromOrders = (orders, customerId) =>
    new Set(recentQtysForCustomer(orders, customerId, 1).keys());

// Перевірка посилань замовлення проти наявних товарів/клієнтів.
// Повертає { missingProducts: [назви], customerMissing: bool, ok: bool }.
export const checkOrderRefs = (order, productIds, customerIds) => {
    const missingProducts = (order.items || [])
        .filter(it => it.product?.id != null && !productIds.has(it.product.id))
        .map(it => it.product?.name || it.product?.id);
    const customerMissing = !!(order.customerId && !customerIds.has(order.customerId));
    return { missingProducts, customerMissing, ok: missingProducts.length === 0 && !customerMissing };
};
