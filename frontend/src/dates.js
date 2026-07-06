// Чисті дата-хелпери без залежностей (#50): єдине джерело для YYYY-MM-DD у ЛОКАЛЬНОМУ
// часі. Окремо від i18n.js, щоб модулі, які тестуються в node --test (localOrders),
// не тягнули i18next/JSON-локалі. i18n.js ре-експортує для зручності екранів.
export const dateISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// НЕ toISOString(): та дає UTC і вночі (до ~02:00 за Києвом) зсуває дату на вчора.
export const todayISO = () => dateISO(new Date());
