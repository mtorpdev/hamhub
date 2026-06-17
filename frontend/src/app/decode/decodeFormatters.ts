import { Band, BandLabels, Mode } from '@/lib/types'

export function snrText(snr: number) {
  return snr > 0 ? `+${snr}` : String(snr)
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function bandModeKey(callsign: string, band: Band | number | string, mode: Mode | number | string) {
  return `${callsign.toUpperCase()}|${Number(band)}|${Number(mode)}`
}

export function modeToEnum(displayMode: string): Mode | null {
  const normalized = displayMode.toUpperCase()
  if (normalized === 'SSB') return Mode.SSB
  if (normalized === 'CW') return Mode.CW
  if (normalized === 'FT8') return Mode.FT8
  if (normalized === 'FT4') return Mode.FT4
  if (normalized === 'RTTY') return Mode.RTTY
  if (normalized === 'DMR') return Mode.DMR
  if (normalized === 'FM') return Mode.FM
  if (normalized === 'AM') return Mode.AM
  return null
}

export function bandFromFrequency(frequencyMhz: number): Band | null {
  if (frequencyMhz >= 1.8 && frequencyMhz < 2) return Band.M160
  if (frequencyMhz >= 3.5 && frequencyMhz < 4) return Band.M80
  if (frequencyMhz >= 5 && frequencyMhz < 5.5) return Band.M60
  if (frequencyMhz >= 7 && frequencyMhz < 7.3) return Band.M40
  if (frequencyMhz >= 10 && frequencyMhz < 10.2) return Band.M30
  if (frequencyMhz >= 14 && frequencyMhz < 14.35) return Band.M20
  if (frequencyMhz >= 18 && frequencyMhz < 18.2) return Band.M17
  if (frequencyMhz >= 21 && frequencyMhz < 21.45) return Band.M15
  if (frequencyMhz >= 24.8 && frequencyMhz < 25) return Band.M12
  if (frequencyMhz >= 28 && frequencyMhz < 29.7) return Band.M10
  if (frequencyMhz >= 50 && frequencyMhz < 54) return Band.M6
  if (frequencyMhz >= 144 && frequencyMhz < 148) return Band.M2
  if (frequencyMhz >= 430 && frequencyMhz < 450) return Band.CM70
  return null
}

export function bandModeLabel(row: { frequencyMhz: number; displayMode: string }) {
  const band = bandFromFrequency(row.frequencyMhz)
  const bandLabel = band ? BandLabels[band] : `${row.frequencyMhz.toFixed(3)} MHz`
  return `${bandLabel} / ${row.displayMode}`
}

export function normalizeDecodeMode(decode: { mode?: string | null }) {
  const mode = decode.mode?.toUpperCase()
  if (mode === 'FT8' || mode === '~') return 'FT8'
  if (mode === 'FT4' || mode === '+') return 'FT4'
  return mode || '-'
}

export function normalizeCallsignForCountry(callsign: string | null) {
  return callsign
    ?.toUpperCase()
    .replace(/[<>]/g, '')
    .split('/')[0]
    .replace(/[^A-Z0-9]/g, '') ?? ''
}

export function callsignPrefix(callsign: string | null | undefined) {
  const normalized = normalizeCallsignForCountry(callsign ?? null)
  if (!normalized) return ''
  const lastDigit = Math.max(...normalized.split('').map((character, index) => /\d/.test(character) ? index : -1))
  return lastDigit >= 0 ? normalized.slice(0, lastDigit + 1) : normalized.slice(0, Math.min(3, normalized.length))
}

export function normalizeCountry(country: string | null | undefined) {
  const value = country?.trim()
  if (!value || value === '-' || value.toLowerCase() === 'ukendt') return ''
  return value
}

export function countryKey(country: string | null | undefined) {
  return normalizeCountry(country).toLowerCase()
}

export function countryDisplay(country: string) {
  return country
    .split(/(\s+|\/|-)/)
    .map(part => /^[a-zæøå]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part)
    .join('')
}

export const CONTINENTS = ['EU', 'NA', 'SA', 'AF', 'AS', 'OC', 'AN'] as const

export const CONTINENT_LABELS: Record<string, string> = {
  EU: 'Europa',
  NA: 'Nordamerika',
  SA: 'Sydamerika',
  AF: 'Afrika',
  AS: 'Asien',
  OC: 'Oceanien',
  AN: 'Antarktis',
}

const COUNTRY_CONTINENTS: Record<string, string> = {
  australien: 'OC',
  belgien: 'EU',
  bulgarien: 'EU',
  canada: 'NA',
  danmark: 'EU',
  frankrig: 'EU',
  graekenland: 'EU',
  grækenland: 'EU',
  holland: 'EU',
  indonesien: 'OC',
  italien: 'EU',
  japan: 'AS',
  kasakhstan: 'AS',
  'kina/taiwan': 'AS',
  kroatien: 'EU',
  nederlandene: 'EU',
  'new zealand': 'OC',
  nordirland: 'EU',
  norge: 'EU',
  polen: 'EU',
  rumænien: 'EU',
  rumaenien: 'EU',
  rusland: 'EU',
  schweiz: 'EU',
  skotland: 'EU',
  slovakiet: 'EU',
  slovenien: 'EU',
  spanien: 'EU',
  sverige: 'EU',
  sydkorea: 'AS',
  tjekkiet: 'EU',
  tyrkiet: 'AS',
  tyskland: 'EU',
  ungarn: 'EU',
  usa: 'NA',
  wales: 'EU',
  østrig: 'EU',
  oestrig: 'EU',
  austria: 'EU',
  belgium: 'EU',
  bulgaria: 'EU',
  croatia: 'EU',
  'czech republic': 'EU',
  denmark: 'EU',
  england: 'EU',
  finland: 'EU',
  france: 'EU',
  germany: 'EU',
  greece: 'EU',
  hungary: 'EU',
  israel: 'AS',
  italy: 'EU',
  netherlands: 'EU',
  norway: 'EU',
  poland: 'EU',
  romania: 'EU',
  russia: 'EU',
  slovakia: 'EU',
  slovenia: 'EU',
  spain: 'EU',
  sweden: 'EU',
  switzerland: 'EU',
  turkey: 'AS',
  ukraine: 'EU',
  'united states': 'NA',
}

const CALLSIGN_COUNTRY_PREFIXES: Array<[RegExp, string]> = [
  [/^(?:OZ|OU|OV|OX|OY)/, 'Danmark'],
  [/^(?:DL|DA|DB|DC|DD|DE|DF|DG|DH|DJ|DK|DM|DN|DO|DP|DQ|DR)/, 'Tyskland'],
  [/^(?:EA|EB|EC|ED|EE|EF|AM|AN|AO)/, 'Spanien'],
  [/^(?:F|TM|TO|TX)/, 'Frankrig'],
  [/^(?:G|M|2E|2M|2W)/, 'England'],
  [/^(?:GM|MM)/, 'Skotland'],
  [/^(?:GW|MW)/, 'Wales'],
  [/^(?:GI|MI)/, 'Nordirland'],
  [/^(?:I|IK|IW|IZ|IU|II|IR)/, 'Italien'],
  [/^(?:PA|PB|PC|PD|PE|PF|PG|PH|PI)/, 'Nederlandene'],
  [/^(?:ON|OO|OP|OQ|OR|OS|OT)/, 'Belgien'],
  [/^(?:SM|SA|SB|SC|SD|SE|SF|SG|SH|SI|SJ|SK|SL)/, 'Sverige'],
  [/^(?:LA|LB|LC|LD|LE|LF|LG|LH|LI|LJ|LK|LL|LM|LN)/, 'Norge'],
  [/^(?:OH|OF|OG|OI)/, 'Finland'],
  [/^(?:SP|SQ|SN|SO|HF|3Z)/, 'Polen'],
  [/^(?:OK|OL)/, 'Tjekkiet'],
  [/^(?:OM)/, 'Slovakiet'],
  [/^(?:OE)/, 'Ostrig'],
  [/^(?:HB9|HE|HB)/, 'Schweiz'],
  [/^(?:S5)/, 'Slovenien'],
  [/^(?:9A)/, 'Kroatien'],
  [/^(?:HA|HG)/, 'Ungarn'],
  [/^(?:YO|YR|YP|YQ)/, 'Rumaenien'],
  [/^(?:LZ)/, 'Bulgarien'],
  [/^(?:SV|SX|SY|SZ)/, 'Graekenland'],
  [/^(?:TA|TC)/, 'Tyrkiet'],
  [/^(?:UR|US|UT|UU|UV|UW|UX|UY|UZ|EM|EN|EO)/, 'Ukraine'],
  [/^(?:R|RA|RB|RC|RD|RE|RF|RG|RJ|RK|RL|RM|RN|RO|RQ|RT|RU|RV|RW|RX|RY|RZ|UA|UB|UC|UD|UF|UG|UI)/, 'Rusland'],
  [/^(?:UN|UP|UQ)/, 'Kasakhstan'],
  [/^(?:4X|4Z)/, 'Israel'],
  [/^(?:JA|JE|JF|JG|JH|JI|JJ|JK|JL|JM|JN|JO|JP|JQ|JR|JS|7J|7K|7L|7M|7N|8J|8N)/, 'Japan'],
  [/^(?:HL|DS|DT|D7|D8|D9|6K|6L|6M|6N)/, 'Sydkorea'],
  [/^(?:BY|BD|BG|BH|BI|BJ|BL|BM|BN|BO|BP|BQ|BR|BS|BT|BU|BV|BW|BX)/, 'Kina/Taiwan'],
  [/^(?:VK|AX|VI|VJ|VL|VM|VN|VZ)/, 'Australien'],
  [/^(?:ZL|ZM)/, 'New Zealand'],
  [/^(?:YB|YC|YD|YE|YF|YG|YH)/, 'Indonesien'],
  [/^(?:VE|VA|VO|VY)/, 'Canada'],
  [/^(?:K|N|W|AA|AB|AC|AD|AE|AF|AG|AI|AJ|AK)/, 'USA'],
]

export function continentFromCountry(country: string | null | undefined) {
  const key = countryKey(country)
  if (!key) return ''
  return COUNTRY_CONTINENTS[key] ?? ''
}

export function countryFromCallsign(callsign: string | null) {
  const normalized = normalizeCallsignForCountry(callsign)
  if (!normalized) return '-'
  return CALLSIGN_COUNTRY_PREFIXES.find(([pattern]) => pattern.test(normalized))?.[1] ?? 'Ukendt'
}
