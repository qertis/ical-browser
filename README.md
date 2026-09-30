# ical-browser

ical-browser is a lightweight TypeScript iCalendar writer for apps that need a simple "Add to calendar" or "Download invite" button.

[![https://codepen.io/qertis/full/RweggQJ](https://img.shields.io/badge/demo-grey?style=for-the-badge&logo=codepen)](https://codepen.io/qertis/full/RweggQJ)

## Features

- Works in the browser and Node.js
- TypeScript-first API
- Generates `.ics` calendar text
- Browser `File` helper for downloads
- Supports common iCalendar components
- Supports text escaping and line folding where implemented
- Lightweight writer-only design

## Installation

```bash
npm install ical-browser
```

## Quick start: Add to calendar button

```ts
import ICalendar, { VEvent } from 'ical-browser'

const calendar = new ICalendar()
calendar.addEvent(new VEvent({
  uid: 'event-1@example.com',
  summary: 'Project meeting',
  description: 'Weekly project sync',
  start: Temporal.Instant.from('2026-07-01T10:00:00Z'),
  end: Temporal.Instant.from('2026-07-01T11:00:00Z'),
}))

const file = calendar.download('project-meeting.ics')
const url = URL.createObjectURL(file)
const link = document.createElement('a')
link.href = url
link.download = file.name
link.click()
URL.revokeObjectURL(url)
```

`download(...)` creates a `text/calendar` `.ics` `File`. In the browser, use it with `URL.createObjectURL(...)` to trigger a download.

## Browser usage

```ts
import ICalendar, { VEvent } from 'ical-browser'

function downloadInvite() {
  const calendar = new ICalendar()
  calendar.addEvent(new VEvent({
    uid: 'product-demo@example.com',
    summary: 'Product demo',
    description: 'Live product walkthrough',
    start: Temporal.Instant.from('2026-07-01T15:00:00Z'),
    end: Temporal.Instant.from('2026-07-01T16:00:00Z'),
  }))

  const file = calendar.download('product-demo.ics')
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
}
```

## Node.js usage

```ts
import { writeFileSync } from 'node:fs'
import ICalendar, { VEvent } from 'ical-browser'

const calendar = new ICalendar()
calendar.addEvent(new VEvent({
  uid: 'node-event@example.com',
  summary: 'Node.js generated event',
  start: Temporal.Instant.from('2026-07-01T10:00:00Z'),
  end: Temporal.Instant.from('2026-07-01T11:00:00Z'),
}))

writeFileSync('calendar.ics', calendar.ics)
```

In Node.js, use `calendar.ics` and write the string to a file or HTTP response.

## Temporal API

Requires Node.js 26+ or a browser with native `Temporal`. No polyfill is included.
TypeScript consumers need TypeScript 6+ for the Temporal declarations.

All date fields use native Temporal types.

| Input | iCalendar output |
|---|---|
| `Temporal.PlainDate` | `VALUE=DATE`, for all-day events |
| `Temporal.Instant` | UTC date-time with `Z` |
| `Temporal.ZonedDateTime` | Local date-time with `TZID` and an automatic `VTIMEZONE` |

Subsecond precision is truncated to seconds.
Named timezones retain `TZID`, including the first occurrence of a repeated local time during an autumn DST transition. This keeps recurrence instances at the same local time. iCalendar interprets an ambiguous local time as its first occurrence. A zoned `RRULE` start at the second occurrence is rejected rather than changing the series to UTC. Choose the first occurrence for a local-time recurrence, or explicitly pass `start.toInstant()` for a UTC recurrence. Single-event boundaries at the second occurrence and fixed-offset values are emitted in UTC to preserve their exact moments.

Recurrence validation rejects `COUNT` together with `UNTIL`, a mismatched DATE/DATE-TIME `UNTIL`, and nonempty `BYHOUR` or `BYMINUTE` for all-day events. It also rejects a zoned recurrence start at the second occurrence of repeated local time. The library does not expand recurrences or calculate their occurrences. Numeric ranges and other RFC rule combinations remain the caller's responsibility.

### Migrating from 0.2.x

Replace `Date` inputs with `Temporal.Instant`, or with `Temporal.PlainDate` for all-day values. Replace `startTz` and `endTz` by converting each instant with `.toZonedDateTimeISO(timeZoneId)`. These removed fields are forbidden by the `Event` type. Extension fields on events must start with `X-` (case-insensitive); arbitrary extra fields are no longer accepted in object literals.

Use `Temporal.Instant` for `stamp`, `created`, and `lastModified`, and `Temporal.PlainDateTime` for custom timezone observance starts. The package requires Node.js 26+, TypeScript 6+, or a browser with native Temporal support; it does not include a polyfill.

`stamp`, `created`, and `lastModified` accept `Temporal.Instant`. Availability and free/busy boundaries accept only `Instant` or `ZonedDateTime`; free/busy is emitted in UTC. Custom timezone observance starts accept `Temporal.PlainDateTime`, representing local wall-clock time.

### All-day events

```ts
const event = new VEvent({
  uid: 'holiday@example.com',
  summary: 'Holiday',
  start: Temporal.PlainDate.from('2026-09-30'),
  end: Temporal.PlainDate.from('2026-10-01'),
})
```

`end` is exclusive: this event covers September 30 only. Omitting `end` for a `PlainDate` creates a one-day event. Both boundaries must be dates or both must be moments; an explicit end must follow the start. Plain dates are independent of the host timezone and DST.

### Recurrence dates and exclusions

```ts
const event = new VEvent({
  uid: 'daily@example.com',
  start: Temporal.PlainDate.from('2026-09-30'),
  rrule: { freq: 'DAILY', until: Temporal.PlainDate.from('2026-10-10') },
  rdate: [Temporal.PlainDate.from('2026-10-12')],
  exdate: [Temporal.PlainDate.from('2026-10-03')],
})
```

`UNTIL` is inclusive and cannot be combined with `COUNT`. `until`, `rdate`, and `exdate` must match the date versus date-time type of `start`. Timed recurrence dates and `UNTIL` are emitted in UTC, including inputs supplied as `ZonedDateTime`. Empty lists are omitted. `EXDATE` identifies the start of an excluded occurrence. `RDATE` can be used without `RRULE`; exclusions take precedence when interpreted by a calendar client. The library writes these properties without expanding or calculating recurrences.

For `PlainDate`, `byhour` and `byminute` must be omitted or empty arrays. Scalar values (including zero) and nonempty arrays are rejected. These parts remain available for timed recurrences.

## Supported components

| Component | Class | Status | Notes |
|---|---|---:|---|
| `VCALENDAR` | `ICalendar` | Supported | Root calendar component |
| `VEVENT` | `VEvent` | Supported | Calendar events |
| `VTODO` | `VTodo` | Supported | Todo items |
| `VJOURNAL` | `VJournal` | Supported | Journal entries |
| `VTIMEZONE` | `VTimezone` | Supported | Timezone definitions with standard/daylight blocks |
| `VALARM` | `VAlarm` | Supported | Nested alarms for events and todos |
| `VFREEBUSY` | `VFreeBusy` | Supported | Serializes known free/busy periods |
| `VAVAILABILITY` | `VAvailability`, `VAvailable` | Supported | Serializes availability blocks |

## Examples

### Event

```ts
import ICalendar, { VEvent } from 'ical-browser'

const calendar = new ICalendar()
const event = new VEvent({
  uid: 'event-1@example.com',
  summary: 'Team meeting',
  description: 'Discuss project status',
  start: Temporal.Instant.from('2026-07-01T10:00:00Z'),
  end: Temporal.Instant.from('2026-07-01T11:00:00Z'),
})

calendar.addEvent(event)
```

### Todo

```ts
import ICalendar, { VTodo } from 'ical-browser'

const calendar = new ICalendar()
const todo = new VTodo({
  uid: 'todo-1@example.com',
  summary: 'Prepare report',
  description: 'Prepare monthly report',
  due: Temporal.Instant.from('2026-07-01T09:00:00Z'),
})

calendar.addTodo(todo)
```

### Journal

```ts
import ICalendar, { VJournal } from 'ical-browser'

const calendar = new ICalendar()
const journal = new VJournal({
  uid: 'journal-1@example.com',
  summary: 'Daily note',
  description: 'Project notes',
  start: Temporal.Instant.from('2026-07-01T09:00:00Z'),
})

calendar.addJournal(journal)
```

### Timezone

```ts
import ICalendar, { VTimezone } from 'ical-browser'

const calendar = new ICalendar()
const timezone = new VTimezone({ tzid: 'Europe/Berlin' })

timezone.addStandard({
  start: Temporal.PlainDateTime.from('2026-10-25T03:00:00'),
  tzOffsetFrom: '+0200',
  tzOffsetTo: '+0100',
  tzname: 'CET',
})
timezone.addDaylight({
  start: Temporal.PlainDateTime.from('2026-03-29T02:00:00'),
  tzOffsetFrom: '+0100',
  tzOffsetTo: '+0200',
  tzname: 'CEST',
})

calendar.addTimezone(timezone)
```

Use `Temporal.ZonedDateTime` when you want `TZID` date-time properties:

```ts
const event = new VEvent({
  uid: 'berlin-meeting@example.com',
  summary: 'Berlin meeting',
  start: Temporal.Instant.from('2026-07-01T10:00:00Z').toZonedDateTimeISO('Europe/Berlin'),
  end: Temporal.Instant.from('2026-07-01T11:00:00Z').toZonedDateTimeISO('Europe/Berlin'),
})
```

### Alarm

```ts
import { VAlarm, VEvent } from 'ical-browser'

const event = new VEvent({
  uid: 'meeting@example.com',
  summary: 'Meeting',
  start: Temporal.Instant.from('2026-07-01T10:00:00Z'),
  end: Temporal.Instant.from('2026-07-01T11:00:00Z'),
})

event.addAlarm(new VAlarm({
  action: 'DISPLAY',
  trigger: '-PT15M',
  description: 'Meeting starts in 15 minutes',
}))
```

`VALARM` is serialized inside components that support alarms. It is not a top-level `VCALENDAR` component. Events and todos support `addAlarm(...)`.

Supported alarm actions are `DISPLAY`, `AUDIO`, and `EMAIL`. `DURATION` and `REPEAT` must be provided together when an alarm repeats.

### Free/busy

```ts
import ICalendar, { VFreeBusy } from 'ical-browser'

const calendar = new ICalendar()
const freeBusy = new VFreeBusy({
  uid: 'free-busy-1@example.com',
  organizer: 'mailto:user@example.com',
  freeBusy: [
    {
      start: Temporal.Instant.from('2026-07-01T09:00:00Z'),
      end: Temporal.Instant.from('2026-07-01T11:00:00Z'),
      type: 'BUSY',
    },
  ],
})

calendar.addFreeBusy(freeBusy)
```

### Availability

```ts
import ICalendar, { VAvailability, VAvailable } from 'ical-browser'

const calendar = new ICalendar()
const availability = new VAvailability({
  uid: 'availability@example.com',
  summary: 'Working hours',
  busyType: 'BUSY-UNAVAILABLE',
})

availability.addAvailable(new VAvailable({
  uid: 'available-1@example.com',
  start: Temporal.Instant.from('2026-07-06T09:00:00Z'),
  end: Temporal.Instant.from('2026-07-06T17:00:00Z'),
  summary: 'Monday working hours',
}))

calendar.addAvailability(availability)
```

## License

Copyright (c) Denis Baskovsky under the MIT license.
