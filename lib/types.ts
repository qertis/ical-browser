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
  end?: Date
  attach?: string[] | string
  organizer?: string | Address[]
  attendee?: string | Address[]
  url?: URL
  status?: EventStatus
  categories?: string
  rrule?: Rule
  klass?: Klass
  transp?: Transp
}

export type TodoStatus = 'NEEDS-ACTION' | 'COMPLETED' | 'IN-PROCESS' | 'CANCELLED'

export interface Todo {
  uid: string
  stamp?: Date
  due?: Date
  summary?: string
  description?: string
  priority?: number
  status?: TodoStatus
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
  uid: string
  action?: string
  description?: string
  trigger?: string
}
