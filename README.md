# FlowDesk — Automation Dashboard

An original automation/workflows dashboard, written from scratch in
React 19 + TypeScript + Vite + Tailwind CSS v4. All code, copy, and demo
content in this project is original.

## Honest note about the inspiration

This project was inspired by a Code & Chill Facebook reel titled
"Automation App Dashboard" (99k views). Only the title was visible —
Facebook's login wall blocked watching the video itself — so this is a
faithful interpretation of the *dashboard type* (a list of automations,
their trigger → condition → action flows, run stats, and an activity
log) in a clean modern house style. It is **not** a frame-by-frame copy
of the video's app, and no paid source code was used.

## What it does

- **Header** — today's date and an EN / عربي language toggle (saved in
  `localStorage` under `automation-dash-lang`; switches the whole UI to
  Arabic with RTL layout).
- **Live stats row** — every number is computed from the data, not
  hard-coded:
  - Active automations (e.g. 5 / 6)
  - Total runs across all automations
  - Overall success rate, computed as total successes ÷ total runs
  - Runs in the last 24h, counted from the activity log
- **Automation list** — six demo automations ("Order paid → send
  invoice", "New subscriber → welcome email", "Low stock → notify
  supplier", "New review → thank-you reply", "Abandoned cart →
  discount email", "VIP ticket → assign agent"), each with:
  - A working on/off toggle (pausing disables its "Run now" button
    and writes a paused/resumed entry to the log)
  - Runs count and success rate (computed as successes ÷ runs)
  - Last run time, shown as a relative time
  - A **Run now** button that appends a new log entry (usually a
    success, occasionally a failure, ~85/15), increments the runs
    count, and updates the success rate live
  - Search box and All / Active / Paused filters
- **Flow detail** — clicking an automation shows its visual flow in the
  side panel: Trigger → Condition → Action, plus its own stats and its
  five most recent runs.
- **Create automation** — a form (name + trigger + condition + action)
  that adds a real working entry to the top of the list: it can be
  toggled, run on demand, selected to view its flow, and it appears in
  the activity log when run.
- **Activity log** — every run and every pause/resume, with
  success/failure status and relative time. Clearable with one button.
- **Persistence** — automations, toggles, runs, and the log are stored
  in `localStorage` under `automation-dash-state`, so everything
  survives a reload. New runs keep accumulating on the seed data.

## Demo data

All automations, run counts, and log entries are **sample/demo content**
for a fictional store ("FlowDesk"). The footer labels the page as demo
data, and everything is stored only in the visitor's own browser —
nothing is sent anywhere.

## Run it

```bash
npm run build   # tsc + vite build -> dist/
npm run dev     # local dev server
npm run preview # serve the production build
```

## Tech

- React 19, TypeScript (strict), Vite 8
- Tailwind CSS v4 (`@tailwindcss/vite`)
- Phosphor icons (`@phosphor-icons/react`)
- Hand-rolled JSON i18n (`src/i18n.ts`, `locales/en/common.json`,
  `locales/ar/common.json`) — no i18n library
