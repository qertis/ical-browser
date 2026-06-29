export type Address = {
  name: string
  uri: string
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

export type RuleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export type Rule = {
  freq: RuleFreq
  count?: number
  interval?: number
  until?: Date
  wkst?: 'MO' | 'SU'
  byday?: Day | Day[]
  byweekno?: number | number[]
  bymonthday?: number | number[]
  byyearday?: number | number[]
}

export type EventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'

export type Klass = 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL'

export type Transp = 'TRANSPARENT' | 'OPAQUE'

export type FreeBusyType = 'FREE' | 'BUSY' | 'BUSY-TENTATIVE' | 'BUSY-UNAVAILABLE'

export interface FreeBusyPeriod {
  start: Date
  end?: Date
  // Must be an iCalendar duration string, for example PT1H or P1D.
  duration?: string
  type?: FreeBusyType
}

export interface FreeBusy {
  uid?: string
  stamp?: Date
  start?: Date
  end?: Date
  organizer?: string | Address | Address[]
  attendee?: string | Address | Address[]
  contact?: string | string[]
  comment?: string | string[]
  url?: URL | string
  freeBusy: FreeBusyPeriod[]
  xProps?: { [xKey: string]: string }
}

export interface Event {
  uid: string
  location?: string
  geo?: number[]
  summary?: string
  description?: string
  stamp?: Date
  start: Date
  startTz?: string
  endTz?: string
  end?: Date
  attach?: string | string[]
  organizer?: string | Address | Address[]
  attendee?: string | Address | Address[]
  url?: URL
  status?: EventStatus
  categories?: string[]
  rrule?: Rule
  klass?: Klass
  transp?: Transp
  sequence?: number
  priority?: number
  lastModified?: Date
  [xKey: string]: unknown
}

export type TodoStatus = 'NEEDS-ACTION' | 'COMPLETED' | 'IN-PROCESS' | 'CANCELLED'

export type Action = 'DISPLAY' | 'AUDIO' | 'EMAIL' | 'PROCEDURE'

export interface Todo {
  uid: string
  stamp?: Date
  due?: Date
  summary?: string
  categories?: string[]
  description?: string
  priority?: number
  status?: TodoStatus
  klass?: Klass
  rrule?: Rule
}

export interface Journal {
  uid: string
  stamp?: Date
  start?: Date
  summary?: string
  description?: string
  rrule?: Rule
}

export interface Alarm {
  action: Action
  trigger: string
  description?: string
  summary?: string
  attendee?: string | Address | Address[]
  attach?: string | string[]
  duration?: string
  repeat?: number
  xProps?: { [xKey: string]: string }
}

export interface Timezone {
  start: Date
  tzOffsetFrom: string
  tzOffsetTo: string
  tzname: string
}

export type Method  = 'PUBLISH' | 'REQUEST' | 'REPLY' | 'CANCEL'

export type Calscale = 'GREGORIAN' | 'CHINESE'
