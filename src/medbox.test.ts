import assert from 'node:assert/strict'
import test from 'node:test'
import { changeDigit, DEFAULT_TIMES, dueCompartments, initialClock, MINUTE, nextDoseTime, parseConfirmations, parseTimes, updateClock, updateMenu } from './medbox.ts'
import type { MenuState } from './medbox.ts'

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()

test('restores four valid stored schedules and rejects malformed values', () => {
  const valid = ['00:00', '23:59', '08:30', '08:30']
  assert.deepEqual(parseTimes(JSON.stringify(valid)), valid)
  for (const bad of [null, 'oops', '[]', '["24:00","12:00","18:00","22:00"]']) {
    assert.deepEqual(parseTimes(bad), DEFAULT_TIMES)
  }
})

test('edits each digit and wraps within 24-hour limits', () => {
  assert.equal(changeDigit('19:45', 0, 1), '23:45')
  assert.equal(changeDigit('23:45', 1, 1), '20:45')
  assert.equal(changeDigit('03:05', 2, -1), '03:55')
  assert.equal(changeDigit('03:59', 3, 1), '03:50')
})

test('finds all due compartments, including simultaneous doses and midnight', () => {
  assert.deepEqual(dueCompartments(at(17, 21), at(18, 0, 5), ['22:00', '00:00', '00:00', '08:00']), [0, 1, 2])
  assert.deepEqual(dueCompartments(at(17, 8), at(17, 8, 1), DEFAULT_TIMES), [])
  assert.deepEqual(dueCompartments(at(17, 12), at(17, 8), DEFAULT_TIMES), [])
})

test('test clock freezes wall ticks and confirmations clear only the chosen alarm', () => {
  const initial = initialClock(at(17, 8), DEFAULT_TIMES)
  const testMode = updateClock(initial, { type: 'toggle', now: initial.now })
  assert.equal(updateClock(testMode, { type: 'tick', value: at(17, 22), times: DEFAULT_TIMES }), testMode)
  const advanced = updateClock(testMode, { type: 'advance', value: 240 * MINUTE, times: DEFAULT_TIMES })
  assert.deepEqual(advanced.pending, ['2026-11-17', '2026-11-17', null, null])
  const confirmed = updateClock(advanced, { type: 'confirm', index: 0 })
  assert.deepEqual(confirmed.pending, [null, '2026-11-17', null, null])
  const resumed = updateClock(confirmed, { type: 'toggle', now: at(17, 9) })
  assert.equal(resumed.now, at(17, 9))
  assert.equal(resumed.test, false)
})

test('requires a long OK press to select and saves only the configured dose after four digits', () => {
  const normal: MenuState = { times: DEFAULT_TIMES, selected: 0, mode: { kind: 'normal' } }
  assert.equal(updateMenu(normal, { type: 'ok' }), normal)
  assert.equal(updateMenu(normal, { type: 'move', step: 1 }), normal)
  let state = updateMenu(normal, { type: 'hold-ok' })
  assert.equal(state.mode.kind, 'selecionar')
  state = updateMenu(state, { type: 'move', step: -1 })
  assert.equal(state.selected, 3)
  state = updateMenu(state, { type: 'ok' })
  assert.deepEqual(state.mode, { kind: 'digito', draft: '22:00', digit: 0 })
  assert.equal(updateMenu(state, { type: 'hold-ok' }), state)
  state = updateMenu(state, { type: 'ok' })
  state = updateMenu(state, { type: 'move', step: 1 })
  state = updateMenu(state, { type: 'ok' })
  state = updateMenu(state, { type: 'move', step: -1 })
  state = updateMenu(state, { type: 'ok' })
  state = updateMenu(state, { type: 'move', step: -1 })
  assert.equal(state.times, DEFAULT_TIMES)
  state = updateMenu(state, { type: 'ok' })
  assert.equal(state.mode.kind, 'normal')
  assert.deepEqual(state.times, ['08:00', '12:00', '18:00', '23:59'])
})

test('cancel exits to normal and changing the selected dose discards an unsaved draft', () => {
  const editing: MenuState = {
    times: DEFAULT_TIMES, selected: 0, mode: { kind: 'digito', draft: '00:00', digit: 2 },
  }
  const selecting = updateMenu(editing, { type: 'select', index: 1 })
  assert.equal(selecting.mode.kind, 'selecionar')
  assert.deepEqual(updateMenu(selecting, { type: 'ok' }).mode, { kind: 'digito', draft: '12:00', digit: 0 })
  assert.deepEqual(updateMenu(editing, { type: 'cancel' }), {
    times: DEFAULT_TIMES, selected: 0, mode: { kind: 'normal' },
  })
})

test('OK falls back to one pending compartment and prefers the selected dose when pending', () => {
  const clock = initialClock(at(17, 12), ['08:00', '12:00', '12:00', '22:00'])
  assert.equal(updateClock(clock, { type: 'confirm', index: 0 }), clock)
  const selected = updateClock(clock, { type: 'confirm', index: 2, fallback: true })
  assert.deepEqual(selected.lastConfirmation, { index: 2 })
  assert.deepEqual(selected.pending.map(Boolean), [false, true, false, false])
  const fallback = updateClock(selected, { type: 'confirm', index: 2, fallback: true })
  assert.deepEqual(fallback.lastConfirmation, { index: 1 })
  assert.deepEqual(fallback.pending.map(Boolean), [false, false, false, false])
  assert.equal(updateClock(fallback, { type: 'confirm', index: 2, fallback: true }), fallback)
})

test('stores confirmations by occurrence date across reload and scheduling edits', () => {
  const clock = initialClock(at(17, 8), DEFAULT_TIMES)
  const confirmed = updateClock(clock, { type: 'confirm', index: 0 })
  const stored = parseConfirmations(JSON.stringify(confirmed.confirmed))
  assert.deepEqual(stored, { '2026-11-17': 1 })
  assert.deepEqual(parseConfirmations('{"bad":1,"2026-11-17":16,"2026-11-18":3}'), { '2026-11-18': 3 })
  assert.equal(initialClock(at(17, 8), DEFAULT_TIMES, stored).pending[0], null)
  const changedTimes = ['09:00', ...DEFAULT_TIMES.slice(1)]
  assert.equal(nextDoseTime(at(17, 8), changedTimes, stored), at(17, 12))
  const sameDay = updateClock(confirmed, { type: 'tick', value: at(17, 9), times: changedTimes })
  assert.equal(sameDay.pending[0], null)
  const tomorrow = updateClock(sameDay, { type: 'tick', value: at(18, 9), times: changedTimes })
  assert.equal(tomorrow.pending[0], '2026-11-18')
})
