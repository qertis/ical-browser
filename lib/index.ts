import { extension } from 'mime-types'
import type { Address, Event, Todo, Journal, Alarm, Timezone, Rule, Klass, Transp, Method, Calscale } from './types'
import { IBase } from './interfaces'

const BR = '\r\n'

function padTimePart(value: number) {
  return value.toString().padStart(2, '0')
}

function dateTimeFromParts({
  year,
  month,
  day,
  hours,
  minutes,
  seconds,
}: {
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  seconds: number,
}) {
  return `${year}${padTimePart(month)}${padTimePart(day)}T${padTimePart(hours)}${padTimePart(minutes)}${padTimePart(seconds)}`
}

function dateWithUTCTime(now: Date) {
  return dateTimeFromParts({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
    hours: now.getUTCHours(),
    minutes: now.getUTCMinutes(),
    seconds: now.getUTCSeconds(),
  }) + 'Z'
}

function dateWithTimeZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const byType = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return `${byType.year}${byType.month}${byType.day}T${byType.hour}${byType.minute}${byType.second}`
}

function dateWithFloatingTime(now: Date) {
  return dateTimeFromParts({
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
    hours: now.getUTCHours(),
    minutes: now.getUTCMinutes(),
    seconds: now.getUTCSeconds(),
  })
}

function dateTimeProperty(now: Date, timezone?: string) {
  const value = timezone ? dateWithTimeZone(now, timezone) : dateWithUTCTime(now)

  return timezone ? `;TZID=${timezone}:${value}` : `:${value}`
}

function floatingDateTimeProperty(now: Date) {
  return ':' + dateWithFloatingTime(now)
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
      if (next && ['n', 'N', ';', ',', '\\'].includes(next)) {
        result += char + next
        i++
      } else {
        result += '\\\\'
      }
    } else if (char === ';' || char === ',') {
      result += '\\' + char
    } else {
      result += char
    }
  }

  return result
}

function textProperty(name: string, value: string) {
  return folding(`${name}:${escapeText(value)}`)
}

function textListProperty(name: string, values: string[]) {
  return folding(`${name}:${values.map(escapeText).join(',')}`)
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
  bymonthday,
  byyearday,
}: Rule) {
  const parts: string[] = []
  if (freq) {
    parts.push('FREQ=' + freq)
  }
  if (interval) {
    parts.push('INTERVAL=' + interval)
  }
  if (count) {
    parts.push('COUNT=' + count)
  }
  if (until) {
    parts.push('UNTIL=' + dateWithUTCTime(until))
  }
  if (wkst) {
    parts.push('WKST=' + wkst)
  }
  if (byday) {
    if (Array.isArray(byday)) {
      parts.push('BYDAY=' + byday.join(','))
    } else {
      parts.push('BYDAY=' + byday)
    }
  }
  if (byweekno) {
    if (Array.isArray(byweekno)) {
      parts.push('BYWEEKNO=' + byweekno.join(','))
    } else {
      parts.push('BYWEEKNO=' + byweekno)
    }
  }
  if (bymonthday) {
    if (Array.isArray(bymonthday)) {
      parts.push('BYMONTHDAY=' + bymonthday.join(','))
    } else {
      parts.push('BYMONTHDAY=' + bymonthday)
    }
  }
  if (byyearday) {
    if (Array.isArray(byyearday)) {
      parts.push('BYYEARDAY=' + byyearday.join(','))
    } else {
      parts.push('BYYEARDAY=' + byyearday)
    }
  }

  return parts.join(';')
}

function createOrganizer(organizer: string | Address | Address[]) {
  let str = ''
  if (Array.isArray(organizer)) {
    // todo - поддержать множество организаторов
    for (const address of organizer) {
      let org = 'ORGANIZER;'
      org += 'CN=' + address.name
      if (address.uri) {
        org += `:${createAddressUri(address.uri)}`
      }
      str += org + BR
    }
  } else if (typeof organizer === 'object') {
    let org = 'ORGANIZER;'
    org += 'CN=' + organizer.name
    if (organizer.uri) {
      org += `:${createAddressUri(organizer.uri)}`
    }
    str += org
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
      org += 'CN=' + address.name
      if (address.uri) {
        org += `:${createAddressUri(address.uri)}`
      }
      str += org + BR
    }
  } else if (typeof attendee === 'object') {
    let org = 'ATTENDEE;'
    org += 'CN=' + attendee.name
    if (attendee.uri) {
      org += `:${createAddressUri(attendee.uri)}`
    }
    str += org
  } else {
    str += attendee.includes(':') && !attendee.startsWith('mailto:')
      ? `ATTENDEE;${attendee}`
      : `ATTENDEE:${attendee}`
  }

  return str
}

function createUri(url: URL) {
  return 'URL;VALUE=URI:' + url.toString()
}

function createClass(klass: Klass) {
  return 'CLASS:' + klass.toUpperCase()
}

function createTransp(transp: Transp) {
  return 'TRANSP:' + transp.toUpperCase()
}

function createAttach(base64: string) {
  if (!base64.startsWith('data:')) {
    return 'ATTACH;VALUE=URI:' + base64
  }

  const dataUrl = base64.slice('data:'.length)
  const commaIndex = dataUrl.indexOf(',')
  if (commaIndex === -1) {
    return 'ATTACH;VALUE=URI:' + base64
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

class VBase {
  protected uid: string
  protected stamp: Date

  constructor({ uid, stamp }: { uid?: string, stamp?: Date }) {
    this.uid = uid ?? globalThis.crypto.randomUUID()
    this.stamp = stamp ?? new Date()
  }
}

export class VEvent extends VBase implements IBase {
  #start: Date
  #startTz?: string
  #end?: Date
  #endTz?: string
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
  #lastModified?: Date
  #alarms: VAlarm[]
  #xProps?: { [xKey: string]: unknown } = {}

  constructor(data: Event) {
    super(data)
    const {
      location,
      geo,
      summary,
      description,
      start,
      startTz,
      end,
      endTz,
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
    if (!(start instanceof Date)) {
      throw new Error('start must be a Date object')
    }
    this.#start = start
    if (end !== undefined && !(end instanceof Date)) {
      throw new Error('end must be a Date object')
    }
    if (startTz) {
      this.#startTz = startTz
    }
    if (end !== undefined) {
      this.#end = end
    }
    if (endTz) {
      this.#endTz = endTz
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
      this.#rrule = rrule
    }
    if (lastModified instanceof Date) {
      this.#lastModified = lastModified
    }
    for (const key of Object.keys(data).filter(key => key.toUpperCase().startsWith('X-'))) {
      this.#xProps![key] = data[key]
    }
    this.#alarms = []
  }

  addAlarm(alarm: VAlarm) {
    this.#alarms.push(alarm)
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VEVENT')
    temp.push(`UID:${this.uid}`)
    temp.push(`DTSTAMP${dateTimeProperty(this.stamp)}`)
    if (this.#lastModified) {
      temp.push(`LAST-MODIFIED${dateTimeProperty(this.#lastModified)}`)
    }
    temp.push(`DTSTART${dateTimeProperty(this.#start, this.#startTz)}`)

    if (this.#end !== undefined) {
      temp.push(`DTEND${dateTimeProperty(this.#end, this.#endTz)}`)
    }
    if (this.#location) {
      temp.push(textProperty('LOCATION', this.#location))
    }
    if (this.#geo) {
      temp.push(`GEO:${this.#geo[0]};${this.#geo[1]}`)
    }
    if (this.#summary) {
      temp.push(textProperty('SUMMARY', this.#summary))
    }
    if (this.#description) {
      temp.push(textProperty('DESCRIPTION', this.#description))
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
      temp.push('RRULE:' + recurrenceRule(this.#rrule))
    }
    for (const key in this.#xProps) {
      temp.push(textProperty(key.toUpperCase(), String(this.#xProps[key])))
    }
    for (const {ics} of this.#alarms) {
      temp.push(ics)
    }
    temp.push('END:VEVENT')

    return temp.join(BR)
  }
}

export class VTodo extends VBase implements IBase {
  #due?: Date
  #summary?: string
  #description?: string
  #status?: string
  #priority?: number
  #rrule?: Rule
  #klass?: Klass
  #categories?: string[]

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
    if (due instanceof Date) {
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
      this.#rrule = rrule
    }
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VTODO')
    temp.push('UID:' + this.uid)
    temp.push(`DTSTAMP${dateTimeProperty(this.stamp)}`)
    if (this.#due) {
      // todo поддержать VALUE=DATE если не указано время, а указана только дата
      temp.push(`DUE;VALUE=DATE-TIME${dateTimeProperty(this.#due)}`)
    }
    if (this.#summary) {
      temp.push(textProperty('SUMMARY', this.#summary))
    }
    if (this.#klass) {
      temp.push(createClass(this.#klass))
    }
    if (this.#categories) {
      temp.push(textListProperty('CATEGORIES', this.#categories))
    }
    if (this.#description) {
      temp.push(textProperty('DESCRIPTION', this.#description))
    }
    if (typeof this.#priority === 'number') {
      temp.push('PRIORITY:' + String(this.#priority))
    }
    if (this.#status) {
      temp.push('STATUS:' + this.#status)
    }
    if (this.#rrule) {
      temp.push('RRULE:' + recurrenceRule(this.#rrule))
    }
    temp.push('END:VTODO')

    return temp.join(BR)
  }
}

export class VJournal extends VBase implements IBase {
  #start?: Date
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
    if (start instanceof Date) {
      this.#start = start
    }
    if (summary?.length) {
      this.#summary = summary
    }
    if (description?.length) {
      this.#description = description
    }
    if (rrule) {
      this.#rrule = rrule
    }
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
      temp.push(textProperty('SUMMARY', this.#summary))
    }
    if (this.#description) {
      temp.push(textProperty('DESCRIPTION', this.#description))
    }
    if (this.#rrule) {
      temp.push('RRULE:' + recurrenceRule(this.#rrule))
    }
    temp.push('END:VJOURNAL')

    return temp.join(BR)
  }
}

export class VAlarm implements IBase {
  #action: string
  #trigger: string
  #description?: string
  #attach?: string
  #attendee?: string | Address | Address[]

  constructor(data: Alarm) {
    const { action, description, trigger, attach, attendee} = data
    if (!trigger) {
      throw new Error('trigger is required')
    }
    this.#trigger = trigger
    if (!action) {
      throw new Error('action is required')
    }
    this.#action = action.toUpperCase()

    switch (this.#action) {
      case 'DISPLAY': {
        if (description?.length) {
          this.#description = description
        }
        break
      }
      case 'AUDIO': {
        if (attach) {
          this.#attach = attach
        }
        break
      }
      case 'EMAIL': {
        if (description?.length) {
          this.#description = description
        }
        if (attendee) {
          this.#attendee = attendee
        }
        break
      }
      case 'PROCEDURE': {
        if (attach) {
          this.#attach = attach
        }
        break
      }
      default:
        break
    }
  }

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VALARM')
    if (this.#trigger.includes(':')) {
      temp.push('TRIGGER;' + this.#trigger)
    } else {
      temp.push('TRIGGER:' + this.#trigger)
    }
    temp.push('ACTION:' + this.#action)

    if (this.#description) {
      temp.push(textProperty('DESCRIPTION', this.#description))
    }
    if (this.#attendee) {
      temp.push(createAttendee(this.#attendee))
    }
    if (this.#attach) {
      temp.push(folding(createAttach(this.#attach)))
    }
    temp.push('END:VALARM')

    return temp.join(BR)
  }
}

export class VTimezone implements IBase {
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

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VTIMEZONE')
    temp.push('TZID:' + this.#tzid)

    if (this.#standard) {
      temp.push('BEGIN:STANDARD')
      temp.push(`DTSTART${floatingDateTimeProperty(this.#standard.start)}`)
      temp.push(`TZOFFSETFROM:${this.#standard.tzOffsetFrom}`)
      temp.push(`TZOFFSETTO:${this.#standard.tzOffsetTo}`)
      temp.push(textProperty('TZNAME', this.#standard.tzname))
      temp.push('END:STANDARD')
    }
    if (this.#daylight) {
      temp.push('BEGIN:DAYLIGHT')
      temp.push(`DTSTART${floatingDateTimeProperty(this.#daylight.start)}`)
      temp.push(`TZOFFSETFROM:${this.#daylight.tzOffsetFrom}`)
      temp.push(`TZOFFSETTO:${this.#daylight.tzOffsetTo}`)
      temp.push(textProperty('TZNAME', this.#daylight.tzname))
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

  get ics() {
    const temp: string[] = []
    temp.push('BEGIN:VCALENDAR')
    temp.push('VERSION:2.0')
    temp.push('PRODID:' + this.#prodId)
    temp.push('CALSCALE:' + this.#calscale)
    temp.push('METHOD:' + this.#method)
    for (const {ics} of this.#timezones) {
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
