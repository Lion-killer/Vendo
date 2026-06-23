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

// Перевірка посилань замовлення проти наявних товарів/клієнтів.
// Повертає { missingProducts: [назви], customerMissing: bool, ok: bool }.
export const checkOrderRefs = (order, productIds, customerIds) => {
    const missingProducts = (order.items || [])
        .filter(it => it.product?.id != null && !productIds.has(it.product.id))
        .map(it => it.product?.name || it.product?.id);
    const customerMissing = !!(order.customerId && !customerIds.has(order.customerId));
    return { missingProducts, customerMissing, ok: missingProducts.length === 0 && !customerMissing };
};
