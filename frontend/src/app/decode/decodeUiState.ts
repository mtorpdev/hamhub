import { type DecodeRow, type LiveRosterEntry } from './decodeScoring'

export function commandDecodeForEntry(entry: LiveRosterEntry) {
  return entry.decodes.find(row => row.callsMe && row.canRespond) ?? entry.latest
}

export function selectedCallsignForCommand(currentCallsign: string, decode: DecodeRow) {
  return decode.dxCallsign?.trim().toUpperCase() || currentCallsign
}

export function commandResultMessage(result: { success: boolean; message: string }) {
  if (result.success) return result.message
  return `Fejl fra WSJT-X agent: ${result.message || 'Kommandoen fejlede.'}`
}
