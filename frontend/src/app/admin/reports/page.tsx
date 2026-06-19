'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { type ContentReport, ReportStatus } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { pageShellClass } from '@/lib/layout'

export default function AdminReportsPage() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const [reports, setReports] = useState<ContentReport[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ReportStatus | undefined>(ReportStatus.Open)

  const statusLabel: Record<ReportStatus, string> = {
    [ReportStatus.Open]: t('admin.reports.status.open'),
    [ReportStatus.Resolved]: t('admin.reports.status.resolved'),
    [ReportStatus.Dismissed]: t('admin.reports.status.dismissed'),
  }

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
    toast(t('admin.reports.resolvedToast'))
    load()
  }

  const dismiss = async (id: number) => {
    await api.admin.dismissReport(id)
    toast(t('admin.reports.dismissedToast'))
    load()
  }

  return (
    <div className={pageShellClass}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-white">{t('admin.reports.title')}</h1>
        <select
          value={filter ?? ''}
          onChange={(event) => setFilter(event.target.value ? Number(event.target.value) as ReportStatus : undefined)}
          className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
        >
          <option value="">{t('admin.reports.filter.all')}</option>
          <option value={ReportStatus.Open}>{t('admin.reports.filter.open')}</option>
          <option value={ReportStatus.Resolved}>{t('admin.reports.filter.resolved')}</option>
          <option value={ReportStatus.Dismissed}>{t('admin.reports.filter.dismissed')}</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-gray-400">{t('common.loading')}</p>
          ) : reports.length === 0 ? (
            <p className="p-6 text-gray-400">{t('admin.reports.empty')}</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {reports.map((report) => (
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
                      <div className="mb-1 text-xs uppercase tracking-wide text-gray-600">{t('admin.reports.reportedContent')}</div>
                      <p className="whitespace-pre-wrap text-sm text-gray-300">{report.context}</p>
                    </div>
                  )}
                  <p className="mb-3 text-xs text-gray-500">
                    {t('admin.reports.reportedBy', { reporter: String(report.reporterCallsign || report.reporterId) })}
                  </p>
                  {report.status === ReportStatus.Open && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => resolve(report.id)}>{t('admin.reports.markResolved')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => dismiss(report.id)}>{t('admin.reports.dismiss')}</Button>
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
