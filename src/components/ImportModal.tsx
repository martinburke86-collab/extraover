'use client'
import { useState, useRef } from 'react'
import { Upload, X, Check, AlertTriangle } from 'lucide-react'
import { fmt, clx } from '@/lib/utils'

interface ImportRow {
  code: string
  description?: string
  trade?: string
  postedCost: number
  accruals: number
  subRecon: number
  error?: string
}

interface Props {
  projectId: string
  costCodes: { code: string; description: string; trade: string }[]
  onClose: () => void
  onDone: () => void
}

export default function ImportModal({ projectId, costCodes, onClose, onDone }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows]         = useState<ImportRow[]>([])
  const [step, setStep]         = useState<'upload' | 'preview' | 'done'>('upload')
  const [importing, setImporting] = useState(false)
  const [errors, setErrors]     = useState(0)

  const codeSet = new Set(costCodes.map(c => c.code))

  function parseCSV(text: string): ImportRow[] {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const header = lines[0].toLowerCase().split(',').map(h => h.replace(/["\r]/g, '').trim())

    // Detect columns flexibly
    const idx = (keys: string[]) => {
      for (const k of keys) {
        const i = header.findIndex(h => h.includes(k))
        if (i >= 0) return i
      }
      return -1
    }
    const codeIdx    = idx(['code','cost code','account'])
    const postedIdx  = idx(['posted','actual','cost','amount','debit'])
    const accIdx     = idx(['accru','provision'])
    const subReconIdx= idx(['recon','sub recon'])

    if (codeIdx < 0 || postedIdx < 0) {
      return [{ code: '(parse error)', postedCost: 0, accruals: 0, subRecon: 0,
                error: `Could not find Code and Posted columns. Headers found: ${header.join(', ')}` }]
    }

    return lines.slice(1).filter(l => l.trim()).map(line => {
      const cols = line.split(',').map(c => c.replace(/["\r]/g, '').trim())
      const code = cols[codeIdx]?.toUpperCase().trim() || ''
      const posted   = parseFloat(cols[postedIdx]  || '0') || 0
      const accruals = accIdx     >= 0 ? parseFloat(cols[accIdx]     || '0') || 0 : 0
      const subRecon = subReconIdx >= 0 ? parseFloat(cols[subReconIdx]|| '0') || 0 : 0
      const cc = costCodes.find(c => c.code === code)
      return {
        code,
        description: cc?.description,
        trade: cc?.trade,
        postedCost: posted,
        accruals,
        subRecon,
        error: !code ? 'Missing code' : !codeSet.has(code) ? `Code "${code}" not in Cost Code master` : undefined,
      }
    })
  }

  async function handleFile(file: File) {
    const text = await file.text()
    const parsed = parseCSV(text)
    setRows(parsed)
    setErrors(parsed.filter(r => r.error).length)
    setStep('preview')
  }

  async function doImport() {
    const validRows = rows.filter(r => !r.error)
    if (validRows.length === 0) return
    setImporting(true)
    let ok = 0
    for (const row of validRows) {
      const res = await fetch(`/api/projects/${projectId}/cost-to-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: row.code, postedCost: row.postedCost, accruals: row.accruals, subRecon: row.subRecon }),
      })
      if (res.ok) ok++
    }
    setImporting(false)
    setStep('done')
    setTimeout(() => { onDone(); onClose() }, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Import Cost to Date</h2>
            <p className="text-xs text-gray-500 mt-0.5">CSV with columns: Code, Posted Cost (+ optional Accruals, Sub Recon)</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'upload' && (
            <div>
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-[#004225] hover:bg-[#E2EFDA]/30 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                <p className="text-sm font-medium text-gray-700">Click to upload CSV file</p>
                <p className="text-xs text-gray-400 mt-1">Or drag & drop</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">Expected CSV format:</p>
                <pre className="text-xs text-gray-500 font-mono bg-white border rounded p-3 overflow-x-auto">{`Code,Posted Cost,Accruals,Sub Recon
PRE-010,112800,8500,0
PRE-011,75200,8500,0
CIV-001,185400,28000,0`}</pre>
                <p className="text-xs text-gray-400 mt-2">Column headers are flexible — the importer detects "code", "posted", "actual", "accrual" etc. First row must be headers.</p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">
                  {rows.length} rows parsed · <span className="text-green-600">{rows.length - errors} valid</span>
                  {errors > 0 && <> · <span className="text-red-500">{errors} errors (will be skipped)</span></>}
                </span>
                <button onClick={() => setStep('upload')} className="text-xs text-gray-500 hover:text-gray-700">
                  ← Re-upload
                </button>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {['Code','Description','Trade','Posted Cost','Accruals','Sub Recon','Status'].map((h, i) => (
                      <th key={i} className={clx('px-3 py-2 text-left bg-gray-100 font-semibold text-gray-600 border-b', i >= 3 && i <= 5 ? 'text-right' : '')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={clx('border-b', r.error ? 'bg-red-50' : 'bg-white hover:bg-gray-50')}>
                      <td className="px-3 py-1.5 font-mono font-bold text-[#004225]">{r.code}</td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-[140px]"><span className="truncate block">{r.description || '–'}</span></td>
                      <td className="px-3 py-1.5 text-gray-500 max-w-[100px]"><span className="truncate block">{r.trade || '–'}</span></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{fmt(r.postedCost)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{r.accruals ? fmt(r.accruals) : '–'}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-gray-500">{r.subRecon ? fmt(r.subRecon) : '–'}</td>
                      <td className="px-3 py-1.5">
                        {r.error
                          ? <span className="flex items-center gap-1 text-red-600"><AlertTriangle size={11} /> {r.error}</span>
                          : <span className="flex items-center gap-1 text-green-600"><Check size={11} /> Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-10">
              <Check size={40} className="mx-auto text-green-500 mb-3" />
              <p className="text-lg font-semibold text-gray-800">Import complete</p>
              <p className="text-sm text-gray-500 mt-1">Rows added to Cost to Date</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <p className="text-xs text-gray-500">
              {rows.filter(r => !r.error).length} of {rows.length} rows will be imported
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-100">Cancel</button>
              <button
                onClick={doImport}
                disabled={importing || rows.filter(r => !r.error).length === 0}
                className="bg-[#004225] text-white px-5 py-2 rounded text-sm font-medium hover:bg-[#1B6B3A] disabled:opacity-50 flex items-center gap-2"
              >
                {importing ? 'Importing…' : `Import ${rows.filter(r => !r.error).length} rows`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
