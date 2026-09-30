import type { CalendarDate, Rule } from './types.js'

export function isSecondOccurrence(value: Temporal.ZonedDateTime): boolean {
  // RFC 5545 resolves an ambiguous local date-time to its first occurrence.
  return value.toPlainDateTime().toZonedDateTime(value.timeZoneId, { disambiguation: 'earlier' }).epochNanoseconds !== value.epochNanoseconds
}

export function validateRule(rule: Rule, start?: CalendarDate): void {
  if (rule.count !== undefined && rule.until !== undefined) {
    throw new Error('COUNT and UNTIL must not be used together')
  }
  if (rule.until !== undefined && start !== undefined &&
      (start instanceof Temporal.PlainDate) !== (rule.until instanceof Temporal.PlainDate)) {
    throw new Error('UNTIL must have the same value type as DTSTART')
  }
  if (start instanceof Temporal.PlainDate) {
    for (const part of ['byhour', 'byminute'] as const) {
      const value = rule[part]
      if (Array.isArray(value) ? value.length > 0 : value !== undefined) {
        throw new Error(`${part.toUpperCase()} must not be used with Temporal.PlainDate`)
      }
    }
  }
  if (start instanceof Temporal.ZonedDateTime && isSecondOccurrence(start)) {
    throw new Error('RRULE cannot represent the second occurrence of repeated local time with TZID; use the first occurrence or explicitly pass Temporal.Instant for a UTC recurrence')
  }
}
