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
  start: new Date('2026-07-01T10:00:00Z'),
  end: new Date('2026-07-01T11:00:00Z'),
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
    start: new Date('2026-07-01T15:00:00Z'),
    end: new Date('2026-07-01T16:00:00Z'),
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
  start: new Date('2026-07-01T10:00:00Z'),
  end: new Date('2026-07-01T11:00:00Z'),
}))

writeFileSync('calendar.ics', calendar.ics)
```

In Node.js, use `calendar.ics` and write the string to a file or HTTP response.

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
  start: new Date('2026-07-01T10:00:00Z'),
  end: new Date('2026-07-01T11:00:00Z'),
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
  due: new Date('2026-07-01T09:00:00Z'),
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
  start: new Date('2026-07-01T09:00:00Z'),
})

calendar.addJournal(journal)
```

### Timezone

```ts
import ICalendar, { VTimezone } from 'ical-browser'

const calendar = new ICalendar()
const timezone = new VTimezone({ tzid: 'Europe/Berlin' })

timezone.addStandard({
  start: new Date('2026-10-25T03:00:00Z'),
  tzOffsetFrom: '+0200',
  tzOffsetTo: '+0100',
  tzname: 'CET',
})
timezone.addDaylight({
  start: new Date('2026-03-29T02:00:00Z'),
  tzOffsetFrom: '+0100',
  tzOffsetTo: '+0200',
  tzname: 'CEST',
})

calendar.addTimezone(timezone)
```

Use `startTz` and `endTz` on events when you want `TZID` date-time properties:

```ts
const event = new VEvent({
  uid: 'berlin-meeting@example.com',
  summary: 'Berlin meeting',
  start: new Date('2026-07-01T10:00:00Z'),
  startTz: 'Europe/Berlin',
  end: new Date('2026-07-01T11:00:00Z'),
  endTz: 'Europe/Berlin',
})
```

### Alarm

```ts
import { VAlarm, VEvent } from 'ical-browser'

const event = new VEvent({
  uid: 'meeting@example.com',
  summary: 'Meeting',
  start: new Date('2026-07-01T10:00:00Z'),
  end: new Date('2026-07-01T11:00:00Z'),
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
      start: new Date('2026-07-01T09:00:00Z'),
      end: new Date('2026-07-01T11:00:00Z'),
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
  start: new Date('2026-07-06T09:00:00Z'),
  end: new Date('2026-07-06T17:00:00Z'),
  summary: 'Monday working hours',
}))

calendar.addAvailability(availability)
```

## Timezone notes

Use UTC dates when possible.

Timezone handling is one of the most compatibility-sensitive parts of iCalendar. When exporting local times, make sure your calendar includes the required timezone information and test the generated `.ics` file in target calendar clients.

The event API supports `startTz` and `endTz` for `TZID` parameters. `VTimezone` can be added to the calendar with `addStandard(...)` and `addDaylight(...)` definitions.

## Compatibility notes

Generated `.ics` files should be tested in the calendar clients you support, such as Google Calendar, Apple Calendar, Outlook, and Thunderbird.

Calendar clients may interpret advanced iCalendar features differently.

## What this library does not do

`ical-browser` is a writer, not a calendar engine.

It does not:

- parse `.ics` files;
- calculate available time slots;
- expand recurring events;
- merge busy intervals;
- query external calendars;
- provide CalDAV integration;
- send emails;
- execute alarms;
- show notifications;
- resolve booking conflicts.

## Development

```bash
npm install
npm run build
npm test
```

## License

Copyright (c) Denis Baskovsky under the MIT license.
