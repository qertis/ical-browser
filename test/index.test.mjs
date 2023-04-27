import test from 'node:test'
import assert from 'node:assert/strict'
import {
  todo as createTodo,
  event as createEvent,
  journal as createJournal,
  alarm as createAlarm,
  default as icalendar,
} from '../dist/index.js'

test('icalendar', (t) => {
  const uid = '1234567890'

  const event = createEvent({
    uid,
    location: 'Online',
    summary: 'Event summary',
    description: 'Event description',
    stamp: new Date(),
    start: new Date(),
    end: new Date(),
    attach: [
      'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEAAAAACwAAAAAAQABAAACAkQBADs='
    ],
    organizer: 'CN=Jane Doe:mailto:jane.doe@example.com',
    attendee: 'CN=John Smith:mailto:john.smith@example.com',
    url: new URL('https://baskovsky.ru#example'),
  })
  assert.ok(event.length > 0)

  const todo = createTodo({
    uid,
    stamp: new Date(),
    due: new Date(),
    summary: 'Task summary',
    description: 'Task description',
    priority: 1,
    status: 'CONFIRMED',
  })
  assert.ok(todo.length > 0)

  const journal = createJournal({
    uid,
    stamp: new Date(),
    due: new Date(),
    summary: 'Journal summary',
    description: 'Journal description',
  })
  assert.ok(journal.length > 0)

  const alarm = createAlarm({
    uid,
    trigger: '-PT5M',
    description: 'Reminder',
    action: 'DISPLAY',
  })
  assert.ok(alarm.length > 0)

  const icsFile = icalendar('test', 'calendar', event, todo, journal, alarm)

  assert.equal(icsFile.type, 'text/calendar')
  assert.ok(icsFile.name.endsWith('.ics'))
});
