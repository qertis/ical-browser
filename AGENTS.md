# Repository instructions

## Project boundaries

`ical-browser` is a TypeScript library that serializes iCalendar data for browsers and Node.js. Keep changes within that writer role. Parsing `.ics`, calendar queries and integrations, scheduling or recurrence calculations, conflict resolution, and sending or executing notifications are outside the library's scope.

## Implementation and checks

- Preserve browser and Node.js compatibility in runtime changes.
- Keep generated iCalendar data standards-compliant. For changes to runtime code or public APIs, run `npm test` and `npm run build`.
- Treat timezone serialization as compatibility-sensitive. `startTz` and `endTz` use IANA timezones and cause their definitions to be added to the calendar; use `VTimezone` for custom definitions. Check affected timezone output in supported calendar clients when practical.
