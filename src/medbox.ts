export const DEFAULT_TIMES = ['08:00', '12:00', '18:00', '22:00']
export const STORAGE_KEY = 'medbox.v1.times'
export const MINUTE = 60_000

export function parseTimes(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (Array.isArray(value) && value.length === 4 &&
      value.every((time) => typeof time === 'string' && /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(time))) {
      return value
    }
  } catch {
    // A stale or malformed entry can be replaced by the defaults.
  }
  return [...DEFAULT_TIMES]
}

export function changeDigit(time: string, digit: number, step: 1 | -1): string {
  const positions = [0, 1, 3, 4]
  const position = positions[digit]
  const max = [2, time[0] === '2' ? 3 : 9, 5, 9][digit]
  const chars = time.split('')
  chars[position] = String((Number(chars[position]) + step + max + 1) % (max + 1))
  if (chars[0] === '2' && Number(chars[1]) > 3) chars[1] = '3'
  return chars.join('')
}

export function formatClock(timestamp: number) {
  const date = new Date(timestamp)
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0')).join(':')
}

export const CONFIRMATIONS_KEY = 'medbox.v1.confirmations'
export const CONFIRMATION_MS = 2000

// Each date stores a four-bit mask, one bit per compartment.
export type Confirmations = Record<string, number>

export function parseConfirmations(raw: string | null): Confirmations {
  try {
    const value: unknown = JSON.parse(raw ?? 'null')
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).filter(([day, mask]) =>
        /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isInteger(mask) && mask > 0 && mask <= 15))
    }
  } catch {
    // Ignore corrupt storage.
  }
  return {}
}

function dayKey(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0')).join('-')
}

function atDoseTime(timestamp: number, time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date(timestamp)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function dueDays(from: number, to: number, times: string[], confirmed: Confirmations) {
  return times.map((time, index) => {
    if (to <= from) return null
    const latest = atDoseTime(to, time)
    if (latest.getTime() > to) {
      latest.setDate(latest.getDate() - 1)
      const [hours, minutes] = time.split(':').map(Number)
      latest.setHours(hours, minutes, 0, 0)
    }
    const day = dayKey(latest)
    return latest.getTime() > from && !(confirmed[day] & (1 << index)) ? day : null
  })
}

export function dueCompartments(from: number, to: number, times: string[]): number[] {
  return dueDays(from, to, times, {}).flatMap((day, index) => day ? [index] : [])
}

export function nextDoseTime(now: number, times: string[], confirmed: Confirmations) {
  return Math.min(...times.map((time, index) => {
    let candidate = atDoseTime(now, time)
    while (candidate.getTime() <= now || (confirmed[dayKey(candidate)] & (1 << index))) {
      candidate.setDate(candidate.getDate() + 1)
      candidate = atDoseTime(candidate.getTime(), time)
    }
    return candidate.getTime()
  }))
}

export type ClockState = {
  now: number
  pending: (string | null)[]
  confirmed: Confirmations
  lastConfirmation: { index: number } | null
  test: boolean
}
type ClockAction =
  | { type: 'tick' | 'advance'; value: number; times: string[] }
  | { type: 'toggle'; now: number }
  | { type: 'confirm'; index: number; fallback?: boolean }

export function initialClock(now: number, times: string[], confirmed: Confirmations = {}): ClockState {
  const pending = dueDays(Math.floor(now / MINUTE) * MINUTE - 1, now, times, confirmed)
  return { now, pending, confirmed, lastConfirmation: null, test: false }
}

export function updateClock(state: ClockState, action: ClockAction): ClockState {
  if (action.type === 'confirm') {
    const index = state.pending[action.index] || !action.fallback
      ? action.index : state.pending.findIndex(Boolean)
    const day = state.pending[index]
    if (!day) return state
    return {
      ...state,
      pending: state.pending.map((pending, slot) => slot === index ? null : pending),
      confirmed: { ...state.confirmed, [day]: (state.confirmed[day] ?? 0) | (1 << index) },
      lastConfirmation: { index },
    }
  }
  if (action.type === 'toggle') {
    return { ...state, test: !state.test, now: state.test ? action.now : state.now }
  }
  if ((action.type === 'advance') !== state.test) return state
  const now = action.type === 'advance' ? state.now + action.value : action.value
  const due = dueDays(state.now, now, action.times, state.confirmed)
  return { ...state, now, pending: state.pending.map((pending, index) => due[index] ?? pending) }
}

export const OK_HOLD_MS = 3000

export type MenuMode =
  | { kind: 'normal' }
  | { kind: 'selecionar' }
  | { kind: 'digito'; digit: number; draft: string }

export type MenuState = { times: string[]; selected: number; mode: MenuMode }
type MenuAction =
  | { type: 'hold-ok' | 'ok' | 'cancel' }
  | { type: 'move'; step: 1 | -1 }
  | { type: 'select'; index: number }

export function updateMenu(state: MenuState, action: MenuAction): MenuState {
  const { mode, selected, times } = state
  switch (action.type) {
    case 'hold-ok':
      return mode.kind === 'normal' ? { ...state, mode: { kind: 'selecionar' } } : state
    case 'cancel':
      return { ...state, mode: { kind: 'normal' } }
    case 'select':
      return {
        ...state,
        selected: action.index,
        mode: mode.kind === 'normal' ? mode : { kind: 'selecionar' },
      }
    case 'move':
      if (mode.kind === 'digito') {
        return { ...state, mode: { ...mode, draft: changeDigit(mode.draft, mode.digit, action.step) } }
      }
      return mode.kind === 'selecionar'
        ? { ...state, selected: (selected + action.step + times.length) % times.length }
        : state
    case 'ok':
      if (mode.kind === 'normal') return state
      if (mode.kind === 'selecionar') {
        return { ...state, mode: { kind: 'digito', digit: 0, draft: times[selected] } }
      }
      if (mode.digit < 3) {
        return { ...state, mode: { ...mode, digit: mode.digit + 1 } }
      }
      return {
        ...state,
        mode: { kind: 'normal' },
        times: times.map((time, index) => index === selected ? mode.draft : time),
      }
  }
}
