import test from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import {
  VTodo,
  VEvent,
  VJournal,
  VAlarm,
  VTimezone,
  default as ICalendar,
} from '../lib/index'

test('icalendar', () => {
  const valarm = new VAlarm({
    trigger: '-PT5M',
    description: 'Reminder',
    action: 'DISPLAY',
  })
  const alarm = valarm.ics
  assert.ok(alarm.length > 0)

  const vtimezone = new VTimezone({ tzid: 'America/New_York' })
  vtimezone.addStandard({
    start: new Date('2023-11-05T02:00:00.611Z'),
    tzOffsetFrom: '-0400',
    tzOffsetTo: '-0500',
    tzname: 'EST',
  })
  vtimezone.addDaylight({
    start: new Date('2024-03-10T02:00:00.611Z'),
    tzOffsetFrom: '-0500',
    tzOffsetTo: '-0400',
    tzname: 'EDT',
  })

  const vevent = new VEvent({
    uid: '1234567890',
    location: 'Online',
    geo: [37.5739497,-85.7399606],
    categories: ['test', 'example'],
    summary: 'Event summary',
    description: 'Event description',
    stamp: new Date(),
    start: new Date('2024-01-01T10:10:00.611Z'),
    end: new Date('2024-01-02T10:12:00.611Z'),
    attach: [
      'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEAAAAACwAAAAAAQABAAACAkQBADs='
    ],
    organizer: 'CN=Jane Doe:mailto:no-reply@example.com',
    attendee: 'CN=John Smith:mailto:john.smith@example.com',
    url: new URL('https://baskovsky.ru#example'),
    klass: 'CONFIDENTIAL',
    transp: 'TRANSPARENT',
    sequence: 1,
    priority: 5,
    'x-custom': 'custom',
    'x-foo': 'bar',
  })
  vevent.addAlarm(valarm)

  const event = vevent.ics
  assert.ok(event.length > 0)
  assert.ok(event.includes('GEO:37.5739497;-85.7399606'))
  assert.ok(event.includes('.gif;'))
  assert.ok(event.includes('CLASS:CONFIDENTIAL'))
  assert.ok(event.includes('TRANSP:TRANSPARENT'))
  assert.ok(event.includes('SEQUENCE:1'))
  assert.ok(event.includes('X-CUSTOM:custom'))
  assert.ok(event.includes('X-FOO:bar'))

  const vtodo = new VTodo({
    uid: '2345678901',
    due: new Date(),
    summary: 'Task summary',
    description: 'Task description',
    priority: 1,
    status: 'COMPLETED',
  })
  const todo = vtodo.ics
  assert.ok(todo.length > 0)

  const vjournal = new VJournal({
    uid: '3456789012',
    summary: 'Journal summary',
    description: 'Journal description',
  })
  const journal = vjournal.ics
  assert.ok(journal.length > 0)

  const calendar = new ICalendar()
  calendar.addEvent(vevent)
  calendar.addTodo(vtodo)
  calendar.addJournal(vjournal)
  calendar.addTimezone(vtimezone)

  const ics = calendar.ics
  assert.ok(ics.includes('BEGIN:VCALENDAR'))
  assert.ok(ics.includes('BEGIN:VEVENT'))
  assert.ok(ics.includes('END:VEVENT'))
  assert.ok(ics.includes('BEGIN:VTODO'))
  assert.ok(ics.includes('END:VTODO'))
  assert.ok(ics.includes('BEGIN:VJOURNAL'))
  assert.ok(ics.includes('END:VJOURNAL'))
  assert.ok(ics.includes('BEGIN:VALARM'))
  assert.ok(ics.includes('END:VCALENDAR'))

  const icalData = ICAL.parse(calendar.ics)
  assert.ok(Array.isArray(icalData))

  const comp = new ICAL.Component(icalData)
  const eventData = comp.getFirstSubcomponent('vevent')
  assert.equal(eventData.getFirstPropertyValue('url'), 'https://baskovsky.ru/#example')
  assert.equal(eventData.getFirstPropertyValue('categories'), 'test')
})
