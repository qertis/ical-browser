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

export type Rule = {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  count: number
  interval: number
  until: string
  wkst: Day.mo | Day.su
  byday: Day | Day[]
  byweekno: number
  bymonthday: number | number[]
  byyearday: number
}

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
  status?: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'
  categories?: string
  rrule?: Rule
}

export interface Todo {
  uid: string
  stamp?: Date
  due?: Date
  summary?: string
  description?: string
  priority?: number
  status?: 'NEEDS-ACTION' | 'COMPLETED' | 'IN-PROCESS' | 'CANCELLED'
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
