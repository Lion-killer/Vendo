import React from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { MIcon, F_NUM } from './ui';
import { Z } from '../theme';

// Повноекранний промпт оновлення (#37): версія + чейнджлог + фази встановлення. Живе на рівні
// App (глобальний оверлей), тому з'являється НЕЗАЛЕЖНО від входу — зокрема на екрані логіну,
// бо нова версія може виправляти саму авторизацію. checkForUpdate анонімний (токен не потрібен).
// phase: null (пропозиція) → downloading → installing / permission / error.
export const UpdatePrompt = ({ t, appVersion, update, needsBackend, phase, progress, onStart, onLater, onOpenSettings }) => {
  const { t: tr } = useTranslation();
  if (!update) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: t.bg, zIndex: Z.update, display: "flex", flexDirection: "column", padding: "max(24px, env(safe-area-inset-top)) 20px max(20px, env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 28 }}>
        <div style={{ width: 72, height: 72, borderRadius: 22, background: t.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MIcon name="download" size={34} color={t.accent} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 16, color: t.ink }}>{tr("profile.updateTitle")}</div>
        <div style={{ fontFamily: F_NUM, fontSize: 14, color: t.inkMuted, marginTop: 4 }}>Vendo v{appVersion} → v{update.version}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", margin: "18px 0", padding: "0 6px", fontSize: 14, lineHeight: 1.55, color: t.ink }}>
        <ReactMarkdown components={{
          h2: ({ children }) => <div style={{ fontFamily: F_NUM, fontSize: 14, fontWeight: 800, color: t.accent, margin: "18px 0 2px" }}>{children}</div>,
          h3: ({ children }) => <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6, color: t.inkMuted, margin: "14px 0 6px" }}>{children}</div>,
          ul: ({ children }) => <ul style={{ margin: 0, paddingLeft: 20 }}>{children}</ul>,
          li: ({ children }) => <li style={{ margin: "4px 0" }}>{children}</li>,
          p: ({ children }) => <p style={{ margin: "6px 0" }}>{children}</p>,
        }}>{update.notes}</ReactMarkdown>
      </div>
      {phase === 'downloading' && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 8, borderRadius: 4, background: t.surfaceMuted, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, background: t.accent, borderRadius: 4, transition: "width .3s" }} />
          </div>
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 13.5, fontWeight: 600, color: t.inkMuted, fontFamily: F_NUM }}>
            {tr("profile.updDownloading", { percent: progress })}
          </div>
        </div>
      )}
      {phase === 'installing' && (
        <div style={{ flexShrink: 0, textAlign: "center", fontSize: 14, color: t.inkMuted, padding: "0 8px" }}>
          {tr("profile.updInstalling")}
          <button onClick={onLater} style={{ width: "100%", height: 48, borderRadius: 14, background: "none", border: "none", color: t.inkMuted, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>
            {tr("profile.updateLater")}
          </button>
        </div>
      )}
      {phase === 'permission' && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: t.warn, background: t.warn + "18", border: `1px solid ${t.warn}44`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
            {tr("profile.updNoPermission")}
          </div>
          <button onClick={onOpenSettings} style={{ width: "100%", height: 52, borderRadius: 14, background: t.accent, border: "none", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {tr("profile.updOpenSettings")}
          </button>
          <button onClick={onStart} style={{ width: "100%", height: 48, borderRadius: 14, background: "none", border: "none", color: t.accent, fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>
            {tr("profile.updRetry")}
          </button>
        </div>
      )}
      {phase === 'error' && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: t.err, background: t.err + "18", border: `1px solid ${t.err}44`, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
            {tr("profile.updError")}
          </div>
          <button onClick={onStart} style={{ width: "100%", height: 52, borderRadius: 14, background: t.accent, border: "none", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {tr("profile.updRetry")}
          </button>
          <button onClick={onLater} style={{ width: "100%", height: 48, borderRadius: 14, background: "none", border: "none", color: t.inkMuted, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 6 }}>
            {tr("profile.updateLater")}
          </button>
        </div>
      )}
      {!phase && (
        <>
          {/* Гейт сумісності (#66): реліз потребує новішого бекенду, ніж розгорнутий — оновитись
              дозволяємо (за рішенням), але із застереженням. */}
          {needsBackend && (
            <div style={{ fontSize: 13, lineHeight: 1.5, color: t.warn, background: t.warn + "18", border: `1px solid ${t.warn}44`, borderRadius: 12, padding: "10px 12px", marginBottom: 10, flexShrink: 0 }}>
              {tr("compat.updateWarn")}
            </div>
          )}
          <button onClick={onStart} style={{ width: "100%", height: 52, borderRadius: 14, background: t.accent, border: "none", color: "#fff", fontSize: 15.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            {tr("profile.update", { version: update.version })}
          </button>
          <button onClick={onLater} style={{ width: "100%", height: 48, borderRadius: 14, background: "none", border: "none", color: t.inkMuted, fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 6, flexShrink: 0 }}>
            {tr("profile.updateLater")}
          </button>
        </>
      )}
    </div>
  );
};
