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
  qrzConfirmationStatus: string | null
  qrzConfirmedAt: string | null
  qrzQslDate: string | null
  eqslSentAt: string | null
  eqslConfirmedAt: string | null
  eqslLastResult: string | null
  createdAt: string
  updatedAt: string
}

export interface QsoExternalLogStatus {
  provider: string
  status: 'synced' | 'ready' | 'not-configured' | 'sent' | 'confirmed' | 'missing' | string
  label: string
  externalId: string | null
  canSend: boolean
  canFetch: boolean
  description: string
  isConfigured: boolean
  sendActionLabel: string
  fetchActionLabel: string
  lastUpdatedAt: string | null
  lastResult: string | null
}

export interface QsoWeather {
  timeUtc: string
  temperatureC: number | null
  relativeHumidityPercent: number | null
  pressureHpa: number | null
  cloudCoverPercent: number | null
  windSpeedKmh: number | null
  windDirectionDegrees: number | null
  precipitationMm: number | null
}

export interface QsoConditionsLocation {
  callsign: string
  role: string
  grid: string
  latitude: number
  longitude: number
  weather: QsoWeather | null
}

export interface QsoConditions {
  qsoTimeUtc: string
  nearestWeatherHourUtc: string
  ownLocation: QsoConditionsLocation | null
  workedLocation: QsoConditionsLocation | null
  distanceKm: number | null
  bearingDegrees: number | null
  weatherSource: string
  propagation: {
    status: string
    description: string
    source: string
    observedAtUtc: string | null
    kpIndex: number | null
    geomagneticScale: string | null
    radioBlackoutScale: string | null
    solarRadiationScale: string | null
    solarWindSpeedKms: number | null
    solarWindDensity: number | null
    interplanetaryMagneticFieldBz: number | null
    interplanetaryMagneticFieldBt: number | null
    minutesFromQso: number | null
    solarFluxIndex: number | null
    forecastApIndex: number | null
    sunspotNumber: number | null
    solarCyclePhase: string | null
    solarCycleProgressPercent: number | null
    xrayClass: string | null
    xrayFlux: number | null
    dRegionAbsorption: {
      product: string
      impact: string
      sourceUrl: string
    }
    path: {
      ownLight: string
      workedLight: string
      midpointLight: string
      ownSolarElevationDegrees: number
      workedSolarElevationDegrees: number
      midpointSolarElevationDegrees: number
      summary: string
    } | null
    bandConditions: Array<{
      band: string
      rating: string
      reason: string
      isCurrentQsoBand: boolean
    }>
    mufStatus: string
    mufSourceUrl: string
    mufFof2: QsoMufFof2
  }
}

export interface QsoMufFof2 {
  status: string
  source: string
  sourceUrl: string
  retrievedAtUtc: string | null
  ownNearestStation: QsoMufStation | null
  workedNearestStation: QsoMufStation | null
  midpointNearestStation: QsoMufStation | null
  bandRecommendations: QsoMufBandRecommendation[]
  description: string
}

export interface QsoMufStation {
  name: string
  latitude: number
  longitude: number
  distanceKm: number
  fof2Mhz: number | null
  muf3000Mhz: number | null
  confidencePercent: number | null
  source: string | null
  observedAtUtc: string | null
}

export interface QsoMufBandRecommendation {
  band: string
  frequencyMhz: number
  supported: boolean
  reason: string
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
  sourceName: string | null
  sourceUrl: string | null
  originalUrl: string | null
  isExternal: boolean
  categoryId: number
  categoryName: string
  authorId: string
  authorCallsign: string | null
  isPublished: boolean
  publishDate: string | null
  createdAt: string
}

export interface ArticleFeedImportResult {
  imported: number
  skipped: number
  failedFeeds: number
  importedAtUtc: string
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
  frequencyKhz: number
  mode: string
  spotter: string
  info: string
  time: string
  source: string
  retrievedAt: string
}

export interface DashboardStats {
  totalUsers: number
  totalStations: number
  totalQsos: number
  totalDxSpots: number
  totalArticles: number
}

export enum ReportStatus {
  Open = 1,
  Resolved = 2,
  Dismissed = 3
}

export interface ContentReport {
  id: number
  reporterId: string
  reporterCallsign: string | null
  targetType: string
  targetUserId: string | null
  targetUserCallsign: string | null
  targetId: number | null
  reason: string
  context: string | null
  status: ReportStatus
  createdAt: string
  resolvedAt: string | null
}

export interface BlockedUser {
  userId: string
  callsign: string | null
  email: string | null
  name: string | null
  gridLocator: string | null
  country: string | null
  createdAt: string
}

export interface WsjtxDecodeItem {
  id: number
  wsjtxId: string
  wsjtxTimeMs: number
  spotterCallsign: string
  spotterGrid: string | null
  message: string
  dxCallsign: string | null
  dxGrid: string | null
  snr: number
  deltaTime: number
  deltaFreqHz: number
  frequencyMhz: number
  mode: string
  lowConfidence: boolean
  isCallable: boolean
  dxCountry: string | null
  dxContinent: string | null
  dxPrimaryPrefix: string | null
  dxMatchedPrefix: string | null
  dxWpxPrefix: string | null
  dxCqZone: number | null
  dxItuZone: number | null
  dxLatitude: number | null
  dxLongitude: number | null
  dxUtcOffset: number | null
  decodedAt: string
  serverReceivedAtUtc: string
}

export interface WsjtxCommandResult {
  id: string
  type: 'Reply' | 'StopTx' | number
  success: boolean
  message: string
  completedAtUtc: string
}

export interface WsjtxStatus {
  wsjtxId: string
  dxCall: string
  dxGrid: string
  mode: string
  txEnabled: boolean
  transmitting: boolean
  decoding: boolean
  txWatchdog: boolean
  rxDf: number
  txDf: number
  updatedAtUtc: string
  serverReceivedAtUtc: string
}

export interface WsjtxAgentStatus {
  connected: boolean
  lastSeenAtUtc: string | null
}

export interface LotwActivity {
  callsign: string
  lastUploadDate: string
}

export interface QrzStatus {
  connected: boolean
  lastSyncedAt: string | null
  qrzCallsign: string | null
  xmlConnected: boolean
  qrzUsername: string | null
  credentialReadable: boolean | null
  credentialError: boolean
  xmlCredentialReadable: boolean | null
  xmlCredentialError: boolean
  statusMessage: string | null
}

export interface EqslStatus {
  connected: boolean
  username: string | null
  qthNickname: string | null
  lastSyncedAt: string | null
  credentialReadable: boolean | null
  credentialError: boolean
  statusMessage: string | null
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

export interface NotificationSummary {
  unreadMessages: number
  incomingFriendRequests: number
  total: number
}

export enum FriendshipStatus {
  Pending = 1,
  Accepted = 2,
  Declined = 3
}

export interface Friendship {
  id: number
  otherUserId: string
  otherCallsign: string | null
  otherEmail: string | null
  otherName: string | null
  otherGridLocator: string | null
  status: FriendshipStatus
  direction: 'incoming' | 'outgoing' | string
  createdAt: string
  respondedAt: string | null
}

export interface FriendRequests {
  incoming: Friendship[]
  outgoing: Friendship[]
}

export interface FriendCandidate {
  userId: string
  callsign: string | null
  email: string | null
  name: string | null
  gridLocator: string | null
  friendshipStatus: FriendshipStatus | null
  friendshipDirection: 'incoming' | 'outgoing' | string | null
}

export interface CommunityRoom {
  id: number
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isSystem: boolean
}

export interface CommunityContact {
  id: string
  callsign: string | null
  email: string | null
  name: string | null
  profileImageUrl: string | null
  gridLocator: string | null
  country: string | null
}

export interface CommunityOnlineUser {
  id: string
  callsign: string | null
  email: string | null
  name: string | null
  profileImageUrl: string | null
  gridLocator: string | null
  country: string | null
  isFriend: boolean
  friendshipStatus: FriendshipStatus | null
  friendshipDirection: 'incoming' | 'outgoing' | string | null
}

export interface ChatMessage {
  id: number
  userId: string
  authorCallsign: string | null
  communityRoomId: number | null
  communityRoomSlug: string | null
  communityRoomName: string | null
  content: string
  createdAt: string
}

export interface Post {
  id: number
  userId: string
  authorCallsign: string | null
  authorName: string | null
  communityRoomId: number | null
  communityRoomSlug: string | null
  communityRoomName: string | null
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
