import mime from 'mime-types'
import { Event, Todo, Journal, Alarm, Rule, Day } from './types'

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

function createOrganizer(organizer: string | {name: string, email: string}[]) {
  let str = ''
  if (Array.isArray(organizer)) {
    for (const address of organizer) {
      let org = 'ORGANIZER;'
      org += 'CN=' + address.name
      if (address.email) {
        org += `:${createEmail(address.email)}`
      }
      str += org + BR
    }
  } else {
    str += `ORGANIZER:${organizer}` + BR
  }
  return str
}

function createUri(url: URL) {
  return 'URL;VALUE=URI:' + url.toString()
}

function createAttach(base64: string) {
  const [type, temp] = base64.split('data:')[1].split(';')
  const [encoding, data] = temp.split(',')

  let str = 'ATTACH'
  str += ';FMTTYPE=' + type
  str += ';FILENAME=' + globalThis.crypto.randomUUID() + '.' + mime.extension(type)
  str += ';ENCODING=' + encoding.toUpperCase()
  str += ';VALUE=' + 'BINARY'
  str += ':' + data

  return str
}
export function event({
  uid,
  location,
  geo,
  summary,
  description,
  stamp,
  start,
  end,
  attach,
  organizer,
  attendee,
  url,
  status,
  categories,
  rrule,
}: Event) {
  let str = 'BEGIN:VEVENT' + BR
  str += `UID:${uid}` + BR
  if (stamp instanceof Date) {
    str += `DTSTAMP:${dateWithUTCTime(stamp)}` + BR
  }
  if (start instanceof Date) {
    str += `DTSTART:${dateWithUTCTime(start)}` + BR
  }
  if (end instanceof Date) {
    str += `DTEND:${dateWithUTCTime(end)}` + BR
  }
  if (location?.length) {
    str += `LOCATION:${location}` + BR
  }
  if (geo && Array.isArray(geo)) {
    str += `GEO:${geo[0]};${geo[1]}` + BR
  }
  if (summary?.length) {
    str += `SUMMARY:${unfolding(summary)}` + BR
  }
  if (description?.length) {
    str += `DESCRIPTION:${(description)}` + BR
  }
  if (status?.length) {
    str += `STATUS:${status}` + BR
  }
  if (categories) {
    str += `CATEGORIES:${categories}` + BR
  }
  if (organizer) {
    str += createOrganizer(organizer)
  }
  if (attendee) {
    str += createOrganizer(attendee)
  }
  if (attach) {
    if (Array.isArray(attach)) {
      for (const base64 of attach) {
        str += createAttach(base64) + BR
      }
    } else {
      str += createAttach(attach) + BR
    }
  }
  if (url && url instanceof URL) {
    str += createUri(url) + BR
  }
  if (rrule) {
    str += 'RRULE:' + recurrenceRule(rrule) + BR
  }
  str += 'END:VEVENT'

  return str
}

export function todo({
  uid,
  stamp,
  due,
  summary,
  description,
  priority,
  status,
  rrule,
}: Todo) {
  let str = 'BEGIN:VTODO' + BR
  str += 'UID:' + uid + BR
  if (stamp instanceof Date) {
    str += `DTSTAMP:${dateWithUTCTime(stamp)}` + BR
  }
  if (due instanceof Date) {
    str += `DTSTAMP:${dateWithUTCTime(due)}` + BR
  }
  if (summary?.length) {
    str += 'SUMMARY:' + unfolding(summary) + BR
  }
  if (description?.length) {
    str += 'DESCRIPTION:' + (description) + BR
  }
  if (priority) {
    str += 'PRIORITY:' + String(priority) + BR
  }
  if (status?.length) {
    str += 'STATUS:' + status + BR
  }
  if (rrule) {
    str += 'RRULE:' + recurrenceRule(rrule) + BR
  }
  str += 'END:VTODO'

  return str
}

export function journal({
  uid,
  stamp,
  start,
  summary,
  description,
  rrule,
}: Journal) {
  let str = 'BEGIN:VJOURNAL'
  str += `UID:${uid}` + BR
  if (stamp instanceof Date) {
    str += `DTSTAMP:${dateWithUTCTime(stamp)}` + BR
  }
  if (start instanceof Date) {
    str += `DTSTART:${dateWithUTCTime(start)}` + BR
  }
  if (summary?.length) {
    str += `SUMMARY:${unfolding(summary)}` + BR
  }
  if (description?.length) {
    str += `DESCRIPTION:${(description)}` + BR
  }
  if (rrule) {
    str += 'RRULE:' + recurrenceRule(rrule) + BR
  }
  str += 'END:VJOURNAL'

  return str
}

export function alarm({ uid, action, description, trigger }: Alarm) {
  let str = 'BEGIN:VALARM' + BR
  str += 'UID:' + uid + BR
  if (trigger) {
    str += 'TRIGGER:' + trigger + BR
  }
  if (description?.length) {
    str += 'DESCRIPTION:' + description + BR
  }
  if (action) {
    str += 'ACTION:' + action + BR
  }
  str += 'END:VALARM'

  return str
}

export default (
  id: string,
  { event, todo, journal, alarm, }: { event?: string, todo?: string, journal?: string, alarm?: string }
) => {
  let str = 'BEGIN:VCALENDAR' + BR
  str += 'VERSION:2.0' + BR
  str += 'PRODID:' + id + BR
  str += 'CALSCALE:GREGORIAN' + BR
  str += 'METHOD:PUBLISH' + BR

  if (event) {
    str += event + BR
  }
  if (todo) {
    str += todo + BR
  }
  if (journal) {
    str += journal + BR
  }
  if (alarm) {
    str += alarm + BR
  }
  str += 'END:VCALENDAR'

  return str as string
}
