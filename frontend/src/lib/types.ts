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
  submode: string | null
  locator: string | null
  myGridsquare: string | null
  country: string | null
  dxcc: number | null
  continent: string | null
  state: string | null
  iota: string | null
  name: string | null
  qth: string | null
  txPower: number | null
  comment: string | null
  qrzId: string | null
  createdAt: string
  updatedAt: string
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

export interface ArticleCategory {
  id: number
  name: string
  slug: string
}

export interface ArticleComment {
  id: number
  articleId: number
  authorId: string
  authorCallsign: string | null
  content: string
  createdAt: string
}

export interface ClusterSpot {
  callsign: string
  frequency: number
  mode: string
  spotter: string
  info: string
  time: string
}

export interface DashboardStats {
  totalUsers: number
  totalStations: number
  totalQsos: number
  totalDxSpots: number
  totalArticles: number
}

export interface WsjtxDecodeItem {
  id: number
  spotterCallsign: string
  message: string
  dxCallsign: string | null
  dxGrid: string | null
  snr: number
  deltaTime: number
  deltaFreqHz: number
  frequencyMhz: number
  mode: string
  decodedAt: string
}

export interface QrzStatus {
  connected: boolean
  lastSyncedAt: string | null
  qrzCallsign: string | null
  xmlConnected: boolean
  qrzUsername: string | null
}

export enum ListingCategory {
  Transceiver = 1, Receiver = 2, Antenna = 3, Amplifier = 4,
  PowerSupply = 5, Rotator = 6, Keyer = 7, SDR = 8,
  Accessories = 9, Cables = 10, Books = 11, Other = 12
}

export enum ListingCondition {
  New = 1, LikeNew = 2, Good = 3, Fair = 4, ForParts = 5
}

export const ListingCategoryLabels: Record<ListingCategory, string> = {
  [ListingCategory.Transceiver]: 'Transceiver',
  [ListingCategory.Receiver]: 'Modtager',
  [ListingCategory.Antenna]: 'Antenne',
  [ListingCategory.Amplifier]: 'Forstærker',
  [ListingCategory.PowerSupply]: 'Strømforsyning',
  [ListingCategory.Rotator]: 'Rotator',
  [ListingCategory.Keyer]: 'Nøgle',
  [ListingCategory.SDR]: 'SDR',
  [ListingCategory.Accessories]: 'Tilbehør',
  [ListingCategory.Cables]: 'Kabler',
  [ListingCategory.Books]: 'Bøger',
  [ListingCategory.Other]: 'Andet',
}

export const ListingConditionLabels: Record<ListingCondition, string> = {
  [ListingCondition.New]: 'Ny',
  [ListingCondition.LikeNew]: 'Som ny',
  [ListingCondition.Good]: 'God',
  [ListingCondition.Fair]: 'Rimelig',
  [ListingCondition.ForParts]: 'Til reservedele',
}

export interface ListingImage {
  id: number
  url: string
}

export interface Listing {
  id: number
  userId: string
  sellerCallsign: string | null
  sellerEmail: string | null
  title: string
  description: string
  price: number
  currency: string
  category: ListingCategory
  categoryName: string
  condition: ListingCondition
  conditionName: string
  isActive: boolean
  isSold: boolean
  images: ListingImage[]
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: number
  senderId: string
  senderCallsign: string | null
  recipientId: string
  recipientCallsign: string | null
  subject: string
  body: string
  isRead: boolean
  createdAt: string
}

export interface Post {
  id: number
  userId: string
  authorCallsign: string | null
  authorName: string | null
  content: string
  images: string[]
  likeCount: number
  isLikedByMe: boolean
  commentCount: number
  createdAt: string
  updatedAt: string
}

export interface PostComment {
  id: number
  postId: number
  userId: string
  authorCallsign: string | null
  content: string
  createdAt: string
}

export interface QrzCallsignInfo {
  callsign: string
  name: string | null
  country: string | null
  grid: string | null
  dxcc: number | null
  qslVia: string | null
  imageUrl: string | null
  email: string | null
}
