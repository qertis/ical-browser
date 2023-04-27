import { Event, Todo, Journal, Alarm } from './types'

const BR = '\r\n'

// конвертация даты в стандарт Date UTC Time
function dateWithUTCTime(now: Date) {
  const year = now.getUTCFullYear()
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = now.getUTCDate().toString().padStart(2, '0')
  const hours = now.getUTCHours().toString().padStart(2, '0')
  const minutes = now.getUTCMinutes().toString().padStart(2, '0')
  const seconds = now.getUTCSeconds().toString().padStart(2, '0')

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`
}

// разрезаем строки которые больше 75 символов на несколько строк
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

export function event({
  uid,
  location,
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
}: Event) {
  let str = 'BEGIN:VEVENT' + BR
  str += `UID:${uid}` + BR
  if (stamp) {
    str += `DTSTAMP:${dateWithUTCTime(stamp)}` + BR
  }
  if (start) {
    str += `DTSTART:${dateWithUTCTime(start)}` + BR
  }
  if (end) {
    str += `DTEND:${dateWithUTCTime(end)}` + BR
  }
  if (location) {
    str += `LOCATION:${location}` + BR
  }
  if (summary) {
    str += `SUMMARY:${unfolding(summary)}` + BR
  }
  if (description) {
    str += `DESCRIPTION:${unfolding(description)}` + BR
  }
  if (status) {
    str += `STATUS:${status}` + BR
  }
  if (categories) {
    str += `CATEGORIES:${categories}` + BR
  }
  if (Array.isArray(organizer)) {
    for (const address of organizer) {
      let org = 'ORGANIZER;'
      org += 'CN=' + address.name
      org += ':mailto:' + address.email
      str += org + BR
    }
  } else if (typeof organizer === 'string') {
    str += `ORGANIZER;${organizer}` + BR
  }
  if (Array.isArray(attendee)) {
    for (const address of attendee) {
      let org = 'ORGANIZER;'
      org += 'CN=' + address.name
      org += ':mailto:' + address.email
      str += org + BR
    }
  } else if (typeof attendee === 'string') {
    str += `ATTENDEE;${attendee}` + BR
  }
  if (Array.isArray(attach)) {
    for (const base64 of attach) {
      str += createAttach(base64) + BR
    }
  } else if (typeof attach === 'string') {
    str += createAttach(attach) + BR
  }
  if (url) {
    str += createUri(url) + BR
  }
  str += 'END:VEVENT'

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
  str += ';ENCODING=' + encoding.toUpperCase()
  str += ';VALUE=' + 'BINARY'
  str += ':' + data

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
}: Todo) {
  let str = 'BEGIN:VTODO' + BR
  str += 'UID:' + uid + BR
  if (stamp) {
    str += `DTSTAMP:${dateWithUTCTime(stamp)}` + BR
  }
  if (due) {
    str += `DTSTAMP:${dateWithUTCTime(due)}` + BR
  }
  if (summary) {
    str += 'SUMMARY:' + unfolding(summary) + BR
  }
  if (description) {
    str += 'DESCRIPTION:' + unfolding(description) + BR
  }
  if (priority) {
    str += 'PRIORITY:' + String(priority) + BR
  }
  if (status) {
    str += 'STATUS:' + status + BR
  }
  str += 'END:VTODO'

  return str
}

export function journal({ uid, stamp, start, summary, description }: Journal) {
  let str = 'BEGIN:VJOURNAL'
  str += `UID:${uid}` + BR
  if (stamp) {
    str += `DTSTAMP:${dateWithUTCTime(stamp)}` + BR
  }
  if (start) {
    str += `DTSTART:${dateWithUTCTime(start)}` + BR
  }
  if (summary) {
    str += `SUMMARY:${unfolding(summary)}` + BR
  }
  if (description) {
    str += `DESCRIPTION:${unfolding(description)}` + BR
  }
  str += 'END:VJOURNAL'

  return str
}

export function alarm({ uid, action, description, trigger }: Alarm) {
  let str = 'BEGIN:VALARM' + BR
  str += 'UID:' + uid + BR
  str += 'TRIGGER:' + trigger + BR
  str += 'DESCRIPTION:' + description + BR
  str += 'ACTION:' + action + BR
  str += 'END:VALARM'

  return str
}

export default (
  id: string,
  name: string,
  event?: string,
  todo?: string,
  journal?: string,
  alarm?: string,
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

  const encoder = new TextEncoder()
  const view = encoder.encode(str)
  return new File([view], name + '.ics', {
    type: 'text/calendar',
  })
}
