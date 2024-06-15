# ical-browser

## Installation

```bash
npm install ical-browser
```

## DEMO
https://codepen.io/qertis/full/RweggQJ

## Quick Start

```js
import { event as createEvent, default as ical } from 'ical-browser'
const myEvent = createEvent({
  id: 'c7614cff-3560-4a00-9152-d25cc1fe077d',
  summary: 'Event Title',
  description: 'My event',
  start: new Date(),
})
const str = ical('id', myEvent)
const file = new File([new TextEncoder().encode(str)], 'calendar.ics', {
  type: 'text/calendar',
})
```

## Copyright and license

Copyright (c) Denis Baskovsky under the MIT license.
