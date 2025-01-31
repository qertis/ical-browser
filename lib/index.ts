import { extension } from 'mime-types'
import { Address, Event, Todo, Journal, Alarm, Timezone, Rule, Klass, Transp, Method, Calscale } from './types'

const BR = '\r\n'

// Date conversion to Date UTC Time standard
function dateWithUTCTime(now: Date) {
  const year = now.getUTCFullYear()
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = now.getUTCDate().toString().padStart(2, '0')
  const hours = now.getUTCHours().toString().padStart(2, '0')
  const minutes = now.getUTCMinutes().toString().padStart(2, '0')
  const seconds = now.getUTCSeconds().toString().padStart(2, '0')

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

// todo https://github.com/qertis/ical-browser/issues/1
// Split strings that are more than 75 characters into multiple lines
function unfolding(str: string, maxLimit = 75) {
  const length = str.length
  let outStr = ''
  if (length < maxLimit) {
    return str
  }
  for (let i = 0, j = 2; i < length; i += maxLimit % length, j += 1) {
    outStr += str.slice(i, i + maxLimit) + '\n' + ' '.repeat(j)
  }

  return outStr
}

function createEmail(str: string) {
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
  let outStr = ''
  if (freq) {
    outStr += 'FREQ=' + freq + ';'
  }
  if (interval) {
    outStr += 'INTERVAL=' + interval + ';'
  }
  if (count) {
    outStr += 'COUNT=' + count + ';'
  }
  if (until) {
    outStr += 'UNTIL=' + until + ';'
  }
  outStr += wkst + ';'
  if (byday) {
    outStr += 'BYDAY='
    if (Array.isArray(byday)) {
      outStr += byday.join(',')
    } else {
      outStr += byday
    }
    outStr += ';'
  }
  if (byweekno) {
    outStr += 'BYWEEKNO' + byweekno + ';'
  }
  if (bymonthday) {
    outStr += 'BYMONTHDAY='
    if (Array.isArray(bymonthday)) {
      outStr += bymonthday.join(',')
    } else {
      outStr += bymonthday
    }
    outStr += ';'
  }
  if (byyearday) {
    outStr += 'BYYEARDAY' + byyearday + ';'
  }

  return outStr
}

function createOrganizer(organizer: string | Address | Address[]) {
  let str = ''
  if (Array.isArray(organizer)) {
    for (const address of organizer) {
      let org = 'ORGANIZER;'
      org += 'CN=' + address.name
      if (address.email) {
        org += `:${createEmail(address.email)}`
      } else {
        // todo если не указан email, то добавлять фиктивный email
      }
      str += org + BR
    }
  } else if (typeof organizer === 'object') {
    let org = 'ORGANIZER;'
    org += 'CN=' + organizer.name
    if (organizer.email) {
      org += `:${createEmail(organizer.email)}`
    } else {
      // todo если не указан email, то добавлять фиктивный email
    }
    str += org + BR
  } else {
    str += `ORGANIZER:${organizer}` + BR
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
  const [type, temp] = base64.split('data:')[1].split(';')
  const [encoding, data] = temp.split(',')
  let str = 'ATTACH'
  str += ';FMTTYPE=' + type
  str += ';FILENAME=' + globalThis.crypto.randomUUID() + '.' + extension(type)
  str += ';ENCODING=' + encoding.toUpperCase()
  if (encoding.toUpperCase() !== 'BASE64') {
    str += ';VALUE=' + 'BINARY'
  }
  str += ':' + data

  return str
}

export class VEvent {
  #uid: string
  #stamp: Date
  #start: Date
  #end: Date
  #location?: string
  #geo?: number[]
  #summary?: string
  #description?: string
  #status?: string
  #categories?: string[]
  #priority?: number
  #organizer?: string | Address[]
  #attendee?: string | Address[]
  #attach?: string | string[]
  #url?: URL
  #klass?: Klass
  #transp?: Transp
  #sequence?: number
  #rrule?: Rule
  #alarms: VAlarm[]
  #xProps?: { [xKey: string]: unknown } = {}

  constructor(data: Event) {
    const {
      uid = globalThis.crypto.randomUUID(),
      location,
      geo,
      summary,
      description,
      stamp = new Date(),
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
    } = data
    this.#uid = uid
    this.#stamp = stamp instanceof Date ? stamp : new Date()
    if (!(start instanceof Date)) {
      throw new Error('start must be a Date object')
    }
    this.#start = start
    if (!(end instanceof Date)) {
      throw new Error('end must be a Date object')
    }
    this.#end = end
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
    if (priority) {
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
    if (sequence) {
      this.#sequence = sequence
    }
    if (rrule) {
      this.#rrule = rrule
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
    let str = 'BEGIN:VEVENT' + BR
    str += `UID:${this.#uid}` + BR
    str += `DTSTAMP:${dateWithUTCTime(this.#stamp)}` + BR
    str += `DTSTART:${dateWithUTCTime(this.#start)}` + BR

    if (this.#start === this.#end) {
      str += `DURATION:${'PT1H00M'}` + BR
    } else {
      str += `DTEND:${dateWithUTCTime(this.#end)}` + BR
    }
    if (this.#location) {
      str += `LOCATION:${this.#location}` + BR
    }
    if (this.#geo) {
      str += `GEO:${this.#geo[0]};${this.#geo[1]}` + BR
    }
    if (this.#summary) {
      str += `SUMMARY:${unfolding(this.#summary)}` + BR
    }
    if (this.#description) {
      str += `DESCRIPTION:${(this.#description)}` + BR
    }
    if (this.#status) {
      str += `STATUS:${this.#status}` + BR
    }
    if (this.#categories) {
      str += `CATEGORIES:${this.#categories}` + BR
    }
    if (this.#priority) {
      str += `PRIORITY:${this.#priority}` + BR
    }
    if (this.#organizer) {
      str += createOrganizer(this.#organizer)
    }
    if (this.#attendee) {
      str += createOrganizer(this.#attendee)
    }
    if (this.#attach) {
      if (Array.isArray(this.#attach)) {
        for (const base64 of this.#attach) {
          str += createAttach(base64) + BR
        }
      } else {
        str += createAttach(this.#attach) + BR
      }
    }
    if (this.#url) {
      str += createUri(this.#url) + BR
    }
    if (this.#klass) {
      str += createClass(this.#klass) + BR
    }
    if (this.#transp) {
      str += createTransp(this.#transp) + BR
    }
    if (this.#sequence) {
      str += `SEQUENCE:${this.#sequence}` + BR
    }
    if (this.#rrule) {
      str += 'RRULE:' + recurrenceRule(this.#rrule) + BR
    }
    for (const key in this.#xProps) {
      str += `${key.toUpperCase()}:${this.#xProps[key]}` + BR
    }
    str += this.#alarms.map(alarm => alarm.ics + BR)
    str += 'END:VEVENT'

    return str
  }
}

export class VTodo {
  #uid: string
  #stamp: Date
  #due?: Date
  #summary?: string
  #description?: string
  #status?: string
  #priority?: number
  #rrule?: Rule
  #klass?: Klass
  #categories?: string[]

  constructor({
    uid = globalThis.crypto.randomUUID(),
    stamp,
    due,
    summary,
    description,
    status,
    priority,
    klass,
    categories,
    rrule,
  }: Todo) {
    this.#uid = uid
    this.#stamp = stamp instanceof Date ? stamp : new Date()
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
    if (priority) {
      this.#priority = priority
    }
    if (rrule) {
      this.#rrule = rrule
    }
  }

  get ics() {
    let str = 'BEGIN:VTODO' + BR
    str += 'UID:' + this.#uid + BR
    str += `DTSTAMP:${dateWithUTCTime(this.#stamp)}` + BR
    if (this.#due) {
      // todo поддержать VALUE=DATE если не указано время, а указана только дата
      str += `DUE;VALUE=DATE-TIME:${dateWithUTCTime(this.#due)}` + BR
    }
    if (this.#summary) {
      str += 'SUMMARY:' + unfolding(this.#summary) + BR
    }
    if (this.#klass) {
      str += createClass(this.#klass) + BR
    }
    if (this.#categories) {
      str += `CATEGORIES:${this.#categories}` + BR
    }
    if (this.#description) {
      str += 'DESCRIPTION:' + (this.#description) + BR
    }
    if (this.#priority) {
      str += 'PRIORITY:' + String(this.#priority) + BR
    }
    if (this.#status) {
      str += 'STATUS:' + this.#status + BR
    }
    if (this.#rrule) {
      str += 'RRULE:' + recurrenceRule(this.#rrule) + BR
    }
    str += 'END:VTODO'

    return str
  }
}

export class VJournal {
  #uid: string
  #stamp: Date
  #start?: Date
  #summary?: string
  #description?: string
  #rrule?: Rule

  constructor({
    uid = globalThis.crypto.randomUUID(),
    stamp,
    start,
    summary,
    description,
    rrule,
  }: Journal) {
    this.#uid = uid
    this.#stamp = stamp instanceof Date ? stamp : new Date()
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
    let str = 'BEGIN:VJOURNAL' + BR
    str += `UID:${this.#uid}` + BR
    if (this.#stamp) {
      str += `DTSTAMP:${dateWithUTCTime(this.#stamp)}` + BR
    }
    if (this.#start) {
      str += `DTSTART:${dateWithUTCTime(this.#start)}` + BR
    }
    if (this.#summary) {
      str += `SUMMARY:${unfolding(this.#summary)}` + BR
    }
    if (this.#description) {
      str += `DESCRIPTION:${(this.#description)}` + BR
    }
    if (this.#rrule) {
      str += 'RRULE:' + recurrenceRule(this.#rrule) + BR
    }
    str += 'END:VJOURNAL'

    return str
  }
}

export class VAlarm {
  #action: string
  #trigger: string
  #description?: string
  #attach?: string
  #attendee?: string | Address[]

  constructor({ action, description, trigger, attach, attendee}: Alarm) {
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
    let str = 'BEGIN:VALARM' + BR
    str += 'TRIGGER:' + this.#trigger + BR
    str += 'ACTION:' + this.#action + BR

    if (this.#description) {
      str += 'DESCRIPTION:' + this.#description + BR
    }
    if (this.#attendee) {
      str += createOrganizer(this.#attendee)
    }
    if (this.#attach) {
      str += createAttach(this.#attach) + BR
    }
    str += 'END:VALARM'

    return str
  }
}

export class VTimezone {
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
    let str = 'BEGIN:VTIMEZONE' + BR
    str += this.#tzid + BR

    if (this.#standard) {
      str += 'BEGIN:STANDARD' + BR
      str += `DTSTART:${dateWithUTCTime(this.#standard.start)}` + BR
      str += `TZOFFSETFROM:${this.#standard.tzOffsetFrom}` + BR
      str += `TZOFFSETTO:${this.#standard.tzOffsetTo}` + BR
      str += 'END:STANDARD'
    }
    if (this.#daylight) {
      str += 'BEGIN:DAYLIGHT' + BR
      str += `DTSTART:${dateWithUTCTime(this.#daylight.start)}` + BR
      str += `TZOFFSETFROM:${this.#daylight.tzOffsetFrom}` + BR
      str += `TZOFFSETTO:${this.#daylight.tzOffsetTo}` + BR
      str += 'END:DAYLIGHT'
    }
    str += 'END:VTIMEZONE'

    return str
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
    let str = 'BEGIN:VCALENDAR' + BR
    str += 'VERSION:2.0' + BR
    str += 'PRODID:' + this.#prodId + BR
    str += 'CALSCALE:' + this.#calscale + BR
    str += 'METHOD:' + this.#method + BR
    str += this.#timezones.map(timezone => timezone.ics + BR)
    str += this.#events.map(event => event.ics + BR)
    str += this.#todos.map(todo => todo.ics + BR)
    str += this.#journals.map(journal => journal.ics + BR)
    str += 'END:VCALENDAR'

    return str
  }

  download(filename: string) {
    return new File([new TextEncoder().encode(this.ics)], filename, {
      type: 'text/calendar',
    })
  }
}
