'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { type ContentReport, ReportStatus } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { pageShellClass } from '@/lib/layout'

const statusLabel: Record<ReportStatus, string> = {
  [ReportStatus.Open]: 'Åben',
  [ReportStatus.Resolved]: 'Løst',
  [ReportStatus.Dismissed]: 'Afvist',
}

export default function AdminReportsPage() {
  const { toast } = useToast()
  const [reports, setReports] = useState<ContentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ReportStatus | undefined>(ReportStatus.Open)

  const load = () => {
    setLoading(true)
    api.admin.reports(filter).then(setReports).finally(() => setLoading(false))
  }

  useEffect(() => {
    void Promise.resolve().then(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const resolve = async (id: number) => {
    await api.admin.resolveReport(id)
    toast('Rapport markeret som løst')
    load()
  }

  const dismiss = async (id: number) => {
    await api.admin.dismissReport(id)
    toast('Rapport afvist')
    load()
  }

  return (
    <div className={pageShellClass}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-white">Rapporter</h1>
        <select
          value={filter ?? ''}
          onChange={e => setFilter(e.target.value ? Number(e.target.value) as ReportStatus : undefined)}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Alle</option>
          <option value={ReportStatus.Open}>Åbne</option>
          <option value={ReportStatus.Resolved}>Løste</option>
          <option value={ReportStatus.Dismissed}>Afviste</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-gray-400">Indlæser...</p>
          ) : reports.length === 0 ? (
            <p className="p-6 text-gray-400">Ingen rapporter.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {reports.map(report => (
                <div key={report.id} className="p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={report.status === ReportStatus.Open ? 'warning' : 'secondary'}>{statusLabel[report.status]}</Badge>
                      <span className="text-sm font-semibold text-white">{report.targetType}</span>
                      {report.targetUserCallsign && <span className="font-mono text-sm text-blue-300">{report.targetUserCallsign}</span>}
                      {report.targetId && <span className="text-xs text-gray-500">#{report.targetId}</span>}
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(report.createdAt)}</span>
                  </div>
                  <p className="mb-2 text-sm text-gray-300">{report.reason}</p>
                  {report.context && (
                    <div className="mb-3 rounded-md border border-gray-800 bg-gray-950/60 p-3">
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-600">Rapporteret indhold</div>
                      <p className="whitespace-pre-wrap text-sm text-gray-300">{report.context}</p>
                    </div>
                  )}
                  <p className="mb-3 text-xs text-gray-500">Rapporteret af {report.reporterCallsign || report.reporterId}</p>
                  {report.status === ReportStatus.Open && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => resolve(report.id)}>Marker løst</Button>
                      <Button size="sm" variant="secondary" onClick={() => dismiss(report.id)}>Afvis</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
