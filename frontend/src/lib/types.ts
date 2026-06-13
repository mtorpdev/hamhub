export enum Band {
  M160 = 1, M80 = 2, M60 = 3, M40 = 4, M30 = 5, M20 = 6,
  M17 = 7, M15 = 8, M12 = 9, M10 = 10, M6 = 11, M2 = 12, CM70 = 13
}

export enum Mode {
  SSB = 1, CW = 2, FT8 = 3, FT4 = 4, RTTY = 5, DMR = 6, FM = 7, AM = 8
}

export enum LicenseClass {
  Novice = 1, Technician = 2, General = 3, Advanced = 4, Amateur = 5, Full = 6
}

export enum ProfileVisibility {
  Public = 1, MembersOnly = 2, Private = 3
}

export const BandLabels: Record<Band, string> = {
  [Band.M160]: '160m', [Band.M80]: '80m', [Band.M60]: '60m', [Band.M40]: '40m',
  [Band.M30]: '30m', [Band.M20]: '20m', [Band.M17]: '17m', [Band.M15]: '15m',
  [Band.M12]: '12m', [Band.M10]: '10m', [Band.M6]: '6m', [Band.M2]: '2m', [Band.CM70]: '70cm'
}

export const ModeLabels: Record<Mode, string> = {
  [Mode.SSB]: 'SSB', [Mode.CW]: 'CW', [Mode.FT8]: 'FT8', [Mode.FT4]: 'FT4',
  [Mode.RTTY]: 'RTTY', [Mode.DMR]: 'DMR', [Mode.FM]: 'FM', [Mode.AM]: 'AM'
}

export interface AuthResponse {
  token: string
  userId: string
  email: string
  callsign: string | null
  roles: string[]
}

export interface User {
  id: string
  email: string
  callsign: string | null
  firstName: string | null
  lastName: string | null
  country: string | null
  gridLocator: string | null
  licenseClass: LicenseClass | null
  profileDescription: string | null
  profileImageUrl: string | null
  visibility: ProfileVisibility
  createdAt: string
}

export interface Station {
  id: number
  userId: string
  name: string
  callsign: string | null
  radioEquipment: string | null
  antennaDescription: string | null
  powerOutput: number | null
  location: string | null
  gridLocator: string | null
  supportedModes: Mode[]
  supportedBands: Band[]
  createdAt: string
}

export interface Qso {
  id: number
  userId: string
  dateUtc: string
  ownCallsign: string
  workedCallsign: string
  band: Band
  frequency: number | null
  mode: Mode
  rstSent: string | null
  rstReceived: string | null
  locator: string | null
  country: string | null
  notes: string | null
  createdAt: string
}

export interface DxSpot {
  id: number
  userId: string
  spotterCallsign: string
  callsign: string
  frequency: number
  band: Band
  mode: Mode
  comment: string | null
  spottedAt: string
}

export interface Article {
  id: number
  title: string
  slug: string
  summary: string | null
  content: string
  categoryId: number
  categoryName: string
  authorId: string
  authorCallsign: string | null
  isPublished: boolean
  publishDate: string | null
  createdAt: string
}

export interface DashboardStats {
  totalUsers: number
  totalStations: number
  totalQsos: number
  totalDxSpots: number
  totalArticles: number
}
