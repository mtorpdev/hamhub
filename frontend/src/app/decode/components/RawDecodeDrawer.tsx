'use client'

import { useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, type ColDef, type RowClassRules } from 'ag-grid-community'
import { Card, CardContent } from '@/components/ui/Card'
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

  const columnDefs = useMemo<ColDef<DecodeRow>[]>(() => [
    {
      headerName: 'Tid',
      field: 'decodedAt',
      width: 105,
      valueFormatter: p => p.value ? formatTime(p.value) : '',
      sort: 'desc',
      filter: 'agDateColumnFilter',
    },
    {
      headerName: 'Kaldesignal',
      field: 'dxCallsign',
      width: 150,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Status',
      field: 'logStatus',
      width: 120,
      filter: 'agTextColumnFilter',
      cellRenderer: ({ value }: { value?: DecodeLogStatus }) => (
        <span className={`hamhub-log-pill hamhub-log-pill-${value ?? 'unknown'}`}>{logStatusLabel(value ?? 'unknown')}</span>
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
      headerName: 'Freq',
      field: 'frequencyMhz',
      width: 105,
      filter: 'agNumberColumnFilter',
      valueFormatter: p => typeof p.value === 'number' ? p.value.toFixed(3) : '',
    },
    { headerName: 'Mode', field: 'displayMode', width: 85, filter: 'agTextColumnFilter' },
    { headerName: 'Besked', field: 'message', flex: 1, minWidth: 220, filter: 'agTextColumnFilter' },
    { headerName: 'Land', field: 'country', width: 150, filter: 'agTextColumnFilter' },
  ], [])

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
              <h2 className="text-sm font-semibold text-white">Raw decodes</h2>
              <p className="text-xs text-gray-500">Debugvisning af de seneste {rows.length} decodes</p>
            </div>
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-300 hover:text-white" aria-label="Luk raw decodes">
              Luk
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

function logStatusLabel(status: DecodeLogStatus) {
  if (status === 'worked') return 'Kørt'
  if (status === 'new-grid') return 'Ny grid'
  if (status === 'new-station') return 'Ny station'
  return 'Ukendt'
}
