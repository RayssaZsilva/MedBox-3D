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

export function dueCompartments(from: number, to: number, times: string[]): number[] {
  if (to <= from) return []
  return times.flatMap((time, index) => {
    const [hours, minutes] = time.split(':').map(Number)
    const latest = new Date(to)
    latest.setHours(hours, minutes, 0, 0)
    if (latest.getTime() > to) {
      latest.setDate(latest.getDate() - 1)
      latest.setHours(hours, minutes, 0, 0)
    }
    return latest.getTime() > from ? [index] : []
  })
}

export type ClockState = { now: number; pending: boolean[]; test: boolean }
type ClockAction =
  | { type: 'tick' | 'advance'; value: number; times: string[] }
  | { type: 'toggle'; now: number }
  | { type: 'confirm'; index: number }

export function initialClock(now: number, times: string[]): ClockState {
  const due = dueCompartments(Math.floor(now / MINUTE) * MINUTE - 1, now, times)
  return { now, pending: times.map((_, index) => due.includes(index)), test: false }
}

export function updateClock(state: ClockState, action: ClockAction): ClockState {
  if (action.type === 'confirm') {
    return { ...state, pending: state.pending.map((pending, index) => index !== action.index && pending) }
  }
  if (action.type === 'toggle') {
    return { ...state, test: !state.test, now: state.test ? action.now : state.now }
  }
  if ((action.type === 'advance') !== state.test) return state
  const now = action.type === 'advance' ? state.now + action.value : action.value
  const due = dueCompartments(state.now, now, action.times)
  return { ...state, now, pending: state.pending.map((pending, index) => pending || due.includes(index)) }
}
