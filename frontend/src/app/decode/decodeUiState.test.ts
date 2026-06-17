import test from 'node:test'
import assert from 'node:assert/strict'
import { commandDecodeForEntry, commandResultMessage, selectedCallsignForCommand } from './decodeUiState'
import { type DecodeRow, type LiveRosterEntry } from './decodeScoring'

function row(overrides: Partial<DecodeRow>): DecodeRow {
  return {
    id: 1,
    wsjtxId: 'WSJT-X',
    wsjtxTimeMs: 1,
    spotterCallsign: 'OZ1ME',
    spotterGrid: 'JO65',
    message: 'CQ DL1ABC JO62',
    dxCallsign: 'DL1ABC',
    dxGrid: 'JO62',
    snr: -5,
    deltaTime: 0.2,
    deltaFreqHz: 1500,
    frequencyMhz: 14.074,
    mode: 'FT8',
    lowConfidence: false,
    isCallable: true,
    dxCountry: 'Germany',
    dxContinent: 'EU',
    dxPrimaryPrefix: 'DL',
    dxMatchedPrefix: 'DL',
    dxWpxPrefix: 'DL1',
    dxCqZone: 14,
    dxItuZone: 28,
    dxLatitude: 51,
    dxLongitude: 10,
    dxUtcOffset: 1,
    decodedAt: '2026-06-17T10:00:00Z',
    distanceKm: 420,
    logStatus: 'new-station',
    displayMode: 'FT8',
    country: 'Germany',
    continent: 'EU',
    prefix: 'DL1',
    callsMe: false,
    canRespond: true,
    isNewBandMode: false,
    wantedReasons: ['new-station'],
    awardReasons: ['dxcc', 'grid'],
    ...overrides,
  }
}

test('locks selected callsign to the command target', () => {
  assert.equal(selectedCallsignForCommand('', row({ dxCallsign: 'dl1abc' })), 'DL1ABC')
})

test('keeps current selected callsign when command has no target callsign', () => {
  assert.equal(selectedCallsignForCommand('EA1OLD', row({ dxCallsign: null })), 'EA1OLD')
})

test('formats successful command results from the agent', () => {
  assert.equal(commandResultMessage({ success: true, message: 'Stop Tx sendt til WSJT-X.' }), 'Stop Tx sendt til WSJT-X.')
})

test('formats failed command results from the agent', () => {
  assert.equal(commandResultMessage({ success: false, message: 'WSJT-X kontrol Stop Tx er ikke aktiv.' }), 'Fejl fra WSJT-X agent: WSJT-X kontrol Stop Tx er ikke aktiv.')
})

test('uses latest calling-me decode as command target even when another message is newer', () => {
  const callingMe = row({
    id: 1,
    message: 'DL1ABC OZ1ME -10',
    callsMe: true,
    canRespond: true,
    decodedAt: '2026-06-17T10:00:00Z',
  })
  const newerNonReply = row({
    id: 2,
    message: 'DL1ABC F4XYZ 73',
    callsMe: false,
    canRespond: false,
    decodedAt: '2026-06-17T10:00:15Z',
  })
  const entry = {
    callsign: 'DL1ABC',
    latest: newerNonReply,
    decodes: [newerNonReply, callingMe],
  } as LiveRosterEntry

  assert.equal(commandDecodeForEntry(entry), callingMe)
})
