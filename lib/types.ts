export type Address = {
  name: string
  email: string
}

export interface Event {
  uid: string
  location?: string
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
}

export interface Todo {
  uid: string
  stamp?: Date
  due?: Date
  summary?: string
  description?: string
  priority?: number
  status?: 'NEEDS-ACTION' | 'COMPLETED' | 'IN-PROCESS' | 'CANCELLED'
}

export interface Journal {
  uid: string
  stamp?: Date
  start?: Date
  summary?: string
  description?: string
}

export interface Alarm {
  uid: string
  action?: string
  description?: string
  trigger?: string
}
