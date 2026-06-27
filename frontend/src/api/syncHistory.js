// Історія прогонів синхронізації (для панелі «Історія синхронізацій», #20).
// Кільцевий буфер у localStorage — останні MAX запусків doSync. Один запис:
// { t, sent, failed, conflict, skipped, items: [{ id, label, op, result, message }] }
// op: 'new'|'edit'|'delete'|'restore'; result: 'sent'|'failed'|'conflict'|'skipped'.
const KEY = 'vendo_sync_history';
const MAX = 50;

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };

export const getSyncHistory = () => read();

export const addSyncRun = (run) => {
    const arr = read();
    arr.push({ t: new Date().toISOString(), ...run });
    if (arr.length > MAX) arr.splice(0, arr.length - MAX);
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch { /* quota — ігноруємо */ }
};

export const clearSyncHistory = () => { try { localStorage.setItem(KEY, JSON.stringify([])); } catch { /* ignore */ } };
