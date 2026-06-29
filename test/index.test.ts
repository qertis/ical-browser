import test from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import {
  VTodo,
  VEvent,
  VJournal,
  VAlarm,
  VTimezone,
  VFreeBusy,
  VAvailability,
  VAvailable,
  Day,
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
      uri: 'mailto:john.smith@example.com',
    }, {
      name: 'Ann Brown',
      uri: 'mailto:ann.brown@example.com',
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
  assert.ok(event.includes('DTSTART;TZID=America/New_York:20240101T051000'))
  assert.ok(event.includes('DTEND;TZID=America/New_York:20240102T051200'))
  assert.ok(event.includes('LAST-MODIFIED:20240730T072628Z'))
  assert.ok(event.includes('RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=10;UNTIL=20241231T235959Z;WKST=MO;BYDAY=MO,WE,FR;BYWEEKNO=10,20;BYMONTHDAY=5,15,25;BYYEARDAY=100,200'))
  assert.ok(!event.includes('BYWEEKNO10,20'))
  assert.ok(!event.includes('BYYEARDAY100,200'))

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
  assert.ok(ics.includes('DTSTART:20231105T020000'))
  assert.ok(ics.includes('TZNAME:EST'))
  assert.ok(ics.includes('TZNAME:EDT'))
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

  assert.ok(eventWithStringAttendee.ics.includes('ATTENDEE;CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(!eventWithStringAttendee.ics.includes('ORGANIZER:CN=John Smith:mailto:john.smith@example.com'))

  const eventWithAddressListAttendee = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    attendee: [{
      name: 'John Smith',
      uri: 'mailto:john.smith@example.com',
    }, {
      name: 'Ann Brown',
      uri: 'mailto:ann.brown@example.com',
    }],
  })

  assert.ok(eventWithAddressListAttendee.ics.includes('ATTENDEE;CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(eventWithAddressListAttendee.ics.includes('ATTENDEE;CN=Ann Brown:mailto:ann.brown@example.com'))
  assert.ok(!eventWithAddressListAttendee.ics.includes('ORGANIZER;CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(!eventWithAddressListAttendee.ics.includes('ORGANIZER;CN=Ann Brown:mailto:ann.brown@example.com'))
})

test('VFreeBusy', () => {
  const freeBusy = new VFreeBusy({
    uid: '98765@example.com',
    stamp: new Date('2025-01-29T12:00:00Z'),
    start: new Date('2025-02-01T00:00:00Z'),
    end: new Date('2025-02-03T00:00:00Z'),
    organizer: 'mailto:user@example.com',
    attendee: [{
      name: 'Resource One',
      uri: 'mailto:resource@example.com',
    }, {
      name: 'Resource Two',
      uri: 'mailto:resource-2@example.com',
    }],
    contact: ['Ops, Team', 'Helpdesk'],
    comment: ['Known busy period', 'Bring \\notes'],
    url: new URL('https://example.com/free-busy'),
    freeBusy: [
      {
        start: new Date('2025-02-01T09:00:00Z'),
        end: new Date('2025-02-01T11:00:00Z'),
      },
      {
        start: new Date('2025-02-01T13:00:00Z'),
        end: new Date('2025-02-01T14:00:00Z'),
        type: 'BUSY-TENTATIVE',
      },
      {
        start: new Date('2025-02-01T15:00:00Z'),
        duration: 'PT1H',
        type: 'BUSY',
      },
    ],
    xProps: {
      'x-source': 'internal, escaped',
    },
  })

  const ics = freeBusy.ics
  assert.ok(ics.startsWith('BEGIN:VFREEBUSY'))
  assert.ok(ics.endsWith('END:VFREEBUSY'))
  assert.ok(ics.includes('UID:98765@example.com'))
  assert.ok(ics.includes('DTSTAMP:20250129T120000Z'))
  assert.ok(ics.includes('DTSTART:20250201T000000Z'))
  assert.ok(ics.includes('DTEND:20250203T000000Z'))
  assert.ok(ics.includes('ORGANIZER:mailto:user@example.com'))
  assert.ok(ics.includes('ATTENDEE;CN=Resource One:mailto:resource@example.com'))
  assert.ok(ics.includes('ATTENDEE;CN=Resource Two:mailto:resource-2@example.com'))
  assert.ok(ics.includes('CONTACT:Ops\\, Team'))
  assert.ok(ics.includes('CONTACT:Helpdesk'))
  assert.ok(ics.includes('COMMENT:Known busy period'))
  assert.ok(ics.includes('COMMENT:Bring \\notes'))
  assert.ok(ics.includes('URL;VALUE=URI:https://example.com/free-busy'))
  assert.ok(ics.includes('FREEBUSY:20250201T090000Z/20250201T110000Z'))
  assert.ok(ics.includes('FREEBUSY;FBTYPE=BUSY-TENTATIVE:20250201T130000Z/20250201T140000Z'))
  assert.ok(ics.includes('FREEBUSY;FBTYPE=BUSY:20250201T150000Z/PT1H'))
  assert.ok(ics.includes('X-SOURCE:internal\\, escaped'))
  assert.equal(ics.match(/^FREEBUSY/gm)?.length, 3)
  assert.ok(ics.indexOf('DTSTART:20250201T000000Z') < ics.indexOf('FREEBUSY:20250201T090000Z/20250201T110000Z'))
  assert.ok(ics.indexOf('DTEND:20250203T000000Z') < ics.indexOf('FREEBUSY:20250201T090000Z/20250201T110000Z'))
})

test('VAvailable', () => {
  const available = new VAvailable({
    uid: 'work-hours@example.com',
    stamp: new Date('2026-06-29T12:00:00Z'),
    start: new Date('2026-07-06T09:00:00Z'),
    startTz: 'Europe/Berlin',
    end: new Date('2026-07-06T17:00:00Z'),
    endTz: 'Europe/Berlin',
    summary: 'Monday to Friday, 09:00-17:00',
    rrule: {
      freq: 'WEEKLY',
      byday: [Day.mo, Day.tu, Day.we, Day.th, Day.fr],
    },
    rdate: [new Date('2026-07-12T09:00:00Z')],
    exdate: [
      new Date('2026-07-10T09:00:00Z'),
      new Date('2026-07-11T09:00:00Z'),
    ],
  })

  const ics = available.ics
  assert.ok(ics.startsWith('BEGIN:AVAILABLE'))
  assert.ok(ics.endsWith('END:AVAILABLE'))
  assert.ok(ics.includes('UID:work-hours@example.com'))
  assert.ok(ics.includes('DTSTAMP:20260629T120000Z'))
  assert.ok(ics.includes('DTSTART;TZID=Europe/Berlin:20260706T110000'))
  assert.ok(ics.includes('DTEND;TZID=Europe/Berlin:20260706T190000'))
  assert.ok(ics.includes('SUMMARY:Monday to Friday\\, 09:00-17:00'))
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY;WKST=MO;BYDAY=MO,TU,WE,TH,FR'))
  assert.ok(ics.includes('RDATE:20260712T090000Z'))
  assert.ok(ics.includes('EXDATE:20260710T090000Z,20260711T090000Z'))
})

test('VAvailability', () => {
  const available = new VAvailable({
    uid: 'doctor-mon-thu@example.com',
    stamp: new Date('2026-06-29T12:00:00Z'),
    start: new Date('2026-07-06T10:00:00Z'),
    end: new Date('2026-07-06T18:00:00Z'),
    summary: 'Monday to Thursday',
  })
  const availability = new VAvailability({
    uid: 'doctor-availability@example.com',
    stamp: new Date('2026-06-29T12:00:00Z'),
    busyType: 'BUSY-UNAVAILABLE',
    priority: 0,
    summary: 'Doctor working hours',
    categories: ['doctor,calendar', 'booking;hours'],
    xProps: {
      'x-source': 'booking-service',
    },
  })

  availability.addAvailable(available)

  const ics = availability.ics
  assert.ok(ics.startsWith('BEGIN:VAVAILABILITY'))
  assert.ok(ics.endsWith('END:VAVAILABILITY'))
  assert.ok(ics.includes('UID:doctor-availability@example.com'))
  assert.ok(ics.includes('DTSTAMP:20260629T120000Z'))
  assert.ok(ics.includes('BUSYTYPE:BUSY-UNAVAILABLE'))
  assert.ok(ics.includes('PRIORITY:0'))
  assert.ok(ics.includes('SUMMARY:Doctor working hours'))
  assert.ok(ics.includes('CATEGORIES:doctor\\,calendar,booking\\;hours'))
  assert.ok(ics.includes('X-SOURCE:booking-service'))
  assert.ok(ics.indexOf('SUMMARY:Doctor working hours') < ics.indexOf('BEGIN:AVAILABLE'))
  assert.ok(ics.indexOf('BEGIN:AVAILABLE') < ics.indexOf('END:VAVAILABILITY'))
})

test('ICalendar integrates VAVAILABILITY', () => {
  const timezone = new VTimezone({ tzid: 'UTC' })
  timezone.addStandard({
    start: new Date('2026-01-01T00:00:00Z'),
    tzOffsetFrom: '+0000',
    tzOffsetTo: '+0000',
    tzname: 'UTC',
  })
  const availability = new VAvailability({
    uid: 'availability@example.com',
    stamp: new Date('2026-06-29T12:00:00Z'),
  })
  availability.addAvailable(new VAvailable({
    uid: 'available@example.com',
    stamp: new Date('2026-06-29T12:00:00Z'),
    start: new Date('2026-07-06T09:00:00Z'),
    end: new Date('2026-07-06T17:00:00Z'),
  }))
  const event = new VEvent({
    start: new Date('2026-07-06T18:00:00Z'),
    end: new Date('2026-07-06T19:00:00Z'),
  })
  const calendar = new ICalendar({ id: '-//example.com//availability//EN' })

  calendar.addTimezone(timezone)
  calendar.addAvailability(availability)
  calendar.addEvent(event)

  assert.throws(() => calendar.addAvailability({} as never), /availability must be an instance of VAvailability/)

  const ics = calendar.ics
  assert.ok(ics.includes('BEGIN:VCALENDAR'))
  assert.ok(ics.includes('BEGIN:VAVAILABILITY'))
  assert.ok(ics.indexOf('BEGIN:VTIMEZONE') < ics.indexOf('BEGIN:VAVAILABILITY'))
  assert.ok(ics.indexOf('BEGIN:VAVAILABILITY') < ics.indexOf('BEGIN:VEVENT'))
  assert.ok(ics.indexOf('END:VAVAILABILITY') < ics.indexOf('BEGIN:VEVENT'))

  const parsedData = ICAL.parse(ics)
  const comp = new ICAL.Component(parsedData)
  assert.equal(comp.getAllSubcomponents('vavailability').length, 1)
})

test('VAvailability and VAvailable validate invalid input', () => {
  assert.throws(() => new VAvailable({} as never), /start must be a Date object/)
  assert.throws(() => new VAvailable({ start: '2026-07-06' as never }), /start must be a Date object/)
  assert.throws(() => new VAvailable({
    start: new Date('2026-07-06T09:00:00Z'),
    end: '2026-07-06' as never,
  }), /end must be a Date object/)
  assert.throws(() => new VAvailable({
    start: new Date('2026-07-06T09:00:00Z'),
    end: new Date('2026-07-06T17:00:00Z'),
    duration: 'PT8H',
  }), /end and duration must not be used together/)
  assert.throws(() => new VAvailability({
    duration: 'P1D',
  }), /duration must not be used without start/)
  assert.throws(() => new VAvailability({
    busyType: 'BUSY-MAYBE' as never,
  }), /busyType must be BUSY, BUSY-UNAVAILABLE or BUSY-TENTATIVE/)
  assert.throws(() => new VAvailability({
    priority: 10,
  }), /priority must be a number from 0 to 9/)
  assert.throws(() => new VAvailability().addAvailable({} as never), /available must be an instance of VAvailable/)
})

test('VAvailability and VAvailable escape and fold text values', () => {
  const longText = 'Doctor availability, with semicolon; '.repeat(8)
  const available = new VAvailable({
    uid: 'available-text@example.com',
    stamp: new Date('2026-06-29T12:00:00Z'),
    start: new Date('2026-07-06T09:00:00Z'),
    duration: 'PT8H',
    summary: longText,
    description: 'Line 1\nLine 2, with semicolon; and slash \\',
    location: 'Room 1, Floor 2',
    categories: ['work,weekdays', 'booking;public'],
    xProps: {
      'x-note': 'alpha,beta;gamma',
    },
  })
  const availability = new VAvailability({
    uid: 'availability-text@example.com',
    stamp: new Date('2026-06-29T12:00:00Z'),
    summary: longText,
  })
  availability.addAvailable(available)

  assert.ok(available.ics.includes('DESCRIPTION:Line 1\\nLine 2\\, with semicolon\\; and slash \\\\'))
  assert.ok(available.ics.includes('LOCATION:Room 1\\, Floor 2'))
  assert.ok(available.ics.includes('CATEGORIES:work\\,weekdays,booking\\;public'))
  assert.ok(available.ics.includes('X-NOTE:alpha\\,beta\\;gamma'))
  for (const line of availability.ics.split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length <= 75)
  }
})

test('VFreeBusy generates UID and DTSTAMP', () => {
  const freeBusy = new VFreeBusy({
    freeBusy: [{
      start: new Date('2025-02-01T09:00:00Z'),
      end: new Date('2025-02-01T11:00:00Z'),
    }],
  })

  assert.match(freeBusy.ics, /UID:.+/)
  assert.match(freeBusy.ics, /DTSTAMP:\d{8}T\d{6}Z/)
})

test('VFreeBusy supports all FBTYPE values', () => {
  for (const type of ['FREE', 'BUSY', 'BUSY-TENTATIVE', 'BUSY-UNAVAILABLE'] as const) {
    const freeBusy = new VFreeBusy({
      freeBusy: [{
        start: new Date('2025-02-01T09:00:00Z'),
        duration: 'PT1H',
        type,
      }],
    })

    assert.ok(freeBusy.ics.includes(`FREEBUSY;FBTYPE=${type}:20250201T090000Z/PT1H`))
  }
})

test('VFreeBusy validates invalid input', () => {
  const validPeriod = {
    start: new Date('2025-02-01T09:00:00Z'),
    end: new Date('2025-02-01T11:00:00Z'),
  }

  assert.throws(() => new VFreeBusy({} as never), /freeBusy must contain at least one period/)
  assert.throws(() => new VFreeBusy({ freeBusy: [] }), /freeBusy must contain at least one period/)
  assert.throws(() => new VFreeBusy({ start: '2025-02-01' as never, freeBusy: [validPeriod] }), /start must be a Date object/)
  assert.throws(() => new VFreeBusy({ end: '2025-02-01' as never, freeBusy: [validPeriod] }), /end must be a Date object/)
  assert.throws(() => new VFreeBusy({
    start: new Date('2025-02-02T00:00:00Z'),
    end: new Date('2025-02-01T00:00:00Z'),
    freeBusy: [validPeriod],
  }), /end must be after start/)
  assert.throws(() => new VFreeBusy({ freeBusy: [{ end: new Date() } as never] }), /freeBusy period start must be a Date object/)
  assert.throws(() => new VFreeBusy({ freeBusy: [{ start: '2025-02-01' as never, end: new Date() }] }), /freeBusy period start must be a Date object/)
  assert.throws(() => new VFreeBusy({ freeBusy: [{ start: new Date() }] }), /freeBusy period must include either end or duration/)
  assert.throws(() => new VFreeBusy({ freeBusy: [{ ...validPeriod, duration: 'PT1H' }] }), /freeBusy period must not include both end and duration/)
  assert.throws(() => new VFreeBusy({ freeBusy: [{ start: new Date(), end: '2025-02-01' as never }] }), /freeBusy period end must be a Date object/)
  assert.throws(() => new VFreeBusy({
    freeBusy: [{
      start: new Date('2025-02-01T11:00:00Z'),
      end: new Date('2025-02-01T09:00:00Z'),
    }],
  }), /freeBusy period end must be after start/)
  assert.throws(() => new VFreeBusy({
    freeBusy: [{
      start: new Date('2025-02-01T09:00:00Z'),
      duration: 'PT1H',
      type: 'BUSY-MAYBE' as never,
    }],
  }), /freeBusy period type must be FREE, BUSY, BUSY-TENTATIVE or BUSY-UNAVAILABLE/)
  assert.throws(() => new VFreeBusy({
    freeBusy: [validPeriod],
    xProps: { custom: 'value' },
  }), /xProps keys must start with X-/)
})

test('ICalendar integrates VFREEBUSY as a top-level component', () => {
  const timezone = new VTimezone({ tzid: 'UTC' })
  timezone.addStandard({
    start: new Date('2025-01-01T00:00:00Z'),
    tzOffsetFrom: '+0000',
    tzOffsetTo: '+0000',
    tzname: 'UTC',
  })
  const freeBusyA = new VFreeBusy({
    uid: 'fb-a',
    stamp: new Date('2025-01-29T12:00:00Z'),
    freeBusy: [{
      start: new Date('2025-02-01T09:00:00Z'),
      end: new Date('2025-02-01T11:00:00Z'),
    }],
  })
  const freeBusyB = new VFreeBusy({
    uid: 'fb-b',
    stamp: new Date('2025-01-29T12:00:00Z'),
    freeBusy: [{
      start: new Date('2025-02-02T09:00:00Z'),
      duration: 'PT1H',
      type: 'FREE',
    }],
  })
  const event = new VEvent({
    start: new Date('2025-02-01T09:00:00Z'),
    end: new Date('2025-02-01T10:00:00Z'),
  })
  const todo = new VTodo({ summary: 'Task' })
  const journal = new VJournal({ summary: 'Journal' })
  const calendar = new ICalendar({ id: '-//example.com//ical-browser//EN' })

  calendar.addTimezone(timezone)
  calendar.addFreeBusy(freeBusyA)
  calendar.addFreeBusy(freeBusyB)
  calendar.addEvent(event)
  calendar.addTodo(todo)
  calendar.addJournal(journal)

  assert.throws(() => calendar.addFreeBusy({} as never), /freeBusy must be an instance of VFreeBusy/)

  const ics = calendar.ics
  assert.ok(ics.includes('BEGIN:VCALENDAR'))
  assert.ok(ics.includes('BEGIN:VFREEBUSY'))
  assert.equal(ics.match(/BEGIN:VFREEBUSY/g)?.length, 2)
  assert.ok(ics.indexOf('BEGIN:VTIMEZONE') < ics.indexOf('BEGIN:VFREEBUSY'))
  assert.ok(ics.indexOf('BEGIN:VFREEBUSY') < ics.indexOf('BEGIN:VEVENT'))
  assert.ok(ics.indexOf('END:VFREEBUSY') < ics.indexOf('BEGIN:VEVENT'))
  assert.ok(ics.indexOf('END:VEVENT') < ics.indexOf('BEGIN:VTODO'))
  assert.ok(ics.indexOf('END:VTODO') < ics.indexOf('BEGIN:VJOURNAL'))

  const parsedData = ICAL.parse(ics)
  const comp = new ICAL.Component(parsedData)
  assert.equal(comp.getAllSubcomponents('vfreebusy').length, 2)
})

test('event supports optional end and zero values', () => {
  const event = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    priority: 0,
    sequence: 0,
  })

  assert.ok(!event.ics.includes('DURATION:PT1H00M'))
  assert.ok(!event.ics.includes('DTEND'))
  assert.ok(event.ics.includes('PRIORITY:0'))
  assert.ok(event.ics.includes('SEQUENCE:0'))

  const zeroDurationEvent = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T09:00:00Z'),
  })

  assert.ok(zeroDurationEvent.ics.includes('DTEND:20240601T090000Z'))
  assert.ok(!zeroDurationEvent.ics.includes('DURATION:PT1H00M'))
})

test('text values are escaped', () => {
  const event = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    summary: 'Meeting, planning; Q\\A',
    location: 'Room 1, Floor 2',
    categories: ['team,calendar', 'planning;review'],
    'x-custom': 'a,b;c',
  })

  assert.ok(event.ics.includes('SUMMARY:Meeting\\, planning\\; Q\\\\A'))
  assert.ok(event.ics.includes('LOCATION:Room 1\\, Floor 2'))
  assert.ok(event.ics.includes('CATEGORIES:team\\,calendar,planning\\;review'))
  assert.ok(event.ics.includes('X-CUSTOM:a\\,b\\;c'))
})

test('attachments support data urls and uri values', () => {
  const eventWithDataUrl = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    attach: 'data:text/plain;base64,SGVsbG8=',
  })

  assert.ok(eventWithDataUrl.ics.includes('ATTACH;FMTTYPE=text/plain'))
  assert.ok(eventWithDataUrl.ics.includes(';ENCODING=BASE64;VALUE=BINARY'))
  assert.ok(eventWithDataUrl.ics.includes(':SGVsbG8='))

  const eventWithUppercaseBase64DataUrl = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    attach: 'data:text/plain;BASE64,SGVsbG8=',
  })

  assert.ok(eventWithUppercaseBase64DataUrl.ics.includes(';ENCODING=BASE64;VALUE=BINARY'))

  const eventWithUri = new VEvent({
    start: new Date('2024-06-01T09:00:00Z'),
    end: new Date('2024-06-01T10:00:00Z'),
    attach: 'https://example.com/file.txt',
  })

  assert.ok(eventWithUri.ics.includes('ATTACH;VALUE=URI:https://example.com/file.txt'))
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

test('VALARM validates', () => {
  const createAlarm = (data: Record<string, unknown>) => new VAlarm(data as never)

  assert.doesNotThrow(() => createAlarm({
    action: 'DISPLAY',
    trigger: '-PT15M',
    description: 'Reminder text',
  }))
  assert.throws(() => createAlarm({ action: 'DISPLAY', trigger: '-PT15M' }), /description is required for DISPLAY alarm/)
  assert.throws(() => createAlarm({
    action: 'DISPLAY',
    trigger: '-PT15M',
    description: 'Reminder text',
    attach: 'https://example.com/alarm.mp3',
  }), /attach is not allowed for DISPLAY alarm/)
  assert.throws(() => createAlarm({
    action: 'DISPLAY',
    trigger: '-PT15M',
    description: 'Reminder text',
    attendee: 'mailto:user@example.com',
  }), /attendee is not allowed for DISPLAY alarm/)
  assert.throws(() => createAlarm({
    action: 'DISPLAY',
    trigger: '-PT15M',
    description: 'Reminder text',
    summary: 'Subject',
  }), /summary is not allowed for DISPLAY alarm/)

  assert.doesNotThrow(() => createAlarm({ action: 'AUDIO', trigger: '-PT10M' }))
  assert.doesNotThrow(() => createAlarm({
    action: 'AUDIO',
    trigger: '-PT10M',
    attach: 'https://example.com/alarm.mp3',
  }))
  assert.throws(() => createAlarm({
    action: 'AUDIO',
    trigger: '-PT10M',
    description: 'Reminder text',
  }), /description is not allowed for AUDIO alarm/)
  assert.throws(() => createAlarm({
    action: 'AUDIO',
    trigger: '-PT10M',
    summary: 'Subject',
  }), /summary is not allowed for AUDIO alarm/)
  assert.throws(() => createAlarm({
    action: 'AUDIO',
    trigger: '-PT10M',
    attendee: 'mailto:user@example.com',
  }), /attendee is not allowed for AUDIO alarm/)
  assert.throws(() => createAlarm({
    action: 'AUDIO',
    trigger: '-PT10M',
    attach: ['https://example.com/one.mp3', 'https://example.com/two.mp3'],
  }), /AUDIO alarm supports at most one attach/)

  assert.doesNotThrow(() => createAlarm({
    action: 'EMAIL',
    trigger: '-PT30M',
    description: 'Reminder body',
    summary: 'Reminder subject',
    attendee: 'mailto:user@example.com',
  }))
  assert.doesNotThrow(() => createAlarm({
    action: 'EMAIL',
    trigger: '-PT30M',
    description: 'Reminder body',
    summary: 'Reminder subject',
    attendee: [{
      name: 'First',
      uri: 'mailto:first@example.com',
    }, {
      name: 'Second',
      uri: 'mailto:second@example.com',
    }],
  }))
  assert.doesNotThrow(() => createAlarm({
    action: 'EMAIL',
    trigger: '-PT30M',
    description: 'Reminder body',
    summary: 'Reminder subject',
    attendee: 'mailto:user@example.com',
    attach: ['https://example.com/one.txt', 'https://example.com/two.txt'],
  }))
  assert.throws(() => createAlarm({
    action: 'EMAIL',
    trigger: '-PT30M',
    summary: 'Reminder subject',
    attendee: 'mailto:user@example.com',
  }), /description is required for EMAIL alarm/)
  assert.throws(() => createAlarm({
    action: 'EMAIL',
    trigger: '-PT30M',
    description: 'Reminder body',
    attendee: 'mailto:user@example.com',
  }), /summary is required for EMAIL alarm/)
  assert.throws(() => createAlarm({
    action: 'EMAIL',
    trigger: '-PT30M',
    description: 'Reminder body',
    summary: 'Reminder subject',
  }), /at least one attendee is required for EMAIL alarm/)
  assert.throws(() => createAlarm({
    action: 'EMAIL',
    trigger: '-PT30M',
    description: 'Reminder body',
    summary: 'Reminder subject',
    attendee: [],
  }), /at least one attendee is required for EMAIL alarm/)

  assert.throws(() => createAlarm({ trigger: '-PT15M', description: 'Reminder text' }), /action is required/)
  assert.throws(() => createAlarm({ action: 'DISPLAY', description: 'Reminder text' }), /trigger is required/)
  assert.throws(() => createAlarm({
    action: 'DISPLAY',
    trigger: '-PT15M',
    description: 'Reminder text',
    duration: 'PT5M',
  }), /duration and repeat must be used together/)
  assert.throws(() => createAlarm({
    action: 'DISPLAY',
    trigger: '-PT15M',
    description: 'Reminder text',
    repeat: 3,
  }), /duration and repeat must be used together/)
  assert.throws(() => createAlarm({
    action: 'PROCEDURE',
    trigger: '-PT15M',
    attach: 'https://example.com/script.sh',
  }), /unsupported alarm action: PROCEDURE/)
  assert.throws(() => createAlarm({
    action: 'DISPLAY',
    trigger: '-PT15M',
    description: 'Reminder text',
    xProps: { custom: 'value' },
  }), /xProps keys must start with X-/)
})

test('VALARM serializes RFC 5545 alarm properties', () => {
  const emailAlarm = new VAlarm({
    action: 'EMAIL',
    trigger: '-PT30M',
    description: 'Reminder body, with text',
    summary: 'Reminder subject',
    attendee: [{
      name: 'First',
      uri: 'mailto:first@example.com',
    }, {
      name: 'Second',
      uri: 'mailto:second@example.com',
    }],
    attach: ['https://example.com/one.txt', 'https://example.com/two.txt'],
    duration: 'PT5M',
    repeat: 3,
    xProps: {
      'x-custom': 'a,b;c',
    },
  })

  assert.ok(emailAlarm.ics.includes('SUMMARY:Reminder subject'))
  assert.ok(emailAlarm.ics.includes('DESCRIPTION:Reminder body\\, with text'))
  assert.ok(emailAlarm.ics.includes('ATTENDEE;CN=First:mailto:first@example.com'))
  assert.ok(emailAlarm.ics.includes('ATTENDEE;CN=Second:mailto:second@example.com'))
  assert.ok(emailAlarm.ics.includes('ATTACH;VALUE=URI:https://example.com/one.txt'))
  assert.ok(emailAlarm.ics.includes('ATTACH;VALUE=URI:https://example.com/two.txt'))
  assert.ok(emailAlarm.ics.includes('DURATION:PT5M'))
  assert.ok(emailAlarm.ics.includes('REPEAT:3'))
  assert.ok(emailAlarm.ics.includes('X-CUSTOM:a\\,b\\;c'))

  const audioAlarm = new VAlarm({
    action: 'AUDIO',
    trigger: '-PT10M',
    attach: 'https://example.com/alarm.mp3',
  })
  assert.ok(audioAlarm.ics.includes('ACTION:AUDIO'))
  assert.ok(audioAlarm.ics.includes('ATTACH;VALUE=URI:https://example.com/alarm.mp3'))

  const todo = new VTodo({
    uid: 'todo-with-alarm',
    due: new Date('2024-06-01T09:00:00Z'),
    summary: 'Task with reminder',
  })
  todo.addAlarm(new VAlarm({
    action: 'DISPLAY',
    trigger: '-PT15M',
    description: 'Reminder text',
  }))
  assert.ok(todo.ics.includes('BEGIN:VALARM'))
  assert.ok(todo.ics.includes('END:VALARM'))
})
