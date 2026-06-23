// Виявлення «зниклих» посилань: товар/клієнт, чий GUID відсутній серед щойно
// завантажених даних, вважається недоступним (видаленим на бекенді). Завдяки
// GUID-ідентичності зіставлення надійне — «точно знаємо, що є і чого немає».

// Set GUID-ів із колекції (товари/клієнти).
export const idSet = (items) => new Set((items || []).map(x => x.id));

// Перевірка посилань замовлення проти наявних товарів/клієнтів.
// Повертає { missingProducts: [назви], customerMissing: bool, ok: bool }.
export const checkOrderRefs = (order, productIds, customerIds) => {
    const missingProducts = (order.items || [])
        .filter(it => it.product?.id != null && !productIds.has(it.product.id))
        .map(it => it.product?.name || it.product?.id);
    const customerMissing = !!(order.customerId && !customerIds.has(order.customerId));
    return { missingProducts, customerMissing, ok: missingProducts.length === 0 && !customerMissing };
};
