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
    startTz: 'America/New_York',
    end: new Date('2024-01-02T10:12:00.611Z'),
    endTz: 'America/New_York',
    lastModified: new Date('2024-07-30T07:26:28Z'),
    attach: [
      'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQEAAAAACwAAAAAAQABAAACAkQBADs='
    ],
    organizer: 'CN=Jane Doe:mailto:no-reply@example.com',
    attendee: [{
      name: 'John Smith',
      email: 'john.smith@example.com',
    }, {
      name: 'Ann Brown',
      email: 'ann.brown@example.com',
    }],
    url: new URL('https://baskovsky.ru#example'),
    klass: 'CONFIDENTIAL',
    transp: 'TRANSPARENT',
    sequence: 1,
    priority: 5,
    rrule: {
      freq: 'WEEKLY',
      count: 10,
      interval: 2,
      until: new Date('2024-12-31T23:59:59.611Z'),
      wkst: 'MO',
      byday: ['MO', 'WE', 'FR'],
      bymonthday: [5, 15, 25],
      byweekno: [10, 20],
      byyearday: [100, 200],
    },
    'x-custom': 'custom',
    'x-foo': 'bar',
  })
  vevent.addAlarm(valarm)

  const event = vevent.ics
  assert.ok(event.length > 0)
  assert.ok(!event.includes('\n\n'))
  assert.ok(event.includes('GEO:37.5739497;-85.7399606'))
  assert.ok(event.includes('.gif;'))
  assert.ok(event.includes('CLASS:CONFIDENTIAL'))
  assert.ok(event.includes('TRANSP:TRANSPARENT'))
  assert.ok(event.includes('SEQUENCE:1'))
  assert.ok(event.includes('ORGANIZER:CN=Jane Doe:mailto:no-reply@example.com'))
  assert.ok(event.includes('ATTENDEE;CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(event.includes('ATTENDEE;CN=Ann Brown:mailto:ann.brown@example.com'))
  assert.ok(!event.includes('ORGANIZER;CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(event.includes('X-CUSTOM:custom'))
  assert.ok(event.includes('X-FOO:bar'))
  assert.ok(event.includes('DTSTART;TZID=America/New_York:20240101T101000'))
  assert.ok(event.includes('LAST-MODIFIED:20240730T072628Z'))
  assert.ok(event.includes('RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=10;UNTIL=20241231T235959Z;MO;BYDAY=MO,WE,FR;BYWEEKNO10,20;BYMONTHDAY=5,15,25;BYYEARDAY100,200;'))

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

test('RFC 5545: 75 octets', () => {
  const encoder = new TextEncoder()

  function physicalLines(ics: string): string[] {
    return ics.split('\r\n')
  }

  function assertMaxLineLength(ics: string, label: string) {
    for (const line of physicalLines(ics)) {
      const byteLen = encoder.encode(line).length
      assert.ok(byteLen <= 75, `${label}: line exceeds 75 bytes (${byteLen}): ${JSON.stringify(line.slice(0, 60))}`)
    }
  }

  function assertFoldedLinesHaveLeadingSpace(ics: string, label: string) {
    const lines = physicalLines(ics)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith(' ')) {
        assert.ok(!line.startsWith('  ') || line.trimStart().length === 0,
          `${label}: continuation line must start with exactly one space: ${JSON.stringify(line.slice(0, 40))}`)
      }
    }
  }

  const asciiSummary = 'A'.repeat(80)
  const eventAscii = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    summary: asciiSummary,
  })
  assertMaxLineLength(eventAscii.ics, 'ASCII summary')

  const cyrillicSummary = 'Событие'.repeat(10)
  const eventCyrillic = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    summary: cyrillicSummary,
  })
  assertMaxLineLength(eventCyrillic.ics, 'Cyrillic summary')
  assertFoldedLinesHaveLeadingSpace(eventCyrillic.ics, 'Cyrillic summary')

  const longDescription = 'Дорогие коллеги!\\nМы рады сообщить о запуске новой инициативы – Random, ' +
    'которая состоится 10 ноября.\\nЭто отличный способ познакомиться и пообщаться с коллегами.'
  const eventWithDesc = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    summary: 'Test',
    description: longDescription,
  })
  assertMaxLineLength(eventWithDesc.ics, 'VEvent Cyrillic description')

  const cal = new ICalendar({ id: '-//test//EN' })
  cal.addEvent(eventWithDesc)
  const parsedData = ICAL.parse(cal.ics)
  assert.ok(Array.isArray(parsedData), 'ical.js parse result must be an array')
  const parsedComp = new ICAL.Component(parsedData)
  const parsedEvent = parsedComp.getFirstSubcomponent('vevent')
  assert.ok(parsedEvent.getFirstPropertyValue('description').includes('коллеги'), 'description value must be preserved after fold/unfold')

  const todoWithLongSummary = new VTodo({
    summary: 'Задача: '.repeat(10) + 'завершить',
    description: 'Подробное описание задачи: '.repeat(5),
  })
  assertMaxLineLength(todoWithLongSummary.ics, 'VTodo Cyrillic summary+description')

  const journalWithLongSummary = new VJournal({
    summary: 'Запись журнала о важном событии которое произошло сегодня утром после долгого ожидания',
    description: 'Подробности: сегодня состоялось очень важное событие\\, которое изменит наш рабочий процесс навсегда.',
  })
  assertMaxLineLength(journalWithLongSummary.ics, 'VJournal Cyrillic summary+description')

  const shortEvent = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    summary: 'Short',
    description: 'Brief',
  })
  const shortLines = physicalLines(shortEvent.ics)
  const summaryLine = shortLines.find(l => l.startsWith('SUMMARY:'))
  assert.ok(summaryLine, 'SUMMARY line must exist')
  assert.equal(summaryLine, 'SUMMARY:Short', 'Short summary must not be folded')
})

test('attendee supports string and address list', () => {
  const eventWithStringAttendee = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    attendee: 'CN=John Smith:mailto:john.smith@example.com',
  })

  assert.ok(eventWithStringAttendee.ics.includes('ATTENDEE:CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(!eventWithStringAttendee.ics.includes('ORGANIZER:CN=John Smith:mailto:john.smith@example.com'))

  const eventWithAddressListAttendee = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    attendee: [
      { name: 'John Smith', email: 'john.smith@example.com' },
      { name: 'Ann Brown', email: 'ann.brown@example.com' },
    ],
  })

  assert.ok(eventWithAddressListAttendee.ics.includes('ATTENDEE;CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(eventWithAddressListAttendee.ics.includes('ATTENDEE;CN=Ann Brown:mailto:ann.brown@example.com'))
  assert.ok(!eventWithAddressListAttendee.ics.includes('ORGANIZER;CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(!eventWithAddressListAttendee.ics.includes('ORGANIZER;CN=Ann Brown:mailto:ann.brown@example.com'))
})

test('RFC 5545: text newlines are escaped', () => {
  const description = 'Qweqweqwe\r\nqwe\nqwe\rqwe'
  const event = new VEvent({
    start: new Date('2026-06-12T14:35:00Z'),
    end: new Date('2026-06-12T15:05:00Z'),
    summary: '222',
    description,
  })
  const calendar = new ICalendar({ id: '-//Secretary//Secretary Calendar API-//' })
  calendar.addEvent(event)

  assert.ok(calendar.ics.includes('DESCRIPTION:Qweqweqwe\\nqwe\\nqwe\\nqwe'))
  assert.ok(!calendar.ics.split('\r\n').includes('qwe'))

  const parsed = new ICAL.Component(ICAL.parse(calendar.ics))
  const parsedEvent = parsed.getFirstSubcomponent('vevent')
  assert.equal(parsedEvent.getFirstPropertyValue('description'), 'Qweqweqwe\nqwe\nqwe\nqwe')
})
