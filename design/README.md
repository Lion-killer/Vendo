# design/ — макети редизайну (Claude Design)

Архівний **handoff-бандл із Claude Design** (claude.ai/design): користувацький редизайн
інтерфейсу Vendo у вигляді HTML/CSS/JS-прототипів. **Ще не впроваджено** — поточні екрани
`frontend/src` з ним не пов'язані.

- `project/redesign.jsx` — основне джерело макета;
- `project/TradeRep Redesign.html` — експортований прототип (**TradeRep** — стара назва
  Vendo до перейменування, див. коміт `0872960`);
- `project/design-canvas.jsx`, `ios-frame.jsx`, `tweaks-panel.jsx` — службові файли канви.

Шляхи `traderep/…` в оригінальному тексті бандла відповідають цьому каталогу `design/`.
Оригінальний single-file мокап (`vendo-app.jsx`), з якого колись розрізали `frontend/src`,
видалено — його роль виконує сам код застосунку.

<details>
<summary>Оригінальні інструкції handoff-бандла (для агента, що впроваджуватиме редизайн)</summary>

**Read `project/TradeRep Redesign.html` in full.** The user had this file open when they
triggered the handoff, so it's almost certainly the primary design they want built. Read it
top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared
components, CSS, scripts) so you understand how the pieces fit together before you start
implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.**

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is
to **recreate them pixel-perfectly** in whatever technology makes sense for the target
codebase. Match the visual output; don't copy the prototype's internal structure unless it
happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.**
Everything you need — dimensions, colors, layout rules — is spelled out in the source.

</details>
