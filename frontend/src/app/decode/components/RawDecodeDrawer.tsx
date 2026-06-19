'use client'

import { useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, type ColDef, type RowClassRules } from 'ag-grid-community'
import { Card, CardContent } from '@/components/ui/Card'
import { useLanguage } from '@/i18n/LanguageContext'
import { formatTime, snrText } from '../decodeFormatters'
import { type DecodeLogStatus, type DecodeRow } from '../decodeScoring'

ModuleRegistry.registerModules([AllCommunityModule])

type RawDecodeDrawerProps = {
  open: boolean
  rows: DecodeRow[]
  onClose: () => void
  onSelectDecode: (decode: DecodeRow) => void
}

export default function RawDecodeDrawer({ open, rows, onClose, onSelectDecode }: RawDecodeDrawerProps) {
  const gridRef = useRef<AgGridReact<DecodeRow>>(null)
  const { t } = useLanguage()

  const columnDefs = useMemo<ColDef<DecodeRow>[]>(() => [
    {
      headerName: t('decode.raw.time'),
      field: 'decodedAt',
      width: 105,
      valueFormatter: p => p.value ? formatTime(p.value) : '',
      sort: 'desc',
      filter: 'agDateColumnFilter',
    },
    {
      headerName: t('decode.raw.callsign'),
      field: 'dxCallsign',
      width: 150,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: t('decode.raw.status'),
      field: 'logStatus',
      width: 120,
      filter: 'agTextColumnFilter',
      cellRenderer: ({ value }: { value?: DecodeLogStatus }) => (
        <span className={`hamhub-log-pill hamhub-log-pill-${value ?? 'unknown'}`}>{logStatusLabel(value ?? 'unknown', t)}</span>
      ),
    },
    { headerName: 'Grid', field: 'dxGrid', width: 95, filter: 'agTextColumnFilter', valueFormatter: p => p.value ?? '-' },
    {
      headerName: 'SNR',
      field: 'snr',
      width: 85,
      filter: 'agNumberColumnFilter',
      valueFormatter: p => typeof p.value === 'number' ? snrText(p.value) : '',
      cellClass: p => Number(p.value) >= 0 ? 'hamhub-snr-good' : Number(p.value) >= -10 ? 'hamhub-snr-fair' : 'hamhub-snr-weak',
    },
    {
      headerName: t('decode.raw.frequency'),
      field: 'frequencyMhz',
      width: 105,
      filter: 'agNumberColumnFilter',
      valueFormatter: p => typeof p.value === 'number' ? p.value.toFixed(3) : '',
    },
    { headerName: 'Mode', field: 'displayMode', width: 85, filter: 'agTextColumnFilter' },
    { headerName: t('decode.raw.message'), field: 'message', flex: 1, minWidth: 220, filter: 'agTextColumnFilter' },
    { headerName: t('qso.country'), field: 'country', width: 150, filter: 'agTextColumnFilter' },
  ], [t])

  const defaultColDef = useMemo<ColDef<DecodeRow>>(() => ({
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
  }), [])

  const rowClassRules = useMemo<RowClassRules<DecodeRow>>(() => ({
    'hamhub-row-worked': params => params.data?.logStatus === 'worked',
    'hamhub-row-new-grid': params => params.data?.logStatus === 'new-grid',
    'hamhub-row-new-station': params => params.data?.logStatus === 'new-station',
    'hamhub-callable-row': params => Boolean(params.data?.canRespond),
    'hamhub-calling-me-row': params => Boolean(params.data?.callsMe),
  }), [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-4 py-6">
      <Card className="mx-auto h-full max-w-7xl overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{t('decode.raw.title')}</h2>
              <p className="text-xs text-gray-500">{t('decode.raw.description', { count: rows.length })}</p>
            </div>
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-300 hover:text-white" aria-label={t('decode.raw.closeAria')}>
              {t('common.close')}
            </button>
          </div>
          <div className="ag-theme-quartz-dark hamhub-decode-grid min-h-0 flex-1">
            <AgGridReact<DecodeRow>
              ref={gridRef}
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              animateRows
              rowHeight={38}
              headerHeight={42}
              floatingFiltersHeight={36}
              rowClassRules={rowClassRules}
              onRowClicked={event => {
                if (event.data) {
                  onSelectDecode(event.data)
                  onClose()
                }
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function logStatusLabel(status: DecodeLogStatus, t: ReturnType<typeof useLanguage>['t']) {
  if (status === 'worked') return t('decode.logStatus.worked')
  if (status === 'new-grid') return t('decode.logStatus.newGrid')
  if (status === 'new-station') return t('decode.logStatus.newStation')
  return t('common.unknown')
}
