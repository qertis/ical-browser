const test = require('node:test')
const assert = require('node:assert/strict')
const ical = require('../dist/cjs/index.js')

test('icalendar', () => {
  assert.ok(ical.todo)
  assert.ok(ical.event)
  assert.ok(ical.journal)
  assert.ok(ical.alarm)
})
