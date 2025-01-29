# ical-browser
> Working in the Browser and Node.js

[![https://codepen.io/qertis/full/RweggQJ](https://img.shields.io/badge/demo-grey?style=for-the-badge&logo=codepen)](https://codepen.io/qertis/full/RweggQJ)

## Installation

```bash
npm install ical-browser
```

## Example

```js
import {
  VEvent,
  default as ICalendar,
} from 'ical-browser'

const vevent = new VEvent({
  uid: 'c7614cff-3560-4a00-9152-d25cc1fe077d',
  summary: 'Event Title',
  description: 'My event',
  start: new Date(),
})
const calendar = new ICalendar()
calendar.addEvent(vevent)
calendar.download('calendar.ics')
```

## Copyright and license

Copyright (c) Denis Baskovsky under the MIT license.
