import test from 'node:test'
import assert from 'node:assert/strict'
import ICAL from 'ical.js'
import type { RelatedTo, RelType } from '../lib/index'
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

for (const Component of [VEvent, VTodo, VJournal]) {
  test(`${Component.name} serializes RELATED-TO relations`, () => {
    const data = { uid: 'block@example.com', start: Temporal.Instant.from('2026-09-15T10:00:00Z') }
    const relationTypes: RelType[] = ['PARENT', 'CHILD', 'SIBLING']
    const relations: RelatedTo[] = relationTypes.map(reltype => ({
      uid: `${reltype.toLowerCase()}@example.com`, reltype,
    }))
    for (const relation of relations) {
      const component = new Component({ ...data, relatedTo: relation })
      assert.ok(component.ics.includes(`RELATED-TO;RELTYPE=${relation.reltype}:${relation.uid}\r\n`))
    }
    const multiple = new Component({ ...data, relatedTo: relations })
    assert.deepEqual(
      multiple.ics.split('\r\n').filter(line => line.startsWith('RELATED-TO')),
      relations.map(({ uid, reltype }) => `RELATED-TO;RELTYPE=${reltype}:${uid}`),
    )
    for (const relatedTo of [undefined, []]) {
      assert.ok(!new Component({ ...data, relatedTo }).ics.includes('RELATED-TO'))
    }
  })

  test(`${Component.name} escapes and folds RELATED-TO UID`, () => {
    const uid = 'отчёт😀'.repeat(20) + ';part,one\\path\nnext@example.com'
    const component = new Component({
      uid: 'block@example.com',
      start: Temporal.Instant.from('2026-09-15T10:00:00Z'),
      relatedTo: { uid, reltype: 'PARENT' },
    })
    const ics = component.ics
    assert.ok(ics.includes('\r\n '))
    for (const line of ics.split('\r\n')) {
      assert.ok(Buffer.byteLength(line, 'utf8') <= 75)
    }
    const unfolded = ics.replace(/\r\n /g, '')
    assert.ok(unfolded.includes('\\;part\\,one\\\\path\\nnext@example.com'))
    const parsed = new ICAL.Component(ICAL.parse(ics))
    const relation = parsed.getFirstProperty('related-to')!
    assert.equal(relation.getFirstValue(), uid)
    assert.equal(relation.getParameter('reltype'), 'PARENT')
  })
}

test('event blocks reference the task UID through PARENT', () => {
  const calendar = new ICalendar()
  const taskUid = 'report@example.com'
  calendar.addTodo(new VTodo({ uid: taskUid, summary: 'Prepare report' }))
  for (const uid of ['block-1@example.com', 'block-2@example.com']) {
    calendar.addEvent(new VEvent({
      uid,
      start: Temporal.Instant.from('2026-09-15T10:00:00Z'),
      relatedTo: { uid: taskUid, reltype: 'PARENT' },
    }))
  }
  const parsed = new ICAL.Component(ICAL.parse(calendar.ics))
  const todo = parsed.getFirstSubcomponent('vtodo')!
  const events = parsed.getAllSubcomponents('vevent')
  assert.equal(events.length, 2)
  for (const event of events) {
    const relations = event.getAllProperties('related-to')
    assert.equal(relations.length, 1)
    assert.equal(relations[0].getFirstValue(), todo.getFirstPropertyValue('uid'))
    assert.equal(relations[0].getParameter('reltype'), 'PARENT')
  }
})

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
    start: Temporal.PlainDateTime.from('2023-11-05T02:00:00.611'),
    tzOffsetFrom: '-0400',
    tzOffsetTo: '-0500',
    tzname: 'EST',
  })
  vtimezone.addDaylight({
    start: Temporal.PlainDateTime.from('2024-03-10T02:00:00.611'),
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
    stamp: Temporal.Now.instant(),
    start: Temporal.Instant.from('2024-01-01T10:10:00.611Z').toZonedDateTimeISO('America/New_York'),
    end: Temporal.Instant.from('2024-01-02T10:12:00.611Z').toZonedDateTimeISO('America/New_York'),
    lastModified: Temporal.Instant.from('2024-07-30T07:26:28Z'),
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
      interval: 2,
      until: Temporal.Instant.from('2024-12-31T23:59:59.611Z'),
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
  assert.ok(event.replace(/\r\n /g, '').includes('RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL=20241231T235959Z;WKST=MO;BYDAY=MO,WE,FR;BYWEEKNO=10,20;BYMONTHDAY=5,15,25;BYYEARDAY=100,200'))
  assert.ok(!event.includes('BYWEEKNO10,20'))
  assert.ok(!event.includes('BYYEARDAY100,200'))

  const vtodo = new VTodo({
    uid: '2345678901',
    due: Temporal.Now.instant(),
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

test('RRULE omits empty BY parts and remains parseable', () => {
  const event = new VEvent({
    uid: 'monthly@example.com',
    start: Temporal.Instant.from('2026-07-10T10:00:00Z'),
    rrule: {
      freq: 'MONTHLY',
      interval: 1,
      byday: [],
      bymonthday: 10,
      bymonth: [],
      byhour: [],
      byminute: [],
    },
  })

  assert.ok(event.ics.includes('RRULE:FREQ=MONTHLY;INTERVAL=1;WKST=MO;BYMONTHDAY=10'))
  assert.ok(!event.ics.includes('BYDAY='))
  assert.ok(!event.ics.includes('BYMONTH='))
  assert.ok(!event.ics.includes('BYHOUR='))
  assert.ok(!event.ics.includes('BYMINUTE='))
  assert.doesNotThrow(() => ICAL.parse(event.ics))
})

test('RRULE serializes scalar and array BY values, including zero', () => {
  const yearly = new VEvent({
    uid: 'yearly@example.com',
    start: Temporal.Instant.from('2026-07-10T10:00:00Z'),
    rrule: {
      freq: 'YEARLY',
      bymonth: [1, 7],
      bymonthday: 10,
    },
  })
  const daily = new VEvent({
    uid: 'daily@example.com',
    start: Temporal.Instant.from('2026-07-10T10:00:00Z'),
    rrule: {
      freq: 'DAILY',
      bymonth: 7,
      byhour: 0,
      byminute: 0,
    },
  })
  const dailyLists = new VEvent({
    uid: 'daily-lists@example.com',
    start: Temporal.Instant.from('2026-07-10T10:00:00Z'),
    rrule: {
      freq: 'DAILY',
      bymonth: [1, 7],
      byhour: [0, 12],
      byminute: [0, 30],
    },
  })

  assert.ok(yearly.ics.includes('RRULE:FREQ=YEARLY;WKST=MO;BYMONTH=1,7;BYMONTHDAY=10'))
  assert.ok(daily.ics.includes('RRULE:FREQ=DAILY;WKST=MO;BYMONTH=7;BYHOUR=0;BYMINUTE=0'))
  assert.ok(dailyLists.ics.includes('RRULE:FREQ=DAILY;WKST=MO;BYMONTH=1,7;BYHOUR=0,12;BYMINUTE=0,30'))
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
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
    summary: asciiSummary,
  })
  assertMaxLineLength(eventAscii.ics, 'ASCII summary')

  const cyrillicSummary = 'Событие'.repeat(10)
  const eventCyrillic = new VEvent({
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
    summary: cyrillicSummary,
  })
  assertMaxLineLength(eventCyrillic.ics, 'Cyrillic summary')
  assertFoldedLinesHaveLeadingSpace(eventCyrillic.ics, 'Cyrillic summary')

  const longDescription = 'Дорогие коллеги!\\nМы рады сообщить о запуске новой инициативы – Random, ' +
    'которая состоится 10 ноября.\\nЭто отличный способ познакомиться и пообщаться с коллегами.'
  const eventWithDesc = new VEvent({
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
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
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
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
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
    attendee: 'CN=John Smith:mailto:john.smith@example.com',
  })

  assert.ok(eventWithStringAttendee.ics.includes('ATTENDEE;CN=John Smith:mailto:john.smith@example.com'))
  assert.ok(!eventWithStringAttendee.ics.includes('ORGANIZER:CN=John Smith:mailto:john.smith@example.com'))

  const eventWithAddressListAttendee = new VEvent({
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
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
    stamp: Temporal.Instant.from('2025-01-29T12:00:00Z'),
    start: Temporal.Instant.from('2025-02-01T00:00:00Z'),
    end: Temporal.Instant.from('2025-02-03T00:00:00Z'),
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
        start: Temporal.Instant.from('2025-02-01T09:00:00Z'),
        end: Temporal.Instant.from('2025-02-01T11:00:00Z'),
      },
      {
        start: Temporal.Instant.from('2025-02-01T13:00:00Z'),
        end: Temporal.Instant.from('2025-02-01T14:00:00Z'),
        type: 'BUSY-TENTATIVE',
      },
      {
        start: Temporal.Instant.from('2025-02-01T15:00:00Z'),
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
  assert.ok(ics.includes('COMMENT:Bring \\\\notes'))
  const parsed = new ICAL.Component(ICAL.parse(ics))
  assert.equal(parsed.getAllProperties('comment')[1].getFirstValue(), 'Bring \\notes')
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
    stamp: Temporal.Instant.from('2026-06-29T12:00:00Z'),
    start: Temporal.Instant.from('2026-07-06T09:00:00Z').toZonedDateTimeISO('Europe/Berlin'),
    end: Temporal.Instant.from('2026-07-06T17:00:00Z').toZonedDateTimeISO('Europe/Berlin'),
    summary: 'Monday to Friday, 09:00-17:00',
    rrule: {
      freq: 'WEEKLY',
      byday: [Day.mo, Day.tu, Day.we, Day.th, Day.fr],
    },
    rdate: [Temporal.Instant.from('2026-07-12T09:00:00Z')],
    exdate: [
      Temporal.Instant.from('2026-07-10T09:00:00Z'),
      Temporal.Instant.from('2026-07-11T09:00:00Z'),
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
    stamp: Temporal.Instant.from('2026-06-29T12:00:00Z'),
    start: Temporal.Instant.from('2026-07-06T10:00:00Z'),
    end: Temporal.Instant.from('2026-07-06T18:00:00Z'),
    summary: 'Monday to Thursday',
  })
  const availability = new VAvailability({
    uid: 'doctor-availability@example.com',
    stamp: Temporal.Instant.from('2026-06-29T12:00:00Z'),
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
    start: Temporal.PlainDateTime.from('2026-01-01T00:00:00'),
    tzOffsetFrom: '+0000',
    tzOffsetTo: '+0000',
    tzname: 'UTC',
  })
  const availability = new VAvailability({
    uid: 'availability@example.com',
    stamp: Temporal.Instant.from('2026-06-29T12:00:00Z'),
  })
  availability.addAvailable(new VAvailable({
    uid: 'available@example.com',
    stamp: Temporal.Instant.from('2026-06-29T12:00:00Z'),
    start: Temporal.Instant.from('2026-07-06T09:00:00Z'),
    end: Temporal.Instant.from('2026-07-06T17:00:00Z'),
  }))
  const event = new VEvent({
    start: Temporal.Instant.from('2026-07-06T18:00:00Z'),
    end: Temporal.Instant.from('2026-07-06T19:00:00Z'),
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
  assert.throws(() => new VAvailable({
    start: Temporal.Instant.from('2026-07-06T09:00:00Z'),
    end: Temporal.Instant.from('2026-07-06T17:00:00Z'),
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
    stamp: Temporal.Instant.from('2026-06-29T12:00:00Z'),
    start: Temporal.Instant.from('2026-07-06T09:00:00Z'),
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
    stamp: Temporal.Instant.from('2026-06-29T12:00:00Z'),
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
      start: Temporal.Instant.from('2025-02-01T09:00:00Z'),
      end: Temporal.Instant.from('2025-02-01T11:00:00Z'),
    }],
  })

  assert.match(freeBusy.ics, /UID:.+/)
  assert.match(freeBusy.ics, /DTSTAMP:\d{8}T\d{6}Z/)
})

test('VFreeBusy supports all FBTYPE values', () => {
  for (const type of ['FREE', 'BUSY', 'BUSY-TENTATIVE', 'BUSY-UNAVAILABLE'] as const) {
    const freeBusy = new VFreeBusy({
      freeBusy: [{
        start: Temporal.Instant.from('2025-02-01T09:00:00Z'),
        duration: 'PT1H',
        type,
      }],
    })

    assert.ok(freeBusy.ics.includes(`FREEBUSY;FBTYPE=${type}:20250201T090000Z/PT1H`))
  }
})

test('VFreeBusy validates invalid input', () => {
  const validPeriod = {
    start: Temporal.Instant.from('2025-02-01T09:00:00Z'),
    end: Temporal.Instant.from('2025-02-01T11:00:00Z'),
  }

  assert.throws(() => new VFreeBusy({} as never), /freeBusy must contain at least one period/)
  assert.throws(() => new VFreeBusy({ freeBusy: [] }), /freeBusy must contain at least one period/)
  assert.throws(() => new VFreeBusy({
    start: Temporal.Instant.from('2025-02-02T00:00:00Z'),
    end: Temporal.Instant.from('2025-02-01T00:00:00Z'),
    freeBusy: [validPeriod],
  }), /end must be after start/)
  assert.throws(() => new VFreeBusy({ freeBusy: [{ start: Temporal.Now.instant() }] }), /freeBusy period must include either end or duration/)
  assert.throws(() => new VFreeBusy({ freeBusy: [{ ...validPeriod, duration: 'PT1H' }] }), /freeBusy period must not include both end and duration/)
  assert.throws(() => new VFreeBusy({
    freeBusy: [{
      start: Temporal.Instant.from('2025-02-01T11:00:00Z'),
      end: Temporal.Instant.from('2025-02-01T09:00:00Z'),
    }],
  }), /freeBusy period end must be after start/)
  assert.throws(() => new VFreeBusy({
    freeBusy: [{
      start: Temporal.Instant.from('2025-02-01T09:00:00Z'),
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
    start: Temporal.PlainDateTime.from('2025-01-01T00:00:00'),
    tzOffsetFrom: '+0000',
    tzOffsetTo: '+0000',
    tzname: 'UTC',
  })
  const freeBusyA = new VFreeBusy({
    uid: 'fb-a',
    stamp: Temporal.Instant.from('2025-01-29T12:00:00Z'),
    freeBusy: [{
      start: Temporal.Instant.from('2025-02-01T09:00:00Z'),
      end: Temporal.Instant.from('2025-02-01T11:00:00Z'),
    }],
  })
  const freeBusyB = new VFreeBusy({
    uid: 'fb-b',
    stamp: Temporal.Instant.from('2025-01-29T12:00:00Z'),
    freeBusy: [{
      start: Temporal.Instant.from('2025-02-02T09:00:00Z'),
      duration: 'PT1H',
      type: 'FREE',
    }],
  })
  const event = new VEvent({
    start: Temporal.Instant.from('2025-02-01T09:00:00Z'),
    end: Temporal.Instant.from('2025-02-01T10:00:00Z'),
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
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    priority: 0,
    sequence: 0,
  })

  assert.ok(!event.ics.includes('DURATION:PT1H00M'))
  assert.ok(!event.ics.includes('DTEND'))
  assert.ok(event.ics.includes('PRIORITY:0'))
  assert.ok(event.ics.includes('SEQUENCE:0'))

  assert.throws(() => new VEvent({
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T09:00:00Z'),
  }), /end must be after start/)
})

test('ICalendar automatically adds unique VTIMEZONE blocks used by events', () => {
  const calendar = new ICalendar()
  calendar.addEvent(new VEvent({
    start: Temporal.Instant.from('2026-07-10T10:00:00Z').toZonedDateTimeISO('Europe/Moscow'),
    end: Temporal.Instant.from('2026-07-10T11:00:00Z').toZonedDateTimeISO('Europe/Moscow'),
    location: 'America/New_York',
  }))
  calendar.addEvent(new VEvent({
    start: Temporal.Instant.from('2026-07-11T10:00:00Z').toZonedDateTimeISO('Europe/Moscow'),
    end: Temporal.Instant.from('2026-07-11T11:00:00Z').toZonedDateTimeISO('America/New_York'),
  }))

  const ics = calendar.ics
  assert.equal(ics.match(/BEGIN:VTIMEZONE/g)?.length, 2)
  assert.equal(ics.match(/TZID:Europe\/Moscow/g)?.length, 1)
  assert.equal(ics.match(/TZID:America\/New_York/g)?.length, 1)
  assert.doesNotThrow(() => ICAL.parse(ics))
})

test('event converts absolute dates to the selected IANA timezone', () => {
  const event = new VEvent({
    start: Temporal.Instant.from('2024-07-31T11:00:00Z').toZonedDateTimeISO('Europe/Moscow'),
    end: Temporal.Instant.from('2024-07-31T12:00:00Z').toZonedDateTimeISO('Europe/Moscow'),
  })

  assert.ok(event.ics.includes('DTSTART;TZID=Europe/Moscow:20240731T140000'))
  assert.ok(event.ics.includes('DTEND;TZID=Europe/Moscow:20240731T150000'))
})

test('event keeps UTC serialization when no timezone is selected', () => {
  const event = new VEvent({
    start: Temporal.Instant.from('2024-07-31T11:00:00Z'),
    end: Temporal.Instant.from('2024-07-31T12:00:00Z'),
  })

  assert.ok(event.ics.includes('DTSTART:20240731T110000Z'))
  assert.ok(event.ics.includes('DTEND:20240731T120000Z'))
})

test('manual VTimezone takes priority over the automatic block', () => {
  const timezone = new VTimezone({ tzid: 'Europe/Moscow' })
  timezone.addStandard({
    start: Temporal.PlainDateTime.from('1970-01-01T00:00:00'),
    tzOffsetFrom: '+0300',
    tzOffsetTo: '+0300',
    tzname: 'CUSTOM-MSK',
  })
  const calendar = new ICalendar()
  calendar.addTimezone(timezone)
  calendar.addEvent(new VEvent({
    start: Temporal.Instant.from('2026-07-10T10:00:00Z').toZonedDateTimeISO('Europe/Moscow'),
  }))

  const ics = calendar.ics
  assert.equal(ics.match(/BEGIN:VTIMEZONE/g)?.length, 1)
  assert.ok(ics.includes('TZNAME:CUSTOM-MSK'))
  assert.ok(!ics.includes('X-LIC-LOCATION:Europe/Moscow'))
})

test('manual timezone observances serialize local DTSTART without Z or TZID', () => {
  const timezone = new VTimezone({ tzid: 'America/New_York' })
  timezone.addStandard({ start: Temporal.PlainDateTime.from('2026-11-01T02:00:00'), tzOffsetFrom: '-0400', tzOffsetTo: '-0500', tzname: 'EST' })
  timezone.addDaylight({ start: Temporal.PlainDateTime.from('2026-03-08T02:00:00'), tzOffsetFrom: '-0500', tzOffsetTo: '-0400', tzname: 'EDT' })
  const parsed = new ICAL.Component(ICAL.parse(timezone.ics))
  for (const [kind, expected] of [['standard', '20261101T020000'], ['daylight', '20260308T020000']]) {
    const observance = parsed.getFirstSubcomponent(kind)!
    const property = observance.getFirstProperty('dtstart')!
    assert.equal(property.getParameter('tzid'), undefined)
    assert.equal((property.getFirstValue() as ICAL.Time).zone, ICAL.Timezone.localTimezone)
    assert.ok(observance.toString().includes(`DTSTART:${expected}\r\n`))
  }
})

test('event rejects an end at or before start', () => {
  const start = Temporal.Instant.from('2026-09-30T10:00:00Z')
  for (const end of [start, start.subtract({ seconds: 1 })]) {
    assert.throws(() => new VEvent({ start, end }), /end must be after start/)
  }
  assert.doesNotThrow(() => new VEvent({ start }))
  const event = new VEvent({ start: start.toZonedDateTimeISO('Europe/Moscow'), end: start.add({ hours: 1 }).toZonedDateTimeISO('America/New_York') })
  const parsed = new ICAL.Component(ICAL.parse(event.ics))
  assert.ok(parsed.getFirstProperty('dtstart'))
  assert.ok(parsed.getFirstProperty('dtend'))
})

test('event location does not add a VTIMEZONE block', () => {
  const calendar = new ICalendar()
  calendar.addEvent(new VEvent({
    start: Temporal.Instant.from('2026-07-10T10:00:00Z'),
    location: 'Europe/Moscow',
  }))

  assert.ok(!calendar.ics.includes('BEGIN:VTIMEZONE'))
})

test('address names preserve parameter delimiters, quotes, carets and newlines', () => {
  const names = ['Jane: Doe', 'Jane; Doe', 'Doe, Jane', 'Jane "J" Doe', 'Jane^nDoe', 'Jane\r\nSTATUS:CANCELLED', 'Иван😀'.repeat(30)]
  for (const name of names) {
    const address = { name, uri: 'jane@example.com' }
    for (const value of [address, [address]]) {
      const event = new VEvent({ start: Temporal.Instant.from('2026-09-30T10:00:00Z'), attendee: value, organizer: value })
      const parsed = new ICAL.Component(ICAL.parse(event.ics))
      for (const property of ['attendee', 'organizer']) {
        const properties = parsed.getAllProperties(property)
        assert.equal(properties.length, 1)
        assert.equal(properties[0].getFirstValue(), 'mailto:jane@example.com')
        assert.equal(properties[0].getParameter('cn'), name.replace(/\r\n/g, '\n'))
      }
      assert.equal(parsed.getFirstProperty('status'), null)
      for (const line of event.ics.split('\r\n')) {
        assert.ok(Buffer.byteLength(line, 'utf8') <= 75)
      }
    }
  }
})

test('text values are escaped', () => {
  const event = new VEvent({
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
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

test('TEXT serialization preserves literal backslash sequences', () => {
  const text = String.raw`a\,b\;c\nd\Ne\\f C:\new\notes` + '\nnext'
  for (const Component of [VEvent, VTodo, VJournal]) {
    const component = new Component({ start: Temporal.Instant.from('2026-09-30T10:00:00Z'), summary: text, description: text })
    const parsed = new ICAL.Component(ICAL.parse(component.ics))
    assert.equal(parsed.getFirstPropertyValue('summary'), text)
    assert.equal(parsed.getFirstPropertyValue('description'), text)
  }
})

test('attachments support data urls and uri values', () => {
  const eventWithDataUrl = new VEvent({
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
    attach: 'data:text/plain;base64,SGVsbG8=',
  })

  assert.ok(eventWithDataUrl.ics.includes('ATTACH;FMTTYPE=text/plain'))
  assert.ok(eventWithDataUrl.ics.includes(';ENCODING=BASE64;VALUE=BINARY'))
  assert.ok(eventWithDataUrl.ics.includes(':SGVsbG8='))

  const eventWithUppercaseBase64DataUrl = new VEvent({
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
    attach: 'data:text/plain;BASE64,SGVsbG8=',
  })

  assert.ok(eventWithUppercaseBase64DataUrl.ics.includes(';ENCODING=BASE64;VALUE=BINARY'))

  const eventWithUri = new VEvent({
    start: Temporal.Instant.from('2024-06-01T09:00:00Z'),
    end: Temporal.Instant.from('2024-06-01T10:00:00Z'),
    attach: 'https://example.com/file.txt',
  })

  assert.ok(eventWithUri.ics.includes('ATTACH;VALUE=URI:https://example.com/file.txt'))
})

test('RFC 5545: text newlines are escaped', () => {
  const description = 'Qweqweqwe\r\nqwe\nqwe\rqwe'
  const event = new VEvent({
    start: Temporal.Instant.from('2026-06-12T14:35:00Z'),
    end: Temporal.Instant.from('2026-06-12T15:05:00Z'),
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
    due: Temporal.Instant.from('2024-06-01T09:00:00Z'),
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

test('PlainDate events use exclusive DATE boundaries and support a one-day default', () => {
  const start = Temporal.PlainDate.from('2026-12-31')
  const event = new VEvent({ uid: 'all-day', start, end: start.add({ days: 2 }) })
  assert.ok(event.ics.includes('DTSTART;VALUE=DATE:20261231'))
  assert.ok(event.ics.includes('DTEND;VALUE=DATE:20270102'))
  const parsed = new ICAL.Component(ICAL.parse(event.ics))
  assert.equal((parsed.getFirstPropertyValue('dtstart') as ICAL.Time).isDate, true)
  assert.equal((parsed.getFirstPropertyValue('dtend') as ICAL.Time).toString(), '2027-01-02')
  const single = new VEvent({ uid: 'one-day', start })
  assert.ok(!single.ics.includes('DTEND'))
  assert.deepEqual(single.timezones, [])
  for (const end of [start, start.subtract({ days: 1 })]) {
    assert.throws(() => new VEvent({ uid: 'invalid', start, end }), /end must be after start/)
  }
  assert.throws(() => new VEvent({ uid: 'invalid', start, end: Temporal.Instant.from('2027-01-02T00:00Z') }), /both be dates/)
})

test('Temporal events preserve elapsed time across spring and autumn DST', () => {
  const zone = 'Europe/Berlin'
  const spring = new VEvent({
    uid: 'spring',
    start: Temporal.ZonedDateTime.from('2026-03-29T01:30+01:00[Europe/Berlin]'),
    end: Temporal.ZonedDateTime.from('2026-03-29T03:30+02:00[Europe/Berlin]'),
  })
  assert.ok(spring.ics.includes('DTSTART;TZID=Europe/Berlin:20260329T013000'))
  assert.ok(spring.ics.includes('DTEND;TZID=Europe/Berlin:20260329T033000'))
  const autumn = new VEvent({
    uid: 'autumn',
    start: Temporal.ZonedDateTime.from('2026-10-25T01:30+02:00[Europe/Berlin]'),
    end: Temporal.ZonedDateTime.from('2026-10-25T03:30+01:00[Europe/Berlin]'),
  })
  assert.ok(autumn.ics.includes('DTSTART;TZID=Europe/Berlin:20261025T013000'))
  assert.ok(autumn.ics.includes('DTEND;TZID=Europe/Berlin:20261025T033000'))
  const calendar = new ICalendar()
  calendar.addEvent(spring)
  calendar.addEvent(autumn)
  const parsed = new ICAL.Component(ICAL.parse(calendar.ics))
  const timezone = new ICAL.Timezone({ component: parsed.getFirstSubcomponent('vtimezone')! })
  ICAL.TimezoneService.register(zone, timezone)
  try {
    for (const event of parsed.getAllSubcomponents('vevent')) {
      const start = event.getFirstPropertyValue('dtstart') as ICAL.Time
      const end = event.getFirstPropertyValue('dtend') as ICAL.Time
      assert.equal(end.toUnixTime() - start.toUnixTime(), event.getFirstPropertyValue('uid') === 'spring' ? 3600 : 10800)
    }
  } finally {
    ICAL.TimezoneService.remove(zone)
  }
})

test('VEvent serializes all-day UNTIL, RDATE and EXDATE with date values', () => {
  const start = Temporal.PlainDate.from('2026-09-30')
  const event = new VEvent({
    uid: 'recurrence', start,
    rrule: { freq: 'DAILY', until: start.add({ days: 10 }) },
    rdate: [start.add({ days: 12 }), start.add({ days: 13 })],
    exdate: [start, start.add({ days: 3 })],
  })
  assert.ok(event.ics.includes('UNTIL=20261010'))
  assert.ok(event.ics.includes('RDATE;VALUE=DATE:20261012,20261013'))
  assert.ok(event.ics.includes('EXDATE;VALUE=DATE:20260930,20261003'))
  const parsed = new ICAL.Component(ICAL.parse(event.ics))
  assert.equal((parsed.getFirstPropertyValue('rrule') as ICAL.Recur).until!.isDate, true)
  assert.ok(parsed.getFirstProperty('rdate')!.getValues().every((value: ICAL.Time) => value.isDate))
  assert.ok(parsed.getFirstProperty('exdate')!.getValues().every((value: ICAL.Time) => value.isDate))
})

test('VEvent recurrence lists preserve exact zoned moments and fold long lists', () => {
  const start = Temporal.ZonedDateTime.from('2026-10-24T02:30+02:00[Europe/Berlin]')
  const dates = Array.from({ length: 20 }, (_, days) => start.add({ days }))
  const event = new VEvent({
    uid: 'timed-recurrence', start,
    rrule: { freq: 'DAILY', until: dates.at(-1) },
    rdate: dates,
    exdate: [Temporal.ZonedDateTime.from('2026-10-25T02:30+01:00[Europe/Berlin]')],
  })
  assert.ok(event.ics.includes('EXDATE:20261025T013000Z'))
  assert.ok(event.ics.includes('\r\n '))
  for (const line of event.ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75)
  const parsed = new ICAL.Component(ICAL.parse(event.ics))
  assert.equal(parsed.getFirstProperty('rdate')!.getValues().length, dates.length)
  parsed.getFirstProperty('rdate')!.getValues().forEach((value: ICAL.Time, i) => {
    assert.equal(value.toUnixTime(), Number(dates[i].epochNanoseconds / 1_000_000_000n))
  })
  const standalone = new VEvent({ uid: 'no-rule', start, rdate: [dates[1]], exdate: [] })
  assert.ok(standalone.ics.includes('RDATE:'))
  assert.ok(!standalone.ics.includes('EXDATE:'))
  assert.ok(!standalone.ics.includes('RRULE:'))
  const empty = new VEvent({ uid: 'empty', start, rdate: [], exdate: [] })
  assert.ok(!empty.ics.includes('RDATE:'))
})

test('recurrence lists reject incompatible Temporal types', () => {
  const start = Temporal.PlainDate.from('2026-09-30')
  const moment = Temporal.Instant.from('2026-09-30T10:00Z')
  for (const field of ['rdate', 'exdate']) {
    assert.throws(() => new VEvent({ uid: 'invalid', start, [field]: [moment] }), /same value type/)
    assert.throws(() => new VEvent({ uid: 'invalid', start: moment, [field]: [start] }), /same value type/)
  }
})

test('Temporal components preserve DATE semantics and fixed-offset moments', () => {
  const date = Temporal.PlainDate.from('2026-09-30')
  assert.ok(new VTodo({ uid: 'todo', due: date }).ics.includes('DUE;VALUE=DATE:20260930'))
  assert.ok(new VJournal({ uid: 'journal', start: date }).ics.includes('DTSTART;VALUE=DATE:20260930'))
  const fixed = new VEvent({ uid: 'fixed-offset', start: Temporal.ZonedDateTime.from('2026-09-30T10:00+03:00[+03:00]') })
  assert.ok(fixed.ics.includes('DTSTART:20260930T070000Z'))
  assert.deepEqual(fixed.timezones, [])
})

test('Temporal formatting uses ISO dates and truncates fractional seconds before the Unix epoch', () => {
  const date = Temporal.PlainDate.from('1999-01-02').withCalendar('hebrew')
  const allDay = new VEvent({ start: date, end: Temporal.PlainDate.from('1999-01-03').withCalendar('hebrew') })
  assert.ok(allDay.ics.includes('DTSTART;VALUE=DATE:19990102'))
  assert.ok(allDay.ics.includes('DTEND;VALUE=DATE:19990103'))

  const start = Temporal.Instant.from('1969-12-31T23:59:59.999999999Z')
  const event = new VEvent({ start, end: start.add({ seconds: 1 }), stamp: start })
  assert.ok(event.ics.includes('DTSTAMP:19691231T235959Z'))
  assert.ok(event.ics.includes('DTSTART:19691231T235959Z'))
  assert.ok(event.ics.includes('DTEND:19700101T000000Z'))
})

test('automatic timezone blocks include zoned todo, journal and availability boundaries', () => {
  const start = Temporal.Instant.from('2026-09-30T10:00Z').toZonedDateTimeISO('Europe/Berlin')
  const calendar = new ICalendar()
  calendar.addTodo(new VTodo({ uid: 'todo', due: start }))
  calendar.addJournal(new VJournal({ uid: 'journal', start }))
  const availability = new VAvailability()
  availability.addAvailable(new VAvailable({ start }))
  calendar.addAvailability(availability)
  assert.equal(calendar.ics.match(/BEGIN:VTIMEZONE/g)?.length, 1)
  assert.doesNotThrow(() => ICAL.parse(calendar.ics))
})


test('moment boundaries must remain ordered at iCalendar second precision', () => {
  const start = Temporal.Instant.from('2026-09-30T10:00:00.1Z')
  const end = start.add({ milliseconds: 100 })
  assert.throws(() => new VEvent({ uid: 'subseconds', start, end }), /end must be after start/)
  assert.throws(() => new VFreeBusy({ freeBusy: [{ start, end }] }), /end must be after start/)
})


test('first repeated local time keeps TZID and daily recurrences at the same local hour', () => {
  for (const [zone, iso] of [
    ['Europe/Berlin', '2026-10-25T02:30+02:00[Europe/Berlin]'],
    ['America/New_York', '2026-11-01T01:30-04:00[America/New_York]'],
  ]) {
    const start = Temporal.ZonedDateTime.from(iso)
    const inputs = { uid: 'repeated', start, rrule: { freq: 'DAILY' as const, count: 3 } }
    const calendar = new ICalendar()
    calendar.addEvent(new VEvent(inputs))
    const parsed = new ICAL.Component(ICAL.parse(calendar.ics))
    const event = parsed.getFirstSubcomponent('vevent')!
    assert.equal(event.getFirstProperty('dtstart')!.getParameter('tzid'), zone)
    assert.deepEqual(new VEvent(inputs).timezones, [zone])
    assert.equal(parsed.getAllSubcomponents('vtimezone').length, 1)
    ICAL.TimezoneService.register(zone, new ICAL.Timezone({ component: parsed.getFirstSubcomponent('vtimezone')! }))
    try {
      const iterator = new ICAL.Event(event).iterator()
      for (let i = 0; i < 3; i++) {
        const occurrence = iterator.next()!
        const expected = start.add({ days: i })
        assert.equal(occurrence.toString(), expected.toPlainDateTime().toString())
        // ical.js resolves the repeated first local time differently from RFC
        // 5545. Verify its UTC conversion on subsequent, unambiguous days.
        if (i > 0) assert.equal(occurrence.toUnixTime(), Number(expected.epochNanoseconds / 1_000_000_000n))
      }
      assert.equal(iterator.next(), undefined)
    } finally {
      ICAL.TimezoneService.remove(zone)
    }
    for (const Component of [VAvailable, VJournal]) {
      assert.ok(new Component(inputs).ics.includes(`DTSTART;TZID=${zone}:`))
    }
    assert.ok(new VTodo({ uid: inputs.uid, due: start, rrule: inputs.rrule }).ics.includes(`DUE;TZID=${zone}:`))
  }
})

test('second repeated local time stays exact for single events and is rejected for zoned recurrences', () => {
  const start = Temporal.ZonedDateTime.from('2026-10-25T02:30+01:00[Europe/Berlin]')
  const first = start.toInstant().subtract({ hours: 1 }).toZonedDateTimeISO('Europe/Berlin')
  const crossing = new VEvent({ uid: 'repeated-hour', start: first, end: start })
  assert.ok(crossing.ics.includes('DTSTART;TZID=Europe/Berlin:20261025T023000'))
  assert.ok(crossing.ics.includes('DTEND:20261025T013000Z'))
  const crossingParsed = new ICAL.Component(ICAL.parse(crossing.ics))
  const local = (crossingParsed.getFirstPropertyValue('dtstart') as ICAL.Time).toString()
  const emittedStart = Temporal.PlainDateTime.from(local).toZonedDateTime('Europe/Berlin', { disambiguation: 'earlier' })
  const emittedEnd = Temporal.Instant.from((crossingParsed.getFirstPropertyValue('dtend') as ICAL.Time).toString())
  assert.equal(emittedEnd.epochNanoseconds - emittedStart.epochNanoseconds, 3_600_000_000_000n)
  const single = new VEvent({ uid: 'second-occurrence', start })
  assert.ok(single.ics.includes('DTSTART:20261025T013000Z'))
  assert.deepEqual(single.timezones, [])
  for (const Component of [VEvent, VAvailable, VJournal]) {
    assert.throws(() => new Component({ uid: 'second-occurrence', start, rrule: { freq: 'DAILY', count: 160 } }), /second occurrence/)
  }
  assert.throws(() => new VTodo({ uid: 'second-occurrence', due: start, rrule: { freq: 'DAILY' } }), /second occurrence/)
  assert.ok(new VEvent({ uid: 'explicit-utc', start: start.toInstant(), rrule: { freq: 'DAILY', count: 3 } }).ics.includes('DTSTART:20261025T013000Z'))
})

test('zoned daily recurrence retains its local hour across the following spring transition', () => {
  const calendar = new ICalendar()
  calendar.addEvent(new VEvent({
    uid: 'local-series',
    start: Temporal.ZonedDateTime.from('2026-10-25T02:30+02:00[Europe/Berlin]'),
    rrule: { freq: 'DAILY', until: Temporal.Instant.from('2027-03-30T00:00Z') },
  }))
  const parsed = new ICAL.Component(ICAL.parse(calendar.ics))
  ICAL.TimezoneService.register(new ICAL.Timezone(parsed.getFirstSubcomponent('vtimezone')!))
  try {
    const iterator = new ICAL.Event(parsed.getFirstSubcomponent('vevent')!).iterator()
    let found = false
    for (let occurrence = iterator.next(); occurrence; occurrence = iterator.next()) {
      if (occurrence.year === 2027 && occurrence.month === 3 && occurrence.day === 29) {
        assert.equal(occurrence.hour, 2)
        assert.equal(occurrence.minute, 30)
        assert.equal(occurrence.toUnixTime(), Number(Temporal.Instant.from('2027-03-29T00:30Z').epochMilliseconds / 1000))
        found = true
      }
    }
    assert.ok(found)
  } finally {
    ICAL.TimezoneService.reset()
  }
})

test('recurrence validation rejects incompatible UNTIL, conflicting limits and all-day time parts', () => {
  const date = Temporal.PlainDate.from('2026-09-30')
  const instant = Temporal.Instant.from('2026-09-30T10:00Z')
  for (const Component of [VEvent, VJournal, VTodo]) {
    assert.throws(() => new Component({ uid: 'invalid', start: date, due: date, rrule: { freq: 'DAILY', until: instant } }), /same value type/)
    assert.throws(() => new Component({ uid: 'invalid', start: instant, due: instant, rrule: { freq: 'DAILY', until: date } }), /same value type/)
    assert.throws(() => new Component({ uid: 'invalid', start: date, due: date, rrule: { freq: 'DAILY', count: 3, until: date } }), /COUNT and UNTIL/)
    for (const part of ['byhour', 'byminute'] as const) {
      for (const value of [0, 9, [0], [9, 12]]) {
        assert.throws(() => new Component({ uid: 'invalid', start: date, due: date, rrule: { freq: 'DAILY', [part]: value } }), /must not be used with Temporal.PlainDate/)
      }
    }
  }
  assert.throws(() => new VAvailable({ start: instant, rrule: { freq: 'DAILY', until: date } }), /same value type/)
  assert.throws(() => new VAvailable({ start: instant, rrule: { freq: 'DAILY', count: 3, until: instant } }), /COUNT and UNTIL/)
})

test('PlainDate recurrence omits empty hour and minute parts', () => {
  const date = Temporal.PlainDate.from('2026-09-30')
  for (const Component of [VEvent, VJournal, VTodo]) {
    const component = new Component({
      uid: 'all-day-empty-parts', start: date, due: date,
      rrule: { freq: 'DAILY', count: 3, byhour: [], byminute: [] },
    })
    const parsed = new ICAL.Component(ICAL.parse(component.ics))
    const rule = parsed.getFirstPropertyValue('rrule') as ICAL.Recur
    assert.equal(rule.freq, 'DAILY')
    assert.equal(rule.count, 3)
    assert.ok(!component.ics.includes('BYHOUR'))
    assert.ok(!component.ics.includes('BYMINUTE'))
  }
})

test('timed recurrence keeps scalar and array hour and minute parts', () => {
  const instant = Temporal.Instant.from('2026-09-30T00:00Z')
  for (const start of [instant, instant.toZonedDateTimeISO('Europe/Berlin')]) {
    for (const Component of [VEvent, VJournal, VTodo]) {
      for (const value of [0, [0, 9]]) {
        const component = new Component({
          uid: 'timed-time-parts', start, due: start,
          rrule: { freq: 'DAILY', byhour: value, byminute: value },
        })
        const rule = new ICAL.Component(ICAL.parse(component.ics)).getFirstPropertyValue('rrule') as ICAL.Recur
        assert.deepEqual(rule.parts.BYHOUR, Array.isArray(value) ? value : [value])
        assert.deepEqual(rule.parts.BYMINUTE, Array.isArray(value) ? value : [value])
      }
    }
  }
})
