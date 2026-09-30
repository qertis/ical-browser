/// <reference lib="esnext.temporal" preserve="true" />

export type CalendarDate = Temporal.PlainDate | Temporal.Instant | Temporal.ZonedDateTime
export type CalendarMoment = Temporal.Instant | Temporal.ZonedDateTime

export type RelType = 'PARENT' | 'CHILD' | 'SIBLING'

export type RelatedTo = {
  uid: string
  reltype: RelType
}

export type Address = {
  name: string
  uri: string
}

export type RuleFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export type RuleDay = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export type Rule = {
  freq: RuleFreq
  count?: number
  interval?: number
  until?: CalendarDate
  wkst?: 'MO' | 'SU'
  byday?: RuleDay | RuleDay[]
  byweekno?: number | number[]
  bymonth?: number | number[]
  bymonthday?: number | number[]
  byyearday?: number | number[]
  byhour?: number | number[]
  byminute?: number | number[]
}

export type EventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'

export type Klass = 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL'

export type Transp = 'TRANSPARENT' | 'OPAQUE'

export type FreeBusyType = 'FREE' | 'BUSY' | 'BUSY-TENTATIVE' | 'BUSY-UNAVAILABLE'

export type BusyType = 'BUSY' | 'BUSY-UNAVAILABLE' | 'BUSY-TENTATIVE'

export type DateListPropertyName = 'RDATE' | 'EXDATE'

export interface Availability {
  uid?: string
  stamp?: Temporal.Instant
  start?: CalendarMoment
  end?: CalendarMoment
  duration?: string
  busyType?: BusyType
  klass?: Klass
  created?: Temporal.Instant
  lastModified?: Temporal.Instant
  location?: string
  organizer?: string | Address | Address[]
  priority?: number
  sequence?: number
  summary?: string
  description?: string
  url?: URL
  categories?: string[]
  xProps?: { [xKey: string]: string }
}

export interface Available {
  uid?: string
  stamp?: Temporal.Instant
  start: CalendarMoment
  end?: CalendarMoment
  duration?: string
  created?: Temporal.Instant
  description?: string
  lastModified?: Temporal.Instant
  location?: string
  recurrenceId?: CalendarMoment
  rrule?: Rule
  summary?: string
  categories?: string[]
  rdate?: CalendarMoment[]
  exdate?: CalendarMoment[]
  xProps?: { [xKey: string]: string }
}

export interface FreeBusyPeriod {
  start: CalendarMoment
  end?: CalendarMoment
  // Must be an iCalendar duration string, for example PT1H or P1D.
  duration?: string
  type?: FreeBusyType
}

export interface FreeBusy {
  uid?: string
  stamp?: Temporal.Instant
  start?: CalendarMoment
  end?: CalendarMoment
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
  relatedTo?: RelatedTo | RelatedTo[]
  location?: string
  geo?: number[]
  summary?: string
  description?: string
  stamp?: Temporal.Instant
  start: CalendarDate
  end?: CalendarDate
  startTz?: never
  endTz?: never
  attach?: string | string[]
  organizer?: string | Address | Address[]
  attendee?: string | Address | Address[]
  url?: URL
  status?: EventStatus
  categories?: string[]
  rrule?: Rule
  rdate?: CalendarDate[]
  exdate?: CalendarDate[]
  klass?: Klass
  transp?: Transp
  sequence?: number
  priority?: number
  lastModified?: Temporal.Instant
  [xKey: `X-${string}` | `x-${string}`]: unknown
}

export type TodoStatus = 'NEEDS-ACTION' | 'COMPLETED' | 'IN-PROCESS' | 'CANCELLED'

export type Action = 'DISPLAY' | 'AUDIO' | 'EMAIL' | 'PROCEDURE'

export interface Todo {
  uid: string
  relatedTo?: RelatedTo | RelatedTo[]
  stamp?: Temporal.Instant
  due?: CalendarDate
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
  relatedTo?: RelatedTo | RelatedTo[]
  stamp?: Temporal.Instant
  start?: CalendarDate
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
  start: Temporal.PlainDateTime
  tzOffsetFrom: string
  tzOffsetTo: string
  tzname: string
}

export type Method  = 'PUBLISH' | 'REQUEST' | 'REPLY' | 'CANCEL'

export type Calscale = 'GREGORIAN' | 'CHINESE'
