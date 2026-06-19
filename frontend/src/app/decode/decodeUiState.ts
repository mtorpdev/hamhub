import { type DecodeRow, type LiveRosterEntry } from './decodeScoring'

export function commandDecodeForEntry(entry: LiveRosterEntry) {
  return entry.decodes.find(row => row.callsMe && row.canRespond) ?? entry.latest
}

export function selectedCallsignForCommand(currentCallsign: string, decode: DecodeRow) {
  return decode.dxCallsign?.trim().toUpperCase() || currentCallsign
}

export function commandResultMessage(
  result: { success: boolean; message: string },
  errorPrefix = 'WSJT-X agent error',
  fallback = 'Command failed.',
) {
  if (result.success) return result.message
  return `${errorPrefix}: ${result.message || fallback}`
}
