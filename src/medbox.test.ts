import assert from 'node:assert/strict'
import test from 'node:test'
import { changeDigit, DEFAULT_TIMES, dueCompartments, initialClock, MINUTE, parseTimes, updateClock } from './medbox.ts'

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
  assert.deepEqual(advanced.pending, [true, true, false, false])
  const confirmed = updateClock(advanced, { type: 'confirm', index: 0 })
  assert.deepEqual(confirmed.pending, [false, true, false, false])
  const resumed = updateClock(confirmed, { type: 'toggle', now: at(17, 9) })
  assert.equal(resumed.now, at(17, 9))
  assert.equal(resumed.test, false)
})
