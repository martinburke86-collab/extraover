import { requireProjectRole } from '@/lib/pageAuth'
import { initDB, db } from '@/lib/db'
import { PageHeader } from '@/components/ui'
import { CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { clx } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ChecksPage({ params }: { params: { id: string } }) {
  await requireProjectRole(params.id, 'editor')
  await initDB()
  const pid = params.id

  async function n(sql: string, args: any[] = []): Promise<number> {
    const r = await db.execute({ sql, args })
    return Number(Object.values(r.rows[0] ?? {})[0] ?? 0)
  }

  const [
    ctdMissing, commMissing, fcstMissing,
    ctdNoCode,  commNoCode,
    codesMissingTrade, codesMissingCat,
    tradesNoCert,
    contractMissing, datesMissing,
    totalCodes, totalCTD, totalFcst, totalComm,
  ] = await Promise.all([
    n(`SELECT COUNT(*) FROM cost_lines cl LEFT JOIN cost_codes cc ON cl.cost_code_id=cc.id WHERE cl.project_id=? AND cc.id IS NULL`, [pid]),
    n(`SELECT COUNT(*) FROM committed_lines c LEFT JOIN cost_codes cc ON c.cost_code_id=cc.id WHERE c.project_id=? AND cc.id IS NULL`, [pid]),
    n(`SELECT COUNT(*) FROM forecast_lines f LEFT JOIN cost_codes cc ON f.cost_code_id=cc.id WHERE f.project_id=? AND cc.id IS NULL`, [pid]),
    n(`SELECT COUNT(*) FROM cost_lines WHERE project_id=? AND (posted_cost>0 OR accruals>0) AND cost_code_id NOT IN (SELECT id FROM cost_codes WHERE project_id=?)`, [pid, pid]),
    n(`SELECT COUNT(*) FROM committed_lines WHERE project_id=? AND total>0 AND cost_code_id NOT IN (SELECT id FROM cost_codes WHERE project_id=?)`, [pid, pid]),
    n(`SELECT COUNT(*) FROM cost_codes WHERE project_id=? AND (trade IS NULL OR trade='')`, [pid]),
    n(`SELECT COUNT(*) FROM cost_codes WHERE project_id=? AND (category IS NULL OR category='')`, [pid]),
    n(`SELECT COUNT(*) FROM trades t WHERE t.project_id=? AND t.value_certified=0 AND EXISTS (SELECT 1 FROM cost_lines cl JOIN cost_codes cc ON cl.cost_code_id=cc.id WHERE cc.trade=t.name AND cc.project_id=t.project_id AND cl.posted_cost>0)`, [pid]),
    n(`SELECT CASE WHEN contract_sum=0 OR contract_sum IS NULL THEN 1 ELSE 0 END FROM projects WHERE id=?`, [pid]),
    n(`SELECT CASE WHEN (revised_start IS NULL OR revised_finish IS NULL) THEN 1 ELSE 0 END FROM projects WHERE id=?`, [pid]),
    n(`SELECT COUNT(*) FROM cost_codes WHERE project_id=?`, [pid]),
    n(`SELECT COUNT(*) FROM cost_lines WHERE project_id=?`, [pid]),
    n(`SELECT COUNT(*) FROM forecast_lines WHERE project_id=?`, [pid]),
    n(`SELECT COUNT(*) FROM committed_lines WHERE project_id=?`, [pid]),
  ])

  type Sev = 'error' | 'warn' | 'ok' | 'info'
  function sev(issues: number, isError = true): Sev {
    return issues === 0 ? 'ok' : isError ? 'error' : 'warn'
  }

  interface Check { label: string; count: number; severity: Sev; desc: string; action: string; link?: string }

  const checks: Check[] = [
    { label: 'Unrecognised codes in Cost to Date', count: ctdMissing,        severity: sev(ctdMissing),        desc: 'CTD lines whose cost code has no matching record in Cost Codes master.', action: 'Add the missing codes to Cost Codes, then re-link.', link: 'cost-to-date' },
    { label: 'Unrecognised codes in Committed',    count: commMissing,       severity: sev(commMissing),       desc: 'Committed lines with a cost code not found in the master register.',  action: 'Add the missing codes to Cost Codes.', link: 'committed' },
    { label: 'Unrecognised codes in Forecast',     count: fcstMissing,       severity: sev(fcstMissing),       desc: 'Forecast lines with a cost code not found in the master register.',    action: 'Add the missing codes to Cost Codes.', link: 'forecast' },
    { label: 'Costs in CTD with no code',          count: ctdNoCode,         severity: sev(ctdNoCode),         desc: 'CTD lines with a cost/accrual but no valid code — will not roll up to any trade.', action: 'Assign a Cost Code to all non-zero CTD lines.', link: 'cost-to-date' },
    { label: 'Committed values with no code',      count: commNoCode,        severity: sev(commNoCode),        desc: 'Committed lines with a value but no valid code.',                      action: 'Assign a Cost Code to all non-zero committed lines.', link: 'committed' },
    { label: 'Cost codes missing Trade',           count: codesMissingTrade, severity: sev(codesMissingTrade, false), desc: 'Codes with no Trade — these will not appear in any trade total on CVR Trade.', action: 'Go to Cost Codes → assign a Trade to every code.', link: 'cost-codes' },
    { label: 'Cost codes missing Category',        count: codesMissingCat,   severity: sev(codesMissingCat, false),  desc: 'Codes with no Category (Labour/Plant/Materials/Subcontractor/Indirect).', action: 'Go to Cost Codes → assign a Category to every code.', link: 'cost-codes' },
    { label: 'Active trades without Value Certified', count: tradesNoCert,   severity: sev(tradesNoCert, false),  desc: 'Trades with posted costs but Value Certified = 0 — likely underclaiming.', action: 'Go to CVR Trade → enter Value Certified for all active trades.', link: 'trade' },
    { label: 'Contract sum entered',               count: contractMissing,   severity: sev(contractMissing),   desc: 'Contract Sum must be set for all financial KPIs to calculate correctly.', action: 'Go to Settings → enter the Original Contract Sum.', link: 'settings' },
    { label: 'Programme dates entered',            count: datesMissing,      severity: sev(datesMissing, false), desc: 'Revised Start and Finish dates needed for weeks elapsed/remaining.', action: 'Go to Settings → enter the programme dates.', link: 'settings' },
    { label: 'Cost codes in register',             count: totalCodes,        severity: totalCodes > 0 ? 'ok' : 'warn',  desc: 'Total cost codes defined in master.', action: 'Add cost codes to the Cost Code register.', link: 'cost-codes' },
    { label: 'Cost to Date lines',                 count: totalCTD,          severity: totalCTD > 0 ? 'ok' : 'info',   desc: 'Total posted cost lines entered.', action: 'Add posted costs to Cost to Date.', link: 'cost-to-date' },
    { label: 'Forecast lines',                     count: totalFcst,         severity: totalFcst > 0 ? 'ok' : 'warn',  desc: 'Forecast lines driving EFC on Dashboard.', action: 'Add forecast lines to generate an EFC.', link: 'forecast' },
    { label: 'Committed lines',                    count: totalComm,         severity: totalComm > 0 ? 'ok' : 'info',  desc: 'Total committed orders/subcontracts logged.', action: 'Add committed lines for all placed orders.', link: 'committed' },
  ]

  const errors   = checks.filter(c => c.severity === 'error').length
  const warnings = checks.filter(c => c.severity === 'warn').length
  const oks      = checks.filter(c => c.severity === 'ok').length
  const overall  = errors > 0 ? 'error' : warnings > 0 ? 'warn' : 'ok'

  const sevCfg: Record<Sev, { icon: JSX.Element; rowCls: string; badgeCls: string; label: string }> = {
    error: { icon: <XCircle size={17} className="text-red-500 flex-shrink-0 mt-0.5" />, rowCls: 'border-red-200',   badgeCls: 'bg-red-100 text-red-700',     label: 'ERRORS — must fix before locking period' },
    warn:  { icon: <AlertCircle size={17} className="text-amber-500 flex-shrink-0 mt-0.5" />, rowCls: 'border-amber-200', badgeCls: 'bg-amber-100 text-amber-700', label: 'WARNINGS — should fix' },
    ok:    { icon: <CheckCircle size={17} className="text-green-500 flex-shrink-0 mt-0.5" />, rowCls: 'border-green-100', badgeCls: 'bg-green-100 text-green-700', label: 'PASSING' },
    info:  { icon: <AlertCircle size={17} className="text-blue-400 flex-shrink-0 mt-0.5" />,  rowCls: 'border-blue-100',  badgeCls: 'bg-blue-100 text-blue-600',   label: 'INFORMATIONAL' },
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader
        title="Data Quality Checks"
        subtitle={`${oks} passing · ${warnings} warnings · ${errors} errors — refreshes on every load`}
        actions={
          <div className={clx('px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-2',
            overall === 'ok' ? 'bg-green-50 text-green-700' : overall === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
          )}>
            {overall === 'ok' ? <CheckCircle size={14}/> : overall === 'error' ? <XCircle size={14}/> : <AlertCircle size={14}/>}
            {overall === 'ok' ? 'All critical checks passing' : overall === 'error' ? `${errors} error${errors>1?'s':''} need attention` : `${warnings} warning${warnings>1?'s':''} to review`}
          </div>
        }
      />

      {/* Count strip */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-4 flex-shrink-0">
        {[['Errors', errors, 'bg-red-100 text-red-700'], ['Warnings', warnings, 'bg-amber-100 text-amber-700'], ['Passing', oks, 'bg-green-100 text-green-700']].map(([l, c, cls]) => (
          <div key={l as string} className={clx('px-4 py-2 rounded-lg flex items-center gap-2.5', cls as string)}>
            <span className="text-2xl font-bold tabular-nums">{c as number}</span>
            <span className="text-sm font-medium">{l as string}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="max-w-3xl">
          {(['error','warn','ok','info'] as Sev[]).map(sev => {
            const group = checks.filter(c => c.severity === sev)
            if (!group.length) return null
            const cfg = sevCfg[sev]
            return (
              <div key={sev} className="mb-5">
                <div className={clx('text-[10px] font-bold uppercase tracking-widest mb-2.5 px-2 py-1 rounded',
                  sev==='error'?'text-red-700 bg-red-50':sev==='warn'?'text-amber-700 bg-amber-50':sev==='ok'?'text-green-700 bg-green-50':'text-blue-600 bg-blue-50'
                )}>
                  {cfg.label}
                </div>
                <div className="space-y-2">
                  {group.map((check, i) => (
                    <div key={i} className={clx('bg-white rounded-lg border px-5 py-3.5 flex items-start gap-3.5', cfg.rowCls)}>
                      {cfg.icon}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-semibold text-gray-800 text-sm leading-snug">{check.label}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={clx('font-bold tabular-nums text-base min-w-[24px] text-right',
                              check.severity==='error'&&check.count>0?'text-red-600':check.severity==='warn'&&check.count>0?'text-amber-600':'text-gray-400'
                            )}>{check.count}</span>
                            <span className={clx('text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap', cfg.badgeCls)}>
                              {check.severity==='ok' ? '✔ OK' : check.count>0 ? `✖ ${check.count}` : '✔ OK'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{check.desc}</p>
                        {(check.severity==='error'||check.severity==='warn') && check.count>0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span className={clx('text-[11px] rounded px-2.5 py-1 leading-relaxed',
                              check.severity==='error'?'text-red-700 bg-red-50':'text-amber-700 bg-amber-50'
                            )}>→ {check.action}</span>
                            {check.link && (
                              <Link href={`/${params.id}/${check.link}`}
                                className={clx('inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded font-semibold whitespace-nowrap',
                                  check.severity==='error'?'bg-red-600 text-white hover:bg-red-700':'bg-amber-500 text-white hover:bg-amber-600'
                                )}>
                                Fix now <ExternalLink size={9}/>
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
