### Installation
```bash
npm install ical-browser
```

### Quick Start
```js
import { event as createEvent, default as ical } from 'ical-browser'
const myEvent = createEvent({
  id: 'c7614cff-3560-4a00-9152-d25cc1fe077d',
  summary: 'Event Title',
  description: 'My event',
  start: new Date(),
})
const file = ical('id', 'calendar', myEvent)
```

### DEMO
https://codepen.io/qertis/full/RweggQJ

### Copyright and license
Copyright (c) Denis Baskovsky under the MIT license.
