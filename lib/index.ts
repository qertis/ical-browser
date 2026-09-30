import { extension } from 'mime-types'
import { tzlib_get_ical_block } from 'timezones-ical-library'
import { isSecondOccurrence, validateRule } from './validate-rule.js'
import type { CalendarDate, CalendarMoment, RelatedTo, Address, Event, Todo, Journal, Alarm, Timezone, Rule, Klass, Transp, Method, Calscale, FreeBusy, FreeBusyPeriod, FreeBusyType, Availability, Available, BusyType, DateListPropertyName } from './types.js'

export type {
  CalendarDate,
  CalendarMoment,
  Action,
  Address,
  Alarm,
  Availability,
  Available,
  BusyType,
  Calscale,
  DateListPropertyName,
  Event,
  EventStatus,
  FreeBusy,
  FreeBusyPeriod,
  FreeBusyType,
  Journal,
  Klass,
  Method,
  RelatedTo,
  RelType,
  Rule,
  RuleDay,
  RuleFreq,
  Timezone,
  Todo,
  TodoStatus,
  Transp,
} from './types.js'

interface IBase {
  readonly ics: string
}

interface ICalendarComponent extends IBase {
  readonly timezones: readonly string[]
}

export enum Day {
  mo = 'MO',
  tu = 'TU',
  we = 'WE',
  th = 'TH',
  fr = 'FR',
  sa = 'SA',
  su = 'SU',
}

const BR = '\r\n'

function asInstant(value: CalendarMoment): Temporal.Instant {
  return Temporal.Instant.fromEpochNanoseconds(value.epochNanoseconds)
}

function compareMoments(start: CalendarMoment, end: CalendarMoment): number {
  // iCalendar DATE-TIME has second precision, so distinct subsecond inputs
  // must not produce equal or inverted boundaries after serialization.
  return Temporal.Instant.compare(
    asInstant(start).round({ smallestUnit: 'second', roundingMode: 'floor' }),
    asInstant(end).round({ smallestUnit: 'second', roundingMode: 'floor' }),
  )
}

function validateEnd(start: CalendarDate, end?: CalendarDate) {
  if (end === undefined) return

  if ((start instanceof Temporal.PlainDate) !== (end instanceof Temporal.PlainDate)) {
    throw new Error('start and end must both be dates or both be moments')
  }
  const comparison = start instanceof Temporal.PlainDate
    ? Temporal.PlainDate.compare(start, end as Temporal.PlainDate)
    : compareMoments(start, end as CalendarMoment)
  if (comparison >= 0) throw new Error('end must be after start')
}

function compactDate(value: Temporal.PlainDate): string {
  return value.toString({ calendarName: 'never' }).replaceAll('-', '')
}

function compactDateTime(value: Temporal.PlainDateTime): string {
  return value.toString({ calendarName: 'never', smallestUnit: 'second' }).replaceAll('-', '').replaceAll(':', '')
}

function dateWithUTCTime(now: CalendarMoment) {
  return compactDateTime(asInstant(now).toZonedDateTimeISO('UTC').toPlainDateTime())
}

function usesLocalTimezone(value: Temporal.ZonedDateTime): boolean {
  if (value.timeZoneId.startsWith('+') || value.timeZoneId.startsWith('-')) {
    return false
  }
  return !isSecondOccurrence(value)
}

function dateTimeProperty(now: CalendarDate) {
  if (now instanceof Temporal.PlainDate) {
    return `;VALUE=DATE:${compactDate(now)}`
  }
  if (now instanceof Temporal.ZonedDateTime) {
    // Fixed offsets and the second occurrence of repeated time need UTC to preserve the selected moment; the first occurrence keeps its TZID
    if (!usesLocalTimezone(now)) {
      return `:${dateWithUTCTime(now)}Z`
    }
    return `;TZID=${now.timeZoneId}:${compactDateTime(now.toPlainDateTime())}`
  }
  return `:${dateWithUTCTime(now)}Z`
}

function dateTimezones(...values: (CalendarDate | undefined)[]): string[] {
  return values.flatMap(value => value instanceof Temporal.ZonedDateTime && usesLocalTimezone(value) ? [value.timeZoneId] : [])
}

function escapeText(value: string) {
  let result = ''

  for (let i = 0; i < value.length; i++) {
    const char = value[i]
    const next = value[i + 1]

    if (char === '\r' || char === '\n') {
      if (char === '\r' && next === '\n') {
        i++
      }
      result += '\\n'
    } else if (char === '\\') {
      result += '\\\\'
    } else if (char === ';' || char === ',') {
      result += '\\' + char
    } else {
      result += char
    }
  }

  return result
}

function createRelatedTo(relatedTo: RelatedTo | RelatedTo[]) {
  const relations = Array.isArray(relatedTo) ? relatedTo : [relatedTo]
  return relations.map(({ uid, reltype }) =>
    folding(`RELATED-TO;RELTYPE=${reltype}:${escapeText(uid)}`),
  )
}

function textListProperty(name: string, values: string[]) {
  return folding(`${name}:${values.map(escapeText).join(',')}`)
}

function dateListProperty(name: DateListPropertyName, dates: CalendarDate[], start?: CalendarDate) {
  if (!dates.length) {
    return ''
  }
  const isDate = (start ?? dates[0]) instanceof Temporal.PlainDate
  for (const date of dates) {
    if ((date instanceof Temporal.PlainDate) !== isDate) {
      throw new Error(`${name} must have the same value type as DTSTART`)
    }
  }
  const values = dates.map(date => date instanceof Temporal.PlainDate ? compactDate(date) : dateWithUTCTime(date) + 'Z')
  return folding(`${name}${isDate ? ';VALUE=DATE' : ''}:${values.join(',')}`)
}

// RFC 5545: lines MUST NOT be longer than 75 octets (bytes), excluding the line break.
function folding(line: string, maxLimit = 75): string {
  line = line.replace(/\r\n|\r|\n/g, '\\n')
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= maxLimit) {
    return line
  }

  const continuationPrefix = ' '
  const continuationLimit = maxLimit - continuationPrefix.length

  let result = ''
  let byteCount = 0
  let currentLimit = maxLimit

  for (let i = 0; i < line.length; ) {
    const cp = line.codePointAt(i)!
    const charWidth = cp > 0xFFFF ? 2 : 1
    const charStr = line.slice(i, i + charWidth)
    const charBytes = encoder.encode(charStr).length

    if (byteCount > 0 && byteCount + charBytes > currentLimit) {
      result += BR + continuationPrefix
      byteCount = continuationPrefix.length
      currentLimit = continuationLimit
    }

    result += charStr
    byteCount += charBytes
    i += charWidth
  }

  return result
}

function createAddressUri(str: string) {
  if (str.startsWith('https://')) {
    return str
  }
  const MAILTO = 'mailto:'

  return str.startsWith(MAILTO) ? str : MAILTO + str
}

function recurrenceRule({
  freq,
  interval,
  count,
  until,
  wkst = 'MO',
  byday,
  byweekno,
  bymonth,
  bymonthday,
  byyearday,
  byhour,
  byminute,
}: Rule) {
  const parts: string[] = []
  const addListPart = (name: string, value: string | number | (string | number)[] | undefined) => {
    if (value === undefined || (Array.isArray(value) && value.length === 0)) {
      return
    }

    parts.push(`${name}=${Array.isArray(value) ? value.join(',') : value}`)
  }

  if (freq) {
    parts.push(`FREQ=${freq}`)
  }
  if (interval) {
    parts.push(`INTERVAL=${interval}`)
  }
  if (count) {
    parts.push(`COUNT=${count}`)
  }
  if (until) {
    parts.push('UNTIL=' + (until instanceof Temporal.PlainDate ? compactDate(until) : dateWithUTCTime(until) + 'Z'))
  }
  if (wkst) {
    parts.push(`WKST=${wkst}`)
  }
  addListPart('BYDAY', byday)
  addListPart('BYWEEKNO', byweekno)
  addListPart('BYMONTH', bymonth)
  addListPart('BYMONTHDAY', bymonthday)
  addListPart('BYYEARDAY', byyearday)
  addListPart('BYHOUR', byhour)
  addListPart('BYMINUTE', byminute)

  return parts.join(';')
}

// RFC 6868 encoding is distinct from escaping TEXT property values
function parameterValue(value: string) {
  const encoded = value.replace(/\^/g, '^^')
    .replace(/\r\n|\r|\n/g, '^n')
    .replace(/"/g, "^'")
  return /[,:;]/.test(encoded) ? `"${encoded}"` : encoded
}

function createOrganizer(organizer: string | Address | Address[]) {
  let str = ''
  if (Array.isArray(organizer)) {
    // todo - поддержать множество организаторов
    for (const address of organizer) {
      let org = 'ORGANIZER;'
      org += 'CN=' + parameterValue(address.name)
      if (address.uri) {
        org += `:${createAddressUri(address.uri)}`
      }
      str += folding(org) + BR
    }
  } else if (typeof organizer === 'object') {
    let org = 'ORGANIZER;'
    org += 'CN=' + parameterValue(organizer.name)
    if (organizer.uri) {
      org += `:${createAddressUri(organizer.uri)}`
    }
    str += folding(org)
  } else {
    str += `ORGANIZER:${organizer}`
  }

  return str
}

function createAttendee(attendee: string | Address | Address[]) {
  let str = ''
  if (Array.isArray(attendee)) {
    for (const address of attendee) {
      let org = 'ATTENDEE;'
      org += 'CN=' + parameterValue(address.name)
      if (address.uri) {
        org += `:${createAddressUri(address.uri)}`
      }
      str += folding(org) + BR
    }
  } else if (typeof attendee === 'object') {
    let org = 'ATTENDEE;'
    org += 'CN=' + parameterValue(attendee.name)
    if (attendee.uri) {
      org += `:${createAddressUri(attendee.uri)}`
    }
    str += folding(org)
  } else {
    str += attendee.includes(':') && !attendee.startsWith('mailto:')
      ? `ATTENDEE;${attendee}`
      : `ATTENDEE:${attendee}`
  }

  return str
}

function createUri(url: URL) {
  return `URL;VALUE=URI:${url.toString()}`
}

function createClass(klass: Klass) {
  return `CLASS:${klass.toUpperCase()}`
}

function createTransp(transp: Transp) {
  return `TRANSP:${transp.toUpperCase()}`
}

function createAttach(base64: string) {
  if (!base64.startsWith('data:')) {
    return `ATTACH;VALUE=URI:${base64}`
  }

  const dataUrl = base64.slice('data:'.length)
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) {
    return `ATTACH;VALUE=URI:${base64}`
  }

  const meta = dataUrl.slice(0, commaIndex)
  const data = dataUrl.slice(commaIndex + 1)
  const [type, ...params] = meta.split(';')
  const isBase64 = params.some(param => param.toUpperCase() === 'BASE64')
  let str = 'ATTACH'
  str += ';FMTTYPE=' + type
  str += ';FILENAME=' + globalThis.crypto.randomUUID() + '.' + extension(type)
  if (isBase64) {
    str += ';ENCODING=BASE64'
    str += ';VALUE=' + 'BINARY'
  }
  str += ':' + data

  return str
}

function validateXProps(xProps?: { [xKey: string]: string }) {
  if (xProps && Object.keys(xProps).some(key => !key.toUpperCase().startsWith('X-'))) {
    throw new Error('xProps keys must start with X-')
  }
}

function validateFreeBusyType(type?: FreeBusyType) {
  if (type && type !== 'FREE' && type !== 'BUSY' && type !== 'BUSY-TENTATIVE' && type !== 'BUSY-UNAVAILABLE') {
    throw new Error('freeBusy period type must be FREE, BUSY, BUSY-TENTATIVE or BUSY-UNAVAILABLE')
  }
}

function validateBusyType(type?: BusyType) {
  if (type && type !== 'BUSY' && type !== 'BUSY-UNAVAILABLE' && type !== 'BUSY-TENTATIVE') {
    throw new Error('busyType must be BUSY, BUSY-UNAVAILABLE or BUSY-TENTATIVE')
  }
}

function validatePriority(priority?: number) {
  if (priority !== undefined && (!Number.isInteger(priority) || priority < 0 || priority > 9)) {
    throw new Error('priority must be a number from 0 to 9')
  }
}

class VBase {
  protected uid: string
  protected stamp: Temporal.Instant

  constructor({ uid, stamp }: { uid?: string, stamp?: Temporal.Instant }) {
    this.uid = uid ?? globalThis.crypto.randomUUID()

    this.stamp = stamp ?? Temporal.Now.instant()
  }
}

export class VEvent extends VBase implements ICalendarComponent {
  #relatedTo?: RelatedTo | RelatedTo[]
  #start: CalendarDate
  #end?: CalendarDate
  #location?: string
  #geo?: number[]
  #summary?: string
  #description?: string
  #status?: string
  #categories?: string[]
  #priority?: number
  #organizer?: string | Address | Address[]
  #attendee?: string | Address | Address[]
  #attach?: string | string[]
  #url?: URL
  #klass?: Klass
  #transp?: Transp
  #sequence?: number
  #rrule?: Rule
  #rdate?: CalendarDate[]
  #exdate?: CalendarDate[]
  #lastModified?: Temporal.Instant
  #alarms: VAlarm[]
  #xProps?: { [xKey: string]: string } = {}

  constructor(data: Event) {
    super(data)
    const {
      location,
      geo,
      summary,
      description,
      start,
      end,
      attach,
      organizer,
      attendee,
      url,
      status,
      categories,
      rrule,
      klass,
      transp,
      sequence,
      priority,
      lastModified,
    } = data

    this.#start = start
    validateEnd(start, end)
    if (data.rdate) {
      dateListProperty('RDATE', data.rdate, start)
      this.#rdate = data.rdate.slice()
    }
    if (data.exdate) {
      dateListProperty('EXDATE', data.exdate, start)
      this.#exdate = data.exdate.slice()
    }
    if (end !== undefined) {
      this.#end = end
    }
    if (location?.length) {
      this.#location = location
    }
    if (geo && Array.isArray(geo)) {
      this.#geo = geo
    }
    if (summary?.length) {
      this.#summary = summary
    }
    if (description?.length) {
      this.#description = description
    }
    if (status?.length) {
      this.#status = status
    }
    if (categories) {
      this.#categories = categories
    }
    if (typeof priority === 'number') {
      this.#priority = priority
    }
    if (organizer) {
      this.#organizer = organizer
    }
    if (attendee) {
      this.#attendee = attendee
    }
    if (attach) {
      this.#attach = attach
    }
    if (url && url instanceof URL) {
      this.#url = url
    }
    if (klass) {
      this.#klass = klass
    }
    if (transp) {
      this.#transp = transp
    }
    if (typeof sequence === 'number') {
      this.#sequence = sequence
    }
    if (rrule) {
      validateRule(rrule, start)
      this.#rrule = rrule
    }
    if (lastModified !== undefined) {
      this.#lastModified = lastModified
    }
    for (const [key, value] of Object.entries(data).filter(([key]) => key.toUpperCase().startsWith('X-'))) {
      this.#xProps![key] = String(value)
    }
    this.#alarms = []
    if (data.relatedTo) {
      this.#relatedTo = data.relatedTo
    }
  }

  addAlarm(alarm: VAlarm) {
    this.#alarms.push(alarm)
  }

  get timezones(): readonly string[] {
    return dateTimezones(this.#start, this.#end)
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VEVENT')
    temp.push(`UID:${this.uid}`)
    temp.push(`DTSTAMP${dateTimeProperty(this.stamp)}`)
    if (this.#lastModified) {
      temp.push(`LAST-MODIFIED${dateTimeProperty(this.#lastModified)}`)
    }
    temp.push(`DTSTART${dateTimeProperty(this.#start)}`)

    if (this.#end !== undefined) {
      temp.push(`DTEND${dateTimeProperty(this.#end)}`)
    }
    if (this.#location) {
      temp.push(folding(`LOCATION:${escapeText(this.#location)}`))
    }
    if (this.#geo) {
      temp.push(`GEO:${this.#geo[0]};${this.#geo[1]}`)
    }
    if (this.#summary) {
      temp.push(folding(`SUMMARY:${escapeText(this.#summary)}`))
    }
    if (this.#description) {
      temp.push(folding(`DESCRIPTION:${escapeText(this.#description)}`))
    }
    if (this.#status) {
      temp.push(`STATUS:${this.#status}`)
    }
    if (this.#categories) {
      temp.push(textListProperty('CATEGORIES', this.#categories))
    }
    if (typeof this.#priority === 'number') {
      temp.push(`PRIORITY:${this.#priority}`)
    }
    if (this.#organizer) {
      temp.push(createOrganizer(this.#organizer))
    }
    if (this.#attendee) {
      temp.push(createAttendee(this.#attendee))
    }
    if (this.#attach) {
      if (Array.isArray(this.#attach)) {
        for (const base64 of this.#attach) {
          temp.push(folding(createAttach(base64)))
        }
      } else {
        temp.push(folding(createAttach(this.#attach)))
      }
    }
    if (this.#url) {
      temp.push(createUri(this.#url))
    }
    if (this.#klass) {
      temp.push(createClass(this.#klass))
    }
    if (this.#transp) {
      temp.push(createTransp(this.#transp))
    }
    if (typeof this.#sequence === 'number') {
      temp.push(`SEQUENCE:${this.#sequence}`)
    }
    if (this.#rrule) {
      temp.push(folding('RRULE:' + recurrenceRule(this.#rrule)))
    }
    if (this.#rdate?.length) temp.push(dateListProperty('RDATE', this.#rdate, this.#start))
    if (this.#exdate?.length) temp.push(dateListProperty('EXDATE', this.#exdate, this.#start))
    for (const key in this.#xProps) {
      temp.push(folding(`${key.toUpperCase()}:${escapeText(this.#xProps[key])}`))
    }
    if (this.#relatedTo) {
      temp.push(...createRelatedTo(this.#relatedTo))
    }
    for (const {ics} of this.#alarms) {
      temp.push(ics)
    }
    temp.push('END:VEVENT')

    return temp.join(BR)
  }
}

export class VAvailable extends VBase implements ICalendarComponent {
  #start: CalendarMoment
  #end?: CalendarMoment
  #duration?: string
  #created?: Temporal.Instant
  #description?: string
  #lastModified?: Temporal.Instant
  #location?: string
  #recurrenceId?: CalendarMoment
  #rrule?: Rule
  #summary?: string
  #categories?: string[]
  #rdate?: CalendarMoment[]
  #exdate?: CalendarMoment[]
  #xProps?: { [xKey: string]: string } = {}

  constructor(data: Available) {
    super(data)
    const {
      start,
      end,
      duration,
      created,
      description,
      lastModified,
      location,
      recurrenceId,
      rrule,
      summary,
      categories,
      rdate,
      exdate,
      xProps,
    } = data

    if (end !== undefined && duration !== undefined) {
      throw new Error('end and duration must not be used together')
    }

    validateXProps(xProps)

    this.#start = start
    validateEnd(start, end)
    if (end !== undefined) {
      this.#end = end
    }
    if (duration) {
      this.#duration = duration
    }
    if (created !== undefined) {
      this.#created = created
    }
    if (description?.length) {
      this.#description = description
    }
    if (lastModified !== undefined) {
      this.#lastModified = lastModified
    }
    if (location?.length) {
      this.#location = location
    }
    if (recurrenceId !== undefined) {
      this.#recurrenceId = recurrenceId
    }
    if (rrule) {
      validateRule(rrule, start)
      this.#rrule = rrule
    }
    if (summary?.length) {
      this.#summary = summary
    }
    if (categories) {
      this.#categories = categories
    }
    if (rdate) {
      dateListProperty('RDATE', rdate, start)
      this.#rdate = rdate.slice()
    }
    if (exdate) {
      dateListProperty('EXDATE', exdate, start)
      this.#exdate = exdate.slice()
    }
    if (xProps) {
      this.#xProps = xProps
    }
  }

  get timezones(): readonly string[] {
    return dateTimezones(this.#start, this.#end, this.#recurrenceId)
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:AVAILABLE')
    temp.push(`UID:${this.uid}`)
    temp.push(`DTSTAMP${dateTimeProperty(this.stamp)}`)
    temp.push(`DTSTART${dateTimeProperty(this.#start)}`)
    if (this.#end !== undefined) {
      temp.push(`DTEND${dateTimeProperty(this.#end)}`)
    }
    if (this.#duration) {
      temp.push(`DURATION:${this.#duration}`)
    }
    if (this.#created) {
      temp.push(`CREATED${dateTimeProperty(this.#created)}`)
    }
    if (this.#description) {
      temp.push(folding(`DESCRIPTION:${escapeText(this.#description)}`))
    }
    if (this.#lastModified) {
      temp.push(`LAST-MODIFIED${dateTimeProperty(this.#lastModified)}`)
    }
    if (this.#location) {
      temp.push(folding(`LOCATION:${escapeText(this.#location)}`))
    }
    if (this.#recurrenceId) {
      temp.push(`RECURRENCE-ID${dateTimeProperty(this.#recurrenceId)}`)
    }
    if (this.#rrule) {
      temp.push(folding('RRULE:' + recurrenceRule(this.#rrule)))
    }
    if (this.#summary) {
      temp.push(folding(`SUMMARY:${escapeText(this.#summary)}`))
    }
    if (this.#categories) {
      temp.push(textListProperty('CATEGORIES', this.#categories))
    }
    if (this.#rdate?.length) {
      temp.push(dateListProperty('RDATE', this.#rdate, this.#start))
    }
    if (this.#exdate?.length) {
      temp.push(dateListProperty('EXDATE', this.#exdate, this.#start))
    }
    for (const key in this.#xProps) {
      temp.push(folding(`${key.toUpperCase()}:${escapeText(this.#xProps[key])}`))
    }
    temp.push('END:AVAILABLE')

    return temp.join(BR)
  }
}

export class VAvailability extends VBase implements ICalendarComponent {
  #start?: CalendarMoment
  #end?: CalendarMoment
  #duration?: string
  #busyType?: BusyType
  #klass?: Klass
  #created?: Temporal.Instant
  #lastModified?: Temporal.Instant
  #location?: string
  #organizer?: string | Address | Address[]
  #priority?: number
  #sequence?: number
  #summary?: string
  #description?: string
  #url?: URL
  #categories?: string[]
  #xProps?: { [xKey: string]: string } = {}
  #available: VAvailable[]

  constructor(data: Availability = {}) {
    super(data)
    const {
      start,
      end,
      duration,
      busyType,
      klass,
      created,
      lastModified,
      location,
      organizer,
      priority,
      sequence,
      summary,
      description,
      url,
      categories,
      xProps,
    } = data

    if (start !== undefined) {
      validateEnd(start, end)
    }
    if (end !== undefined && duration !== undefined) {
      throw new Error('end and duration must not be used together')
    }
    if (duration !== undefined && start === undefined) {
      throw new Error('duration must not be used without start')
    }

    validateBusyType(busyType)
    validatePriority(priority)
    validateXProps(xProps)

    if (start !== undefined) {
      this.#start = start
    }
    if (end !== undefined) {
      this.#end = end
    }
    if (duration) {
      this.#duration = duration
    }
    if (busyType) {
      this.#busyType = busyType
    }
    if (klass) {
      this.#klass = klass
    }
    if (created !== undefined) {
      this.#created = created
    }
    if (lastModified !== undefined) {
      this.#lastModified = lastModified
    }
    if (location?.length) {
      this.#location = location
    }
    if (organizer) {
      this.#organizer = organizer
    }
    if (typeof priority === 'number') {
      this.#priority = priority
    }
    if (typeof sequence === 'number') {
      this.#sequence = sequence
    }
    if (summary?.length) {
      this.#summary = summary
    }
    if (description?.length) {
      this.#description = description
    }
    if (url && url instanceof URL) {
      this.#url = url
    }
    if (categories) {
      this.#categories = categories
    }
    if (xProps) {
      this.#xProps = xProps
    }
    this.#available = []
  }

  addAvailable(available: VAvailable) {
    if (!(available instanceof VAvailable)) {
      throw new Error('available must be an instance of VAvailable')
    }
    this.#available.push(available)
  }

  get timezones(): readonly string[] {
    return [...dateTimezones(this.#start, this.#end), ...this.#available.flatMap(value => value.timezones)]
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VAVAILABILITY')
    temp.push(`UID:${this.uid}`)
    temp.push(`DTSTAMP${dateTimeProperty(this.stamp)}`)
    if (this.#busyType) {
      temp.push(`BUSYTYPE:${this.#busyType}`)
    }
    if (this.#klass) {
      temp.push(createClass(this.#klass))
    }
    if (this.#created) {
      temp.push(`CREATED${dateTimeProperty(this.#created)}`)
    }
    if (this.#description) {
      temp.push(folding(`DESCRIPTION:${escapeText(this.#description)}`))
    }
    if (this.#start) {
      temp.push(`DTSTART${dateTimeProperty(this.#start)}`)
    }
    if (this.#end) {
      temp.push(`DTEND${dateTimeProperty(this.#end)}`)
    }
    if (this.#duration) {
      temp.push(`DURATION:${this.#duration}`)
    }
    if (this.#lastModified) {
      temp.push(`LAST-MODIFIED${dateTimeProperty(this.#lastModified)}`)
    }
    if (this.#location) {
      temp.push(folding(`LOCATION:${escapeText(this.#location)}`))
    }
    if (this.#organizer) {
      temp.push(createOrganizer(this.#organizer))
    }
    if (typeof this.#priority === 'number') {
      temp.push(`PRIORITY:${this.#priority}`)
    }
    if (typeof this.#sequence === 'number') {
      temp.push(`SEQUENCE:${this.#sequence}`)
    }
    if (this.#summary) {
      temp.push(folding(`SUMMARY:${escapeText(this.#summary)}`))
    }
    if (this.#url) {
      temp.push(createUri(this.#url))
    }
    if (this.#categories) {
      temp.push(textListProperty('CATEGORIES', this.#categories))
    }
    for (const key in this.#xProps) {
      temp.push(folding(`${key.toUpperCase()}:${escapeText(this.#xProps[key])}`))
    }
    for (const {ics} of this.#available) {
      temp.push(ics)
    }
    temp.push('END:VAVAILABILITY')

    return temp.join(BR)
  }
}

export class VFreeBusy extends VBase implements IBase {
  #start?: CalendarMoment
  #end?: CalendarMoment
  #organizer?: string | Address | Address[]
  #attendee?: string | Address | Address[]
  #contact?: string | string[]
  #comment?: string | string[]
  #url?: URL | string
  #freeBusy: FreeBusyPeriod[]
  #xProps?: { [xKey: string]: string } = {}

  constructor(data: FreeBusy) {
    super(data)
    const {
      start,
      end,
      organizer,
      attendee,
      contact,
      comment,
      url,
      freeBusy,
      xProps,
    } = data

    if (!freeBusy || freeBusy.length === 0) {
      throw new Error('freeBusy must contain at least one period')
    }


    if (start && end && compareMoments(start, end) >= 0) {
      throw new Error('end must be after start')
    }
    for (const period of freeBusy) {
      this.#validatePeriod(period)
    }
    validateXProps(xProps)

    if (start) {
      this.#start = start
    }
    if (end) {
      this.#end = end
    }
    if (organizer) {
      this.#organizer = organizer
    }
    if (attendee) {
      this.#attendee = attendee
    }
    if (contact) {
      this.#contact = contact
    }
    if (comment) {
      this.#comment = comment
    }
    if (url) {
      this.#url = url
    }
    this.#freeBusy = freeBusy
    if (xProps) {
      this.#xProps = xProps
    }
  }

  #validatePeriod(period: FreeBusyPeriod) {
    if (!period.end && !period.duration) {
      throw new Error('freeBusy period must include either end or duration')
    }
    if (period.end && period.duration) {
      throw new Error('freeBusy period must not include both end and duration')
    }

    if (period.end && compareMoments(period.start, period.end) >= 0) {
      throw new Error('freeBusy period end must be after start')
    }
    validateFreeBusyType(period.type)
  }

  #pushAddress(temp: string[], value: string) {
    for (const line of value.split(BR).filter(Boolean)) {
      temp.push(folding(line))
    }
  }

  #pushText(temp: string[], name: string, value: string | string[]) {
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      temp.push(folding(`${name}:${escapeText(item)}`))
    }
  }

  #freeBusyLine(period: FreeBusyPeriod) {
    const params = period.type ? `;FBTYPE=${period.type}` : ''
    const start = dateWithUTCTime(period.start) + 'Z'
    const end = period.end ? dateWithUTCTime(period.end) + 'Z' : period.duration

    return `FREEBUSY${params}:${start}/${end}`
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VFREEBUSY')
    temp.push(`UID:${this.uid}`)
    temp.push(`DTSTAMP${dateTimeProperty(this.stamp)}`)
    if (this.#start) {
      temp.push(`DTSTART${dateTimeProperty(asInstant(this.#start))}`)
    }
    if (this.#end) {
      temp.push(`DTEND${dateTimeProperty(asInstant(this.#end))}`)
    }
    if (this.#organizer) {
      this.#pushAddress(temp, createOrganizer(this.#organizer))
    }
    if (this.#attendee) {
      this.#pushAddress(temp, createAttendee(this.#attendee))
    }
    if (this.#contact) {
      this.#pushText(temp, 'CONTACT', this.#contact)
    }
    if (this.#comment) {
      this.#pushText(temp, 'COMMENT', this.#comment)
    }
    if (this.#url) {
      temp.push(folding(this.#url instanceof URL ? createUri(this.#url) : `URL:${this.#url}`))
    }
    for (const period of this.#freeBusy) {
      temp.push(folding(this.#freeBusyLine(period)))
    }
    for (const key in this.#xProps) {
      temp.push(folding(`${key.toUpperCase()}:${escapeText(this.#xProps[key])}`))
    }
    temp.push('END:VFREEBUSY')

    return temp.join(BR)
  }
}

export class VTodo extends VBase implements ICalendarComponent {
  #relatedTo?: RelatedTo | RelatedTo[]
  #due?: CalendarDate
  #summary?: string
  #description?: string
  #status?: string
  #priority?: number
  #rrule?: Rule
  #klass?: Klass
  #categories?: string[]
  #alarms: VAlarm[]

  constructor(data: Todo) {
    super(data)
    const {
      due,
      summary,
      description,
      status,
      priority,
      klass,
      categories,
      rrule,
    } = data
    if (due !== undefined) {
      this.#due = due
    }
    if (summary?.length) {
      this.#summary = summary
    }
    if (description?.length) {
      this.#description = description
    }
    if (categories) {
      this.#categories = categories
    }
    if (status?.length) {
      this.#status = status
    }
    if (klass) {
      this.#klass = klass
    }
    if (typeof priority === 'number') {
      this.#priority = priority
    }
    if (rrule) {
      validateRule(rrule, due)
      this.#rrule = rrule
    }
    if (data.relatedTo) {
      this.#relatedTo = data.relatedTo
    }
    this.#alarms = []
  }

  addAlarm(alarm: VAlarm) {
    this.#alarms.push(alarm)
  }

  get timezones(): readonly string[] {
    return dateTimezones(this.#due)
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VTODO')
    temp.push('UID:' + this.uid)
    temp.push(`DTSTAMP${dateTimeProperty(this.stamp)}`)
    if (this.#due) {
      temp.push(`DUE${dateTimeProperty(this.#due)}`)
    }
    if (this.#summary) {
      temp.push(folding(`SUMMARY:${escapeText(this.#summary)}`))
    }
    if (this.#klass) {
      temp.push(createClass(this.#klass))
    }
    if (this.#categories) {
      temp.push(textListProperty('CATEGORIES', this.#categories))
    }
    if (this.#description) {
      temp.push(folding(`DESCRIPTION:${escapeText(this.#description)}`))
    }
    if (typeof this.#priority === 'number') {
      temp.push('PRIORITY:' + String(this.#priority))
    }
    if (this.#status) {
      temp.push('STATUS:' + this.#status)
    }
    if (this.#rrule) {
      temp.push(folding('RRULE:' + recurrenceRule(this.#rrule)))
    }
    if (this.#relatedTo) {
      temp.push(...createRelatedTo(this.#relatedTo))
    }
    for (const {ics} of this.#alarms) {
      temp.push(ics)
    }
    temp.push('END:VTODO')

    return temp.join(BR)
  }
}

export class VJournal extends VBase implements ICalendarComponent {
  #relatedTo?: RelatedTo | RelatedTo[]
  #start?: CalendarDate
  #summary?: string
  #description?: string
  #rrule?: Rule

  constructor(data: Journal) {
    super(data)
    const {
      start,
      summary,
      description,
      rrule,
    } = data
    if (start !== undefined) {
      this.#start = start
    }
    if (summary?.length) {
      this.#summary = summary
    }
    if (description?.length) {
      this.#description = description
    }
    if (rrule) {
      validateRule(rrule, start)
      this.#rrule = rrule
    }
    if (data.relatedTo) {
      this.#relatedTo = data.relatedTo
    }
  }

  get timezones(): readonly string[] {
    return dateTimezones(this.#start)
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VJOURNAL')
    temp.push(`UID:${this.uid}`)
    if (this.stamp) {
      temp.push(`DTSTAMP${dateTimeProperty(this.stamp)}`)
    }
    if (this.#start) {
      temp.push(`DTSTART${dateTimeProperty(this.#start)}`)
    }
    if (this.#summary) {
      temp.push(folding(`SUMMARY:${escapeText(this.#summary)}`))
    }
    if (this.#description) {
      temp.push(folding(`DESCRIPTION:${escapeText(this.#description)}`))
    }
    if (this.#rrule) {
      temp.push(folding('RRULE:' + recurrenceRule(this.#rrule)))
    }
    if (this.#relatedTo) {
      temp.push(...createRelatedTo(this.#relatedTo))
    }
    temp.push('END:VJOURNAL')

    return temp.join(BR)
  }
}

export class VAlarm implements IBase {
  #action: string
  #trigger: string
  #description?: string
  #summary?: string
  #attach?: string | string[]
  #attendee?: string | Address | Address[]
  #duration?: string
  #repeat?: number
  #xProps?: { [xKey: string]: string } = {}

  constructor(data: Alarm) {
    const { action, description, trigger, attach, attendee, summary, duration, repeat, xProps } = data
    const normalizedAction = action?.toUpperCase()
    if (!action) {
      throw new Error('action is required')
    }
    if (!trigger) {
      throw new Error('trigger is required')
    }
    if ((duration && repeat === undefined) || (!duration && repeat !== undefined)) {
      throw new Error('duration and repeat must be used together')
    }
    validateXProps(xProps)

    switch (normalizedAction) {
      case 'DISPLAY': {
        if (!description) {
          throw new Error('description is required for DISPLAY alarm')
        }
        if (attach) {
          throw new Error('attach is not allowed for DISPLAY alarm')
        }
        if (attendee) {
          throw new Error('attendee is not allowed for DISPLAY alarm')
        }
        if (summary) {
          throw new Error('summary is not allowed for DISPLAY alarm')
        }
        break
      }
      case 'AUDIO': {
        if (description) {
          throw new Error('description is not allowed for AUDIO alarm')
        }
        if (summary) {
          throw new Error('summary is not allowed for AUDIO alarm')
        }
        if (attendee) {
          throw new Error('attendee is not allowed for AUDIO alarm')
        }
        if (Array.isArray(attach)) {
          throw new Error('AUDIO alarm supports at most one attach')
        }
        break
      }
      case 'EMAIL': {
        if (!description) {
          throw new Error('description is required for EMAIL alarm')
        }
        if (!summary) {
          throw new Error('summary is required for EMAIL alarm')
        }
        if (!attendee || (Array.isArray(attendee) && attendee.length === 0)) {
          throw new Error('at least one attendee is required for EMAIL alarm')
        }
        break
      }
      default:
        throw new Error(`unsupported alarm action: ${action}`)
    }

    this.#action = normalizedAction
    this.#trigger = trigger
    if (description) {
      this.#description = description
    }
    if (summary) {
      this.#summary = summary
    }
    if (attach) {
      this.#attach = attach
    }
    if (attendee) {
      this.#attendee = attendee
    }
    if (duration) {
      this.#duration = duration
    }
    if (repeat !== undefined) {
      this.#repeat = repeat
    }
    if (xProps) {
      this.#xProps = xProps
    }
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VALARM')
    if (this.#trigger.includes(':')) {
      temp.push(`TRIGGER;${this.#trigger}`)
    } else {
      temp.push(`TRIGGER:${this.#trigger}`)
    }
    temp.push(`ACTION:${this.#action}`)

    if (this.#description) {
      temp.push(folding(`DESCRIPTION:${escapeText(this.#description)}`))
    }
    if (this.#summary) {
      temp.push(folding(`SUMMARY:${escapeText(this.#summary)}`))
    }
    if (this.#attendee) {
      if (Array.isArray(this.#attendee)) {
        for (const attendee of this.#attendee) {
          temp.push(createAttendee(attendee))
        }
      } else {
        temp.push(createAttendee(this.#attendee))
      }
    }
    if (this.#attach) {
      if (Array.isArray(this.#attach)) {
        for (const attach of this.#attach) {
          temp.push(folding(createAttach(attach)))
        }
      } else {
        temp.push(folding(createAttach(this.#attach)))
      }
    }
    if (this.#duration) {
      temp.push(`DURATION:${this.#duration}`)
    }
    if (this.#repeat !== undefined) {
      temp.push(`REPEAT:${this.#repeat}`)
    }
    for (const key in this.#xProps) {
      temp.push(folding(`${key.toUpperCase()}:${escapeText(this.#xProps[key])}`))
    }
    temp.push('END:VALARM')

    return temp.join(BR)
  }
}

export class VTimezone implements ICalendarComponent {
  #tzid: string // Russian Standard Time
  #standard: Timezone | null
  #daylight: Timezone | null

  constructor({ tzid }: { tzid: string }) {
    this.#tzid = tzid
    this.#standard = null
    this.#daylight = null
  }

  addStandard({ start, tzOffsetFrom, tzOffsetTo, tzname }: Timezone) {
    this.#standard = {
      start,
      tzOffsetFrom,
      tzOffsetTo,
      tzname,
    }
  }

  addDaylight({ start, tzOffsetFrom, tzOffsetTo, tzname }: Timezone) {
    this.#daylight = {
      start,
      tzOffsetFrom,
      tzOffsetTo,
      tzname,
    }
  }

  get timezones(): readonly string[] {
    return [this.#tzid]
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VTIMEZONE')
    temp.push('TZID:' + this.#tzid)

    if (this.#standard) {
      temp.push('BEGIN:STANDARD')
      temp.push(`DTSTART:${compactDateTime(this.#standard.start)}`)
      temp.push(`TZOFFSETFROM:${this.#standard.tzOffsetFrom}`)
      temp.push(`TZOFFSETTO:${this.#standard.tzOffsetTo}`)
      temp.push(folding(`TZNAME:${escapeText(this.#standard.tzname)}`))
      temp.push('END:STANDARD')
    }
    if (this.#daylight) {
      temp.push('BEGIN:DAYLIGHT')
      temp.push(`DTSTART:${compactDateTime(this.#daylight.start)}`)
      temp.push(`TZOFFSETFROM:${this.#daylight.tzOffsetFrom}`)
      temp.push(`TZOFFSETTO:${this.#daylight.tzOffsetTo}`)
      temp.push(folding(`TZNAME:${escapeText(this.#daylight.tzname)}`))
      temp.push('END:DAYLIGHT')
    }
    temp.push('END:VTIMEZONE')

    return temp.join(BR)
  }
}

export default class ICalendar {
  #events: VEvent[]
  #todos: VTodo[]
  #journals: VJournal[]
  #timezones: VTimezone[]
  #availabilities: VAvailability[]
  #freeBusy: VFreeBusy[]

  #prodId: string
  #calscale: string
  #method: string

  constructor({
    id,
    method = 'PUBLISH',
    calscale = 'GREGORIAN',
  }: {
    id: string,
    method?: Method,
    calscale?: Calscale
  } = {
    id: '-//ical-browser//EN',
    method: 'PUBLISH',
    calscale: 'GREGORIAN'
  } ) {
    if (!id) {
      throw new Error('prodId is required')
    }
    this.#prodId = id
    this.#calscale = calscale
    this.#method = method
    this.#events = []
    this.#todos = []
    this.#journals = []
    this.#timezones = []
    this.#availabilities = []
    this.#freeBusy = []
  }

  addEvent(event: VEvent) {
    this.#events.push(event)
  }

  addTodo(todo: VTodo) {
    this.#todos.push(todo)
  }

  addJournal(journal: VJournal) {
    this.#journals.push(journal)
  }

  addTimezone(timezone: VTimezone) {
    this.#timezones.push(timezone)
  }

  addAvailability(availability: VAvailability) {
    if (!(availability instanceof VAvailability)) {
      throw new Error('availability must be an instance of VAvailability')
    }
    this.#availabilities.push(availability)
  }

  addFreeBusy(freeBusy: VFreeBusy) {
    if (!(freeBusy instanceof VFreeBusy)) {
      throw new Error('freeBusy must be an instance of VFreeBusy')
    }
    this.#freeBusy.push(freeBusy)
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VCALENDAR')
    temp.push('VERSION:2.0')
    temp.push(`PRODID:${this.#prodId}`)
    temp.push(`CALSCALE:${this.#calscale}`)
    temp.push(`METHOD:${this.#method}`)
    const manualTimezones = new Set(
      this.#timezones.flatMap(timezone => timezone.timezones),
     )
    for (const {ics} of this.#timezones) {
      temp.push(ics)
    }
    const timezoneIds = new Set(
      [...this.#events, ...this.#todos, ...this.#journals, ...this.#availabilities].flatMap(component => component.timezones),
    )
    for (const tzid of timezoneIds) {
      if (!manualTimezones.has(tzid)) {
        const block = tzlib_get_ical_block(tzid)?.[0]
        if (!block) throw new Error(`No automatic VTIMEZONE definition for ${tzid}; add a VTimezone manually`)
        temp.push(block)
      }
    }
    for (const {ics} of this.#availabilities) {
      temp.push(ics)
    }
    for (const {ics} of this.#freeBusy) {
      temp.push(ics)
    }
    for (const {ics} of this.#events) {
      temp.push(ics)
    }
    for (const {ics} of this.#todos) {
      temp.push(ics)
    }
    for (const {ics} of this.#journals) {
      temp.push(ics)
    }
    temp.push('END:VCALENDAR')

    return temp.join(BR)
  }

  download(filename: string) {
    return new File([new TextEncoder().encode(this.ics)], filename, {
      type: 'text/calendar',
    })
  }
}
