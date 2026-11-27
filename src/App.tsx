import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  Bell,
  CheckCircle,
  Clock,
  FunnelSimple,
  GearSix,
  GlobeHemisphereWest,
  Lightning,
  ListChecks,
  MagnifyingGlass,
  Pause,
  Play,
  Plus,
  Scroll,
  SquaresFour,
  Trash,
  XCircle,
} from '@phosphor-icons/react'
import { detectLang, useDict, type Lang } from './i18n'
import {
  ACTION_IDS,
  CONDITION_IDS,
  TRIGGER_IDS,
  seedAutomations,
  seedLog,
  type ActionId,
  type Automation,
  type ConditionId,
  type LogEntry,
  type TriggerId,
} from './data/automations'

const STATE_KEY = 'automation-dash-state'
const LANG_KEY = 'automation-dash-lang'

interface PersistedState {
  automations: Automation[]
  log: LogEntry[]
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (raw) {
      const parsed: unknown = JSON.parse(raw)
      if (
        parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as PersistedState).automations) &&
        Array.isArray((parsed as PersistedState).log)
      ) {
        return parsed as PersistedState
      }
    }
  } catch {
    // storage unavailable or corrupt — fall through to seed data
  }
  return { automations: seedAutomations(), log: seedLog() }
}

function saveState(state: PersistedState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // storage unavailable — state still works for this session
  }
}

/** Success rate is always computed from runs, never hard-coded. */
function successRate(a: Automation): number | null {
  if (a.runs === 0) return null
  return Math.round((a.successes / a.runs) * 100)
}

function uid(): string {
  return `u${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
}

type StatusFilter = 'all' | 'active' | 'paused'

export default function App() {
  const [lang, setLang] = useState<Lang>(() => detectLang())
  const { t } = useDict(lang)

  const [state, setState] = useState<PersistedState>(loadState)
  const { automations, log } = state

  const [selectedId, setSelectedId] = useState<string | null>('a1')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [activeNav, setActiveNav] = useState('dashboard')

  // Create-automation form
  const [formName, setFormName] = useState('')
  const [formTrigger, setFormTrigger] = useState<TriggerId>('order-paid')
  const [formAction, setFormAction] = useState<ActionId>('send-invoice')
  const [formCondition, setFormCondition] = useState<ConditionId>('always')
  const [formError, setFormError] = useState(false)
  const [createdNotice, setCreatedNotice] = useState(false)

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      // storage unavailable
    }
  }, [lang])

  useEffect(() => {
    saveState(state)
  }, [state])

  const update = (fn: (prev: PersistedState) => PersistedState) => {
    setState((prev) => fn(prev))
  }

  const displayName = (a: Automation) => (a.nameKey ? t(a.nameKey) : (a.name ?? ''))

  const toggleAutomation = (id: string) => {
    update((prev) => {
      const target = prev.automations.find((a) => a.id === id)
      if (!target) return prev
      const enabled = !target.enabled
      const entry: LogEntry = {
        id: uid(),
        automationId: id,
        kind: 'toggle',
        status: enabled ? 'resumed' : 'paused',
        time: new Date().toISOString(),
      }
      return {
        automations: prev.automations.map((a) =>
          a.id === id ? { ...a, enabled } : a,
        ),
        log: [entry, ...prev.log].slice(0, 60),
      }
    })
  }

  const runNow = (id: string) => {
    update((prev) => {
      const target = prev.automations.find((a) => a.id === id)
      if (!target || !target.enabled) return prev
      // ~85% of runs succeed; the rest fail, like a real integration would.
      const ok = Math.random() < 0.85
      const entry: LogEntry = {
        id: uid(),
        automationId: id,
        kind: 'run',
        status: ok ? 'success' : 'failure',
        time: new Date().toISOString(),
      }
      return {
        automations: prev.automations.map((a) =>
          a.id === id
            ? {
                ...a,
                runs: a.runs + 1,
                successes: a.successes + (ok ? 1 : 0),
                lastRun: entry.time,
              }
            : a,
        ),
        log: [entry, ...prev.log].slice(0, 60),
      }
    })
  }

  const createAutomation = (e: React.FormEvent) => {
    e.preventDefault()
    if (formName.trim() === '') {
      setFormError(true)
      return
    }
    const fresh: Automation = {
      id: uid(),
      name: formName.trim(),
      trigger: formTrigger,
      condition: formCondition,
      action: formAction,
      enabled: true,
      runs: 0,
      successes: 0,
      lastRun: null,
    }
    update((prev) => ({
      automations: [fresh, ...prev.automations],
      log: prev.log,
    }))
    setSelectedId(fresh.id)
    setFormName('')
    setFormError(false)
    setCreatedNotice(true)
    window.setTimeout(() => setCreatedNotice(false), 4000)
  }

  const clearLog = () => update((prev) => ({ ...prev, log: [] }))

  // Live stats — every number below is computed from the data
  const totalRuns = useMemo(
    () => automations.reduce((sum, a) => sum + a.runs, 0),
    [automations],
  )
  const totalSuccesses = useMemo(
    () => automations.reduce((sum, a) => sum + a.successes, 0),
    [automations],
  )
  const overallRate = totalRuns === 0 ? null : Math.round((totalSuccesses / totalRuns) * 100)
  const activeCount = automations.filter((a) => a.enabled).length
  const runsToday = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return log.filter((e) => e.kind === 'run' && new Date(e.time).getTime() >= cutoff).length
  }, [log])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return automations
      .filter((a) =>
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? a.enabled
            : !a.enabled,
      )
      .filter((a) => (q === '' ? true : displayName(a).toLowerCase().includes(q)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [automations, search, statusFilter, lang])

  const selected = automations.find((a) => a.id === selectedId) ?? null
  const selectedRuns = useMemo(
    () => (selected ? log.filter((e) => e.automationId === selected.id).slice(0, 5) : []),
    [log, selected],
  )

  const localeTag = lang === 'ar' ? 'ar-EG' : 'en-GB'
  const today = new Intl.DateTimeFormat(localeTag, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', {
    numeric: 'auto',
  })
  const relativeTime = (iso: string) => {
    const diffMs = new Date(iso).getTime() - Date.now()
    const diffMin = Math.round(diffMs / 60_000)
    if (Math.abs(diffMin) < 1) return rtf.format(0, 'second')
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
    const diffH = Math.round(diffMin / 60)
    if (Math.abs(diffH) < 24) return rtf.format(diffH, 'hour')
    return rtf.format(Math.round(diffH / 24), 'day')
  }
  const absoluteTime = (iso: string) =>
    new Intl.DateTimeFormat(localeTag, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))

  const scrollTo = (id: string, nav: string) => {
    setActiveNav(nav)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const navItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: SquaresFour, target: 'top' },
    { id: 'automations', label: t('nav.automations'), icon: ListChecks, target: 'automations' },
    { id: 'activity', label: t('nav.activity'), icon: Scroll, target: 'activity' },
    { id: 'new', label: t('nav.new'), icon: Plus, target: 'new-automation' },
  ]

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? 'bg-violet-400 text-zinc-950'
        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
    }`

  const inputCls =
    'w-full rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20'

  const flowSteps = selected
    ? [
        {
          kind: 'trigger' as const,
          label: t('detail.trigger'),
          value: t(`triggers.${selected.trigger}`),
          icon: Lightning,
        },
        {
          kind: 'condition' as const,
          label: t('detail.condition'),
          value: t(`conditions.${selected.condition}`),
          icon: FunnelSimple,
        },
        {
          kind: 'action' as const,
          label: t('detail.action'),
          value: t(`actions.${selected.action}`),
          icon: Play,
        },
      ]
    : []

  const logStatusLabel = (e: LogEntry) =>
    e.status === 'success'
      ? t('log.success')
      : e.status === 'failure'
        ? t('log.failed')
        : e.status === 'paused'
          ? t('log.paused')
          : t('log.resumed')

  return (
    <div id="top" className="min-h-screen bg-zinc-950 font-sans text-zinc-100">
      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-zinc-800/80 px-4 py-6 md:flex">
          <div className="flex items-center gap-2.5 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400 text-zinc-950">
              <Lightning size={20} weight="fill" />
            </span>
            <div>
              <p className="text-lg font-extrabold leading-none tracking-tight">{t('app.name')}</p>
              <p className="mt-1 text-[11px] text-zinc-500">{t('app.tagline')}</p>
            </div>
          </div>

          <nav className="mt-8 space-y-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = activeNav === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.target, item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-zinc-800 text-zinc-50'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }`}
                >
                  <Icon size={19} weight={active ? 'fill' : 'regular'} />
                  {item.label}
                  {active && <span className="ms-auto h-2 w-2 rounded-full bg-violet-400" />}
                </button>
              )
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <GearSix size={13} />
              {t('stats.successRate')}
            </p>
            <p className="mt-2 text-3xl font-extrabold leading-none text-zinc-50">
              {overallRate === null ? '—' : `${overallRate}%`}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {totalSuccesses} / {totalRuns} {t('automation.runs')}
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-50 sm:text-3xl">
                {t('header.title')}
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                {today} · {t('header.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-zinc-300 transition hover:text-zinc-100"
                aria-label="Notifications"
              >
                <Bell size={19} />
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-violet-400" />
              </button>
              <button
                type="button"
                onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                className="flex h-10 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600"
              >
                <GlobeHemisphereWest size={17} />
                {lang === 'en' ? 'عربي' : 'English'}
              </button>
            </div>
          </header>

          {/* Stats row — all values computed live from the automations + log */}
          <section
            className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"
            aria-label="Automation statistics"
          >
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Lightning size={14} className="text-violet-400" />
                {t('stats.active')}
              </p>
              <p className="mt-3 text-3xl font-extrabold leading-none text-zinc-50">
                {activeCount}
                <span className="text-lg text-zinc-500"> / {automations.length}</span>
              </p>
              <p className="mt-2.5 text-xs text-zinc-500">{t('stats.activeSub')}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Play size={14} className="text-emerald-400" />
                {t('stats.runs')}
              </p>
              <p className="mt-3 text-3xl font-extrabold leading-none text-zinc-50">
                {totalRuns.toLocaleString(localeTag)}
              </p>
              <p className="mt-2.5 text-xs text-zinc-500">{t('stats.runsSub')}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <CheckCircle size={14} className="text-emerald-400" />
                {t('stats.successRate')}
              </p>
              <p className="mt-3 text-3xl font-extrabold leading-none text-zinc-50">
                {overallRate === null ? '—' : `${overallRate}%`}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${overallRate ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">{t('stats.successRateSub')}</p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Clock size={14} className="text-violet-400" />
                {t('stats.today')}
              </p>
              <p className="mt-3 text-3xl font-extrabold leading-none text-zinc-50">
                {runsToday}
              </p>
              <p className="mt-2.5 text-xs text-zinc-500">{t('stats.todaySub')}</p>
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Left column: automation list + create form + activity log */}
            <div className="space-y-6 lg:col-span-2">
              {/* Automation list */}
              <section
                id="automations"
                className="scroll-mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-zinc-50">{t('list.title')}</h2>
                  <p className="text-xs text-zinc-400">
                    {t('list.showing')} {filtered.length} {t('list.of')} {automations.length}
                  </p>
                </div>

                <div className="relative mt-4">
                  <MagnifyingGlass
                    size={17}
                    className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <label htmlFor="automation-search" className="sr-only">
                    {t('list.searchPlaceholder')}
                  </label>
                  <input
                    id="automation-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('list.searchPlaceholder')}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950/70 py-2.5 pe-4 ps-10 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-400/20"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setStatusFilter('all')} className={chip(statusFilter === 'all')}>
                    {t('list.all')}
                  </button>
                  <button type="button" onClick={() => setStatusFilter('active')} className={chip(statusFilter === 'active')}>
                    {t('list.active')}
                  </button>
                  <button type="button" onClick={() => setStatusFilter('paused')} className={chip(statusFilter === 'paused')}>
                    {t('list.paused')}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
                      <p className="text-base font-semibold text-zinc-100">{t('list.emptyTitle')}</p>
                      <p className="mt-1 text-sm text-zinc-400">{t('list.emptyBody')}</p>
                    </div>
                  ) : (
                    filtered.map((a) => {
                      const rate = successRate(a)
                      const active = selectedId === a.id
                      return (
                        <article
                          key={a.id}
                          className={`rounded-2xl border p-4 transition ${
                            active
                              ? 'border-violet-400/50 bg-violet-400/5'
                              : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => setSelectedId(a.id)}
                              className="min-w-0 flex-1 text-start"
                            >
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-bold text-zinc-50">
                                  {displayName(a)}
                                </span>
                                <span
                                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    a.enabled
                                      ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30'
                                      : 'bg-zinc-700/40 text-zinc-400 ring-1 ring-inset ring-zinc-600/40'
                                  }`}
                                >
                                  {a.enabled ? t('automation.enabled') : t('automation.paused')}
                                </span>
                              </span>
                              <span className="mt-1 block text-xs text-zinc-500">
                                {t(`triggers.${a.trigger}`)} → {t(`actions.${a.action}`)}
                              </span>
                            </button>

                            {/* Working on/off toggle */}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={a.enabled}
                              aria-label={displayName(a)}
                              onClick={() => toggleAutomation(a.id)}
                              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                                a.enabled ? 'bg-violet-400' : 'bg-zinc-700'
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                                  a.enabled ? 'start-5' : 'start-0.5'
                                }`}
                              />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-400">
                            <span>
                              <span className="font-bold text-zinc-100">{a.runs}</span>{' '}
                              {t('automation.runs')}
                            </span>
                            <span>
                              <span className="font-bold text-emerald-300">
                                {rate === null ? '—' : `${rate}%`}
                              </span>{' '}
                              {t('automation.successRate')}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={13} />
                              {t('automation.lastRun')}:{' '}
                              {a.lastRun ? relativeTime(a.lastRun) : t('automation.never')}
                            </span>
                            <span className="ms-auto flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedId(a.id)}
                                className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-violet-400/60 hover:text-violet-300"
                              >
                                {t('automation.viewFlow')}
                              </button>
                              <button
                                type="button"
                                onClick={() => runNow(a.id)}
                                disabled={!a.enabled}
                                className="inline-flex items-center gap-1.5 rounded-full bg-violet-400 px-3 py-1.5 text-xs font-bold text-zinc-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                              >
                                <Play size={13} weight="fill" />
                                {t('automation.runNow')}
                              </button>
                            </span>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </section>

              {/* Create automation */}
              <section
                id="new-automation"
                className="scroll-mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
              >
                <h2 className="flex items-center gap-2 text-base font-bold text-zinc-50">
                  <Plus size={18} className="text-violet-400" />
                  {t('create.title')}
                </h2>
                <form onSubmit={createAutomation} className="mt-4 space-y-3" noValidate>
                  <div>
                    <label htmlFor="new-name" className="mb-1.5 block text-xs font-semibold text-zinc-400">
                      {t('create.nameLabel')}
                    </label>
                    <input
                      id="new-name"
                      type="text"
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value)
                        setFormError(false)
                      }}
                      placeholder={t('create.namePlaceholder')}
                      aria-invalid={formError}
                      className={`${inputCls} ${formError ? 'border-rose-500/70' : ''}`}
                    />
                    {formError && (
                      <p className="mt-1.5 text-xs font-semibold text-rose-300">
                        {t('create.nameLabel')}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="new-trigger" className="mb-1.5 block text-xs font-semibold text-zinc-400">
                        {t('create.triggerLabel')}
                      </label>
                      <select
                        id="new-trigger"
                        value={formTrigger}
                        onChange={(e) => setFormTrigger(e.target.value as TriggerId)}
                        className={inputCls}
                      >
                        {TRIGGER_IDS.map((id) => (
                          <option key={id} value={id}>
                            {t(`triggers.${id}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="new-condition" className="mb-1.5 block text-xs font-semibold text-zinc-400">
                        {t('create.conditionLabel')}
                      </label>
                      <select
                        id="new-condition"
                        value={formCondition}
                        onChange={(e) => setFormCondition(e.target.value as ConditionId)}
                        className={inputCls}
                      >
                        {CONDITION_IDS.map((id) => (
                          <option key={id} value={id}>
                            {t(`conditions.${id}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="new-action" className="mb-1.5 block text-xs font-semibold text-zinc-400">
                        {t('create.actionLabel')}
                      </label>
                      <select
                        id="new-action"
                        value={formAction}
                        onChange={(e) => setFormAction(e.target.value as ActionId)}
                        className={inputCls}
                      >
                        {ACTION_IDS.map((id) => (
                          <option key={id} value={id}>
                            {t(`actions.${id}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-full bg-violet-400 px-5 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300"
                    >
                      {t('create.submit')}
                    </button>
                    {createdNotice && (
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                        <CheckCircle size={16} weight="fill" />
                        {t('create.created')}
                      </p>
                    )}
                  </div>
                </form>
              </section>

              {/* Activity log */}
              <section
                id="activity"
                className="scroll-mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-base font-bold text-zinc-50">
                    <Scroll size={18} className="text-violet-400" />
                    {t('log.title')}
                  </h2>
                  <button
                    type="button"
                    onClick={clearLog}
                    disabled={log.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-rose-400/60 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash size={14} />
                    {t('log.clear')}
                  </button>
                </div>
                <ul className="mt-4 space-y-2">
                  {log.length === 0 ? (
                    <li className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-6 text-center text-sm text-zinc-400">
                      {t('log.empty')}
                    </li>
                  ) : (
                    log.slice(0, 20).map((e) => {
                      const auto = automations.find((a) => a.id === e.automationId)
                      const isRun = e.kind === 'run'
                      const ok = e.status === 'success' || e.status === 'resumed'
                      return (
                        <li
                          key={e.id}
                          className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3.5 py-2.5"
                        >
                          {isRun ? (
                            ok ? (
                              <CheckCircle size={18} weight="fill" className="shrink-0 text-emerald-400" />
                            ) : (
                              <XCircle size={18} weight="fill" className="shrink-0 text-rose-400" />
                            )
                          ) : (
                            <Pause size={18} weight="fill" className="shrink-0 text-amber-400" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                            <span className="font-semibold text-zinc-50">
                              {auto ? displayName(auto) : ''}
                            </span>{' '}
                            <span className="text-zinc-500">· {logStatusLabel(e)}</span>
                          </span>
                          <span
                            className="shrink-0 text-xs text-zinc-500"
                            title={absoluteTime(e.time)}
                          >
                            {relativeTime(e.time)}
                          </span>
                        </li>
                      )
                    })
                  )}
                </ul>
              </section>
            </div>

            {/* Right column: flow detail */}
            <div className="lg:col-span-1">
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 lg:sticky lg:top-6">
                <h2 className="text-base font-bold text-zinc-50">{t('detail.flow')}</h2>
                {selected === null ? (
                  <p className="mt-3 text-sm text-zinc-400">{t('detail.selectPrompt')}</p>
                ) : (
                  <>
                    <p className="mt-1 text-sm font-semibold text-violet-300">
                      {displayName(selected)}
                    </p>

                    <ol className="mt-5 space-y-0">
                      {flowSteps.map((step, i) => {
                        const Icon = step.icon
                        const last = i === flowSteps.length - 1
                        return (
                          <li key={step.kind} className="relative">
                            <div className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <span
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                    step.kind === 'trigger'
                                      ? 'bg-violet-400/15 text-violet-300 ring-1 ring-inset ring-violet-400/30'
                                      : step.kind === 'condition'
                                        ? 'bg-amber-400/15 text-amber-300 ring-1 ring-inset ring-amber-400/30'
                                        : 'bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30'
                                  }`}
                                >
                                  <Icon size={19} weight="fill" />
                                </span>
                                {!last && (
                                  <span className="my-1 flex flex-1 items-center justify-center">
                                    <ArrowDown size={14} className="text-zinc-600" />
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 pb-5 pt-1">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                                  {step.label}
                                </p>
                                <p className="mt-0.5 text-sm font-bold text-zinc-50">{step.value}</p>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ol>

                    <div className="mt-1 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-4 text-center">
                      <div>
                        <p className="text-lg font-extrabold text-zinc-50">{selected.runs}</p>
                        <p className="text-[11px] text-zinc-500">{t('automation.runs')}</p>
                      </div>
                      <div>
                        <p className="text-lg font-extrabold text-emerald-300">
                          {successRate(selected) === null ? '—' : `${successRate(selected)}%`}
                        </p>
                        <p className="text-[11px] text-zinc-500">{t('automation.successRate')}</p>
                      </div>
                      <div>
                        <p className="text-lg font-extrabold text-zinc-50">
                          {selected.enabled ? t('automation.enabled') : t('automation.paused')}
                        </p>
                        <p className="text-[11px] text-zinc-500">{t('list.active')}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => runNow(selected.id)}
                        disabled={!selected.enabled}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-violet-400 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
                      >
                        <Play size={15} weight="fill" />
                        {t('automation.runNow')}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAutomation(selected.id)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500"
                      >
                        {selected.enabled ? <Pause size={15} /> : <Play size={15} />}
                        {selected.enabled ? t('automation.paused') : t('automation.enabled')}
                      </button>
                    </div>

                    <h3 className="mt-6 text-sm font-bold text-zinc-50">{t('detail.recentRuns')}</h3>
                    {selectedRuns.length === 0 ? (
                      <p className="mt-2 text-sm text-zinc-400">{t('detail.noRuns')}</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {selectedRuns.map((e) => (
                          <li
                            key={e.id}
                            className="flex items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm"
                          >
                            {e.status === 'success' || e.status === 'resumed' ? (
                              <CheckCircle size={16} weight="fill" className="shrink-0 text-emerald-400" />
                            ) : e.status === 'failure' ? (
                              <XCircle size={16} weight="fill" className="shrink-0 text-rose-400" />
                            ) : (
                              <Pause size={16} weight="fill" className="shrink-0 text-amber-400" />
                            )}
                            <span className="text-zinc-300">{logStatusLabel(e)}</span>
                            <span className="ms-auto shrink-0 text-xs text-zinc-500">
                              {relativeTime(e.time)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
            </div>
          </div>

          <footer className="mt-10 border-t border-zinc-800/80 pt-5 pb-2 text-center">
            <p className="text-xs text-zinc-500">{t('footer.demo')}</p>
            <p className="mt-1 text-xs text-zinc-600">{t('footer.madeWith')}</p>
          </footer>
        </main>
      </div>
    </div>
  )
}
