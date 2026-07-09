// Дерево контрагентів (#64): плоскі папки (customer-groups із parentId) + контрагенти
// (customer.groupId) → вкладені вузли. Дзеркалить buildTree каталогу, але для клієнтів.
// Контрагент без groupId (або з невідомою групою) — у корені (orphan), як товар без категорії.
export function buildCustomerTree(groups, customers) {
    const byId = new Map();
    (groups || []).forEach(g => byId.set(g.id, { id: g.id, name: g.name, parentId: g.parentId || "", children: [], customers: [] }));
    const roots = [];
    byId.forEach(node => {
        if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId).children.push(node);
        else roots.push(node);
    });
    const orphans = [];
    (customers || []).forEach(c => {
        const node = c.groupId && byId.has(c.groupId) ? byId.get(c.groupId) : null;
        if (node) node.customers.push(c); else orphans.push(c);
    });
    return { id: "", name: "", children: roots, customers: orphans };
}

// Вузол за шляхом (масив id груп). Обриваємось на першому невідомому id.
export const getCustomerNode = (root, path) => {
    let node = root;
    for (const id of path) {
        const next = (node.children || []).find(c => c.id === id);
        if (!next) break; node = next;
    }
    return node;
};

// Усі листові контрагенти під вузлом (рекурсивно) — для лічильника й сумарного боргу групи.
export const leavesUnder = (node) => {
    let out = node.customers ? [...node.customers] : [];
    (node.children || []).forEach(c => { out = out.concat(leavesUnder(c)); });
    return out;
};

// Сумарний борг: >0 борг, <0 переплата (в управлінській валюті, одна на відповідь).
export const sumDebt = (customers) => (customers || []).reduce((s, c) => s + (Number(c.debt) || 0), 0);
