export type Address = {
  name: string
  email: string
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
  count: number
  interval: number
  until: string
  wkst: 'MO' | 'SU'
  byday: Day | Day[]
  byweekno: number
  bymonthday: number | number[]
  byyearday: number
}

export type EventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'

export type Klass = 'PUBLIC' | 'PRIVATE' | 'CONFIDENTIAL'

export type Transp = 'TRANSPARENT' | 'OPAQUE'

export interface Event {
  uid: string
  location?: string
  geo?: number[]
  summary?: string
  description?: string
  stamp?: Date
  start?: Date
  startTz?: string
  endTz?: string
  end?: Date
  attach?: string | string[]
  organizer?: string | Address[]
  attendee?: string | Address[]
  url?: URL
  status?: EventStatus
  categories?: string[]
  rrule?: Rule
  klass?: Klass
  transp?: Transp
  sequence?: number
  priority?: number
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
  description?: string
  trigger?: string
  attach?: string
  attendee?: string | Address[]
}

export interface Timezone {
  start: Date
  tzOffsetFrom: string
  tzOffsetTo: string
  tzname: string
}

export type Method  = 'PUBLISH' | 'REQUEST' | 'REPLY' | 'CANCEL'

export type Calscale = 'GREGORIAN' | 'CHINESE'
