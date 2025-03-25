import { extension } from 'mime-types'
import type { Address, Event, Todo, Journal, Alarm, Timezone, Rule, Klass, Transp, Method, Calscale } from './types'

const BR = '\r\n'

// Date conversion to Date UTC Time standard
function dateWithUTCTime(now: Date, timezone?: string) {
  const year = now.getUTCFullYear()
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = now.getUTCDate().toString().padStart(2, '0')
  const hours = now.getUTCHours().toString().padStart(2, '0')
  const minutes = now.getUTCMinutes().toString().padStart(2, '0')
  const seconds = now.getUTCSeconds().toString().padStart(2, '0')

  if (timezone) {
    return `;TZID=${timezone}:${year}${month}${day}T${hours}${minutes}${seconds}`
  }
  return `:${year}${month}${day}T${hours}${minutes}${seconds}Z`
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

interface IBase {
  readonly ics: string
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
  #end: Date
  #endTz?: string
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
    } = data
    if (!(start instanceof Date)) {
      throw new Error('start must be a Date object')
    }
    this.#start = start
    if (!(end instanceof Date)) {
      throw new Error('end must be a Date object')
    }
    if (startTz) {
      this.#startTz = startTz
    }
    this.#end = end
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
    const temp: string[] = []
    temp.push('BEGIN:VEVENT')
    temp.push(`UID:${this.uid}`)
    temp.push(`DTSTAMP${dateWithUTCTime(this.stamp)}`)
    temp.push(`DTSTART${dateWithUTCTime(this.#start, this.#startTz)}`)

    if (this.#start === this.#end) {
      // todo хардкод: по-умолчанию длительность 1 час
      temp.push(`DURATION:${'PT1H00M'}`)
    } else {
      temp.push(`DTEND${dateWithUTCTime(this.#end, this.#endTz)}`)
    }
    if (this.#location) {
      temp.push(`LOCATION:${this.#location}`)
    }
    if (this.#geo) {
      temp.push(`GEO:${this.#geo[0]};${this.#geo[1]}`)
    }
    if (this.#summary) {
      temp.push(`SUMMARY:${unfolding(this.#summary)}`)
    }
    if (this.#description) {
      temp.push(`DESCRIPTION:${(this.#description)}`)
    }
    if (this.#status) {
      temp.push(`STATUS:${this.#status}`)
    }
    if (this.#categories) {
      temp.push(`CATEGORIES:${this.#categories}`)
    }
    if (this.#priority) {
      temp.push(`PRIORITY:${this.#priority}`)
    }
    if (this.#organizer) {
      temp.push(createOrganizer(this.#organizer))
    }
    if (this.#attendee) {
      temp.push(createOrganizer(this.#attendee))
    }
    if (this.#attach) {
      if (Array.isArray(this.#attach)) {
        for (const base64 of this.#attach) {
          temp.push(createAttach(base64))
        }
      } else {
        temp.push(createAttach(this.#attach))
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
    if (this.#sequence) {
      temp.push(`SEQUENCE:${this.#sequence}`)
    }
    if (this.#rrule) {
      temp.push('RRULE:' + recurrenceRule(this.#rrule))
    }
    for (const key in this.#xProps) {
      temp.push(`${key.toUpperCase()}:${this.#xProps[key]}`)
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
    if (priority) {
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
    temp.push(`DTSTAMP${dateWithUTCTime(this.stamp)}`)
    if (this.#due) {
      // todo поддержать VALUE=DATE если не указано время, а указана только дата
      temp.push(`DUE;VALUE=DATE-TIME${dateWithUTCTime(this.#due)}`)
    }
    if (this.#summary) {
      temp.push('SUMMARY:' + unfolding(this.#summary))
    }
    if (this.#klass) {
      temp.push(createClass(this.#klass))
    }
    if (this.#categories) {
      temp.push(`CATEGORIES:${this.#categories}`)
    }
    if (this.#description) {
      temp.push('DESCRIPTION:' + (this.#description))
    }
    if (this.#priority) {
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
      temp.push(`DTSTAMP${dateWithUTCTime(this.stamp)}`)
    }
    if (this.#start) {
      temp.push(`DTSTART${dateWithUTCTime(this.#start)}`)
    }
    if (this.#summary) {
      temp.push(`SUMMARY:${unfolding(this.#summary)}`)
    }
    if (this.#description) {
      temp.push(`DESCRIPTION:${(this.#description)}`)
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
  #attendee?: string | Address[]

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
      temp.push('DESCRIPTION:' + this.#description)
    }
    if (this.#attendee) {
      temp.push(createOrganizer(this.#attendee))
    }
    if (this.#attach) {
      temp.push(createAttach(this.#attach))
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
      temp.push(`DTSTART${dateWithUTCTime(this.#standard.start)}`)
      temp.push(`TZOFFSETFROM:${this.#standard.tzOffsetFrom}`)
      temp.push(`TZOFFSETTO:${this.#standard.tzOffsetTo}`)
      temp.push('END:STANDARD')
    }
    if (this.#daylight) {
      temp.push('BEGIN:DAYLIGHT')
      temp.push(`DTSTART${dateWithUTCTime(this.#daylight.start)}`)
      temp.push(`TZOFFSETFROM:${this.#daylight.tzOffsetFrom}`)
      temp.push(`TZOFFSETTO:${this.#daylight.tzOffsetTo}`)
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
