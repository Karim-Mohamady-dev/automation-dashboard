export type TriggerId =
  | 'order-paid'
  | 'new-subscriber'
  | 'low-stock'
  | 'new-review'
  | 'new-order'
  | 'abandoned-cart'
  | 'support-ticket'
  | 'back-in-stock'
  | 'refund-requested'
  | 'delivery-completed'

export type ActionId =
  | 'send-invoice'
  | 'welcome-email'
  | 'notify-supplier'
  | 'thank-you-reply'
  | 'shipping-label'
  | 'discount-email'
  | 'assign-agent'
  | 'restock-alert'
  | 'refund-confirmation'
  | 'feedback-request'

export type ConditionId =
  | 'always'
  | 'order-over-50'
  | 'first-time-customer'
  | 'rating-4-plus'
  | 'stock-below-5'
  | 'vip-customer'

export interface Automation {
  id: string
  /** Locale key (names.a1 …) for built-in automations. */
  nameKey?: string
  /** Free-text name for automations the user creates. */
  name?: string
  trigger: TriggerId
  condition: ConditionId
  action: ActionId
  enabled: boolean
  runs: number
  /** Successful runs. Success rate is always computed as successes / runs. */
  successes: number
  lastRun: string | null
}

export type LogStatus = 'success' | 'failure' | 'paused' | 'resumed'

export interface LogEntry {
  id: string
  automationId: string
  kind: 'run' | 'toggle'
  status: LogStatus
  time: string
}

export const TRIGGER_IDS: TriggerId[] = [
  'order-paid',
  'new-order',
  'new-subscriber',
  'low-stock',
  'back-in-stock',
  'new-review',
  'abandoned-cart',
  'support-ticket',
  'refund-requested',
  'delivery-completed',
]

export const ACTION_IDS: ActionId[] = [
  'send-invoice',
  'shipping-label',
  'welcome-email',
  'discount-email',
  'notify-supplier',
  'restock-alert',
  'thank-you-reply',
  'feedback-request',
  'assign-agent',
  'refund-confirmation',
]

export const CONDITION_IDS: ConditionId[] = [
  'always',
  'order-over-50',
  'first-time-customer',
  'rating-4-plus',
  'stock-below-5',
  'vip-customer',
]

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString()
}

export function seedAutomations(): Automation[] {
  return [
    {
      id: 'a1',
      nameKey: 'names.a1',
      trigger: 'order-paid',
      condition: 'order-over-50',
      action: 'send-invoice',
      enabled: true,
      runs: 128,
      successes: 124,
      lastRun: minutesAgo(4),
    },
    {
      id: 'a2',
      nameKey: 'names.a2',
      trigger: 'new-subscriber',
      condition: 'always',
      action: 'welcome-email',
      enabled: true,
      runs: 342,
      successes: 338,
      lastRun: minutesAgo(11),
    },
    {
      id: 'a3',
      nameKey: 'names.a3',
      trigger: 'low-stock',
      condition: 'stock-below-5',
      action: 'notify-supplier',
      enabled: true,
      runs: 57,
      successes: 52,
      lastRun: minutesAgo(38),
    },
    {
      id: 'a4',
      nameKey: 'names.a4',
      trigger: 'new-review',
      condition: 'rating-4-plus',
      action: 'thank-you-reply',
      enabled: true,
      runs: 89,
      successes: 87,
      lastRun: minutesAgo(52),
    },
    {
      id: 'a5',
      nameKey: 'names.a5',
      trigger: 'abandoned-cart',
      condition: 'always',
      action: 'discount-email',
      enabled: true,
      runs: 210,
      successes: 196,
      lastRun: minutesAgo(95),
    },
    {
      id: 'a6',
      nameKey: 'names.a6',
      trigger: 'support-ticket',
      condition: 'vip-customer',
      action: 'assign-agent',
      enabled: false,
      runs: 64,
      successes: 61,
      lastRun: minutesAgo(60 * 26),
    },
  ]
}

export function seedLog(): LogEntry[] {
  const rows: Array<[string, LogStatus, number]> = [
    ['a1', 'success', 4],
    ['a2', 'success', 11],
    ['a3', 'success', 38],
    ['a4', 'success', 52],
    ['a5', 'failure', 71],
    ['a5', 'success', 95],
    ['a2', 'success', 130],
    ['a1', 'success', 160],
    ['a3', 'failure', 240],
    ['a6', 'paused', 60 * 26],
  ]
  return rows.map(([automationId, status, min], i) => ({
    id: `seed-${i}`,
    automationId,
    kind: status === 'paused' ? 'toggle' : 'run',
    status,
    time: minutesAgo(min),
  }))
}
