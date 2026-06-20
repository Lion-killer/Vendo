// Дизайн-система Vendo (редизайн).
// Нова мова: нейтральне полотно, один акцент (індиго), семантичні статуси,
// крупніша типографіка, мінімум градієнтів. Inter (UI) + IBM Plex Mono (числа).
//
// Кожен об'єкт містить НОВІ токени редизайну + АЛІАСИ під старі імена
// (text/primary/border…), щоб екрани, які ще не переписані, рендерились коректно.

const lightCore = {
    bg: "#F7F7F5",
    surface: "#FFFFFF",
    surfaceMuted: "#EFEEE9",
    ink: "#15161B",
    inkSoft: "#5A5C66",
    inkMuted: "#9A9CA6",
    line: "#E5E4DE",
    lineSoft: "#EFEEE9",
    accent: "#3A4FE0",
    accentSoft: "#EAEDFC",
    accentInk: "#1F2BA3",
    ok: "#1F8F58",
    okSoft: "#E2F1E8",
    warn: "#B5610A",
    warnSoft: "#FBEED8",
    err: "#C0392B",
    errSoft: "#FBE5E0",
    vip: "#8B5A00",
    vipSoft: "#F6E9D3",
    invBg: "#15161B",   // інверсний контейнер (hero / плаваючі смуги)
    btnBg: "#15161B",   // основні залиті кнопки
    statusInk: "#000000",
};

const darkCore = {
    bg: "#121317",
    surface: "#1C1D24",
    surfaceMuted: "#262732",
    ink: "#F3F3F1",
    inkSoft: "#A6A8B2",
    inkMuted: "#73757F",
    line: "#2D2E38",
    lineSoft: "#24252D",
    accent: "#7B88FF",
    accentSoft: "#23264A",
    accentInk: "#AEB6FF",
    ok: "#3DC982",
    okSoft: "#16301F",
    warn: "#E59A38",
    warnSoft: "#33270F",
    err: "#EE6B57",
    errSoft: "#341A16",
    vip: "#E0AC4A",
    vipSoft: "#322811",
    invBg: "#262834",
    btnBg: "#7B88FF",
    statusInk: "#F3F3F1",
};

// Аліаси під старі імена токенів (для ще не переписаних екранів).
const aliases = (c) => ({
    surfaceVariant: c.surfaceMuted,
    primary: c.accent,
    primaryDark: c.accentInk,
    primaryLight: c.accent,
    onPrimary: "#FFFFFF",
    secondary: c.accent,
    onSecondary: "#FFFFFF",
    tertiary: c.warn,
    text: c.ink,
    textSecondary: c.inkSoft,
    textMuted: c.inkMuted,
    border: c.line,
    error: c.err,
    success: c.ok,
    warning: c.warn,
    cardShadow: "none",
    navBg: c.surface,
    navBorder: c.line,
    statusBar: c.invBg,
    chip: c.accentSoft,
    chipText: c.accentInk,
    overlay: "rgba(0,0,0,0.45)",
});

export const LIGHT = { ...lightCore, ...aliases(lightCore) };
export const DARK = { ...darkCore, ...aliases(darkCore) };

// Шрифти
export const F_UI = `'Inter', -apple-system, system-ui, sans-serif`;
export const F_NUM = `'IBM Plex Mono', ui-monospace, monospace`;
