'use client'

import { type ChangeEventHandler, type FormEventHandler } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BandLabels, ModeLabels, type Qso } from '@/lib/types'
import { formatTime } from '../decodeFormatters'
import { type QsoEditForm } from '../qsoEdit'

type LoggedQsoPopupProps = {
  qso: Qso
  qsoForm: QsoEditForm
  qsoSaving: boolean
  qsoSaveStatus: string | null
  onQsoFieldChange: (key: keyof QsoEditForm) => ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  onSaveLoggedQso: FormEventHandler<HTMLFormElement>
  onClose: () => void
}

export default function LoggedQsoPopup({
  qso,
  qsoForm,
  qsoSaving,
  qsoSaveStatus,
  onQsoFieldChange,
  onSaveLoggedQso,
  onClose,
}: LoggedQsoPopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <form onSubmit={onSaveLoggedQso} className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-lg border border-gray-700 bg-gray-950 shadow-2xl">
        <div className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 bg-gray-950 px-5 py-4">
          <div>
            <p className="text-xs uppercase text-green-300">QSO logget automatisk</p>
            <h2 className="mt-1 font-mono text-2xl font-bold text-white">{qso.workedCallsign}</h2>
            <p className="mt-1 text-sm text-gray-400">
              QSO #{qso.id} fra WSJT-X kl. {formatTime(qso.dateUtc)}. Ret felterne og gem i HamHub.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => window.open(`/logbook/${qso.id}`, '_blank')}>
              Åbn fuld QSO
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800"
              aria-label="Luk logget QSO popup"
            >
              Luk
            </button>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Input label="Dato/tid UTC" type="datetime-local" value={qsoForm.dateUtc} onChange={onQsoFieldChange('dateUtc')} required />
            <Input label="Eget kaldesignal" value={qsoForm.ownCallsign} onChange={onQsoFieldChange('ownCallsign')} required />
            <Input label="Kontaktens kaldesignal" value={qsoForm.workedCallsign} onChange={onQsoFieldChange('workedCallsign')} required />
            <Input label="Frekvens (MHz)" type="number" step="0.001" value={qsoForm.frequency} onChange={onQsoFieldChange('frequency')} />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <SelectField label="Band" value={qsoForm.band} onChange={onQsoFieldChange('band')} options={BandLabels} />
            <SelectField label="Mode" value={qsoForm.mode} onChange={onQsoFieldChange('mode')} options={ModeLabels} />
            <Input label="RST sendt" value={qsoForm.rstSent} onChange={onQsoFieldChange('rstSent')} />
            <Input label="RST modtaget" value={qsoForm.rstReceived} onChange={onQsoFieldChange('rstReceived')} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Kontaktens grid" value={qsoForm.locator} onChange={onQsoFieldChange('locator')} />
            <Input label="Mit grid" value={qsoForm.myGridsquare} onChange={onQsoFieldChange('myGridsquare')} />
            <Input label="Land" value={qsoForm.country} onChange={onQsoFieldChange('country')} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Input label="Navn" value={qsoForm.name} onChange={onQsoFieldChange('name')} />
            <Input label="QTH" value={qsoForm.qth} onChange={onQsoFieldChange('qth')} />
            <Input label="TX effekt (W)" type="number" step="0.1" value={qsoForm.txPower} onChange={onQsoFieldChange('txPower')} />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-300">Kommentar</label>
            <textarea
              rows={3}
              value={qsoForm.comment}
              onChange={onQsoFieldChange('comment')}
              className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 bg-gray-950 px-5 py-4">
          {qsoSaveStatus && <p className="text-sm text-gray-300">{qsoSaveStatus}</p>}
          <Button type="submit" disabled={qsoSaving}>{qsoSaving ? 'Gemmer...' : 'Gem QSO og luk'}</Button>
        </div>
      </form>
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string | number
  options: Record<number, string>
  onChange: ChangeEventHandler<HTMLSelectElement>
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-300">{label}</label>
      <select value={value} onChange={onChange} className="rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white">
        {Object.entries(options).map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </div>
  )
}
