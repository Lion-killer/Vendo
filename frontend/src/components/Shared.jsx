import React from 'react';
import { Icon } from './Icon';

// Інверсний контейнер (t.invBg темний в обох темах) + явний світлий текст — щоб
// повідомлення завжди читалось. Текст у власному flex-елементі (span flex:1), інакше
// поряд з іконкою текстовий вузол міг схлопнутись і лишалась «тільки крапка».
export const Snackbar = ({ msg, t }) => msg ? (
    <div style={{ position: "absolute", bottom: 100, left: 16, right: 16, background: t.invBg, color: "#FFFFFF", borderRadius: 12, padding: "13px 16px", fontSize: 14, fontWeight: 600, lineHeight: 1.35, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 100, animation: "slideUp .3s ease" }}>
        <Icon name="check" size={16} color="#FFFFFF" />
        {/* pre-line: багаторядкові повідомлення (перелік товарів, #55); однорядкові без змін */}
        <span style={{ flex: 1, minWidth: 0, whiteSpace: "pre-line" }}>{msg}</span>
    </div>
) : null;
