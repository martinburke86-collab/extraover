'use client'
import { useState, useRef, useTransition } from 'react'
import { Upload, X, CheckCircle, AlertCircle, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react'
import { clx } from '@/lib/utils'
import { useRouter } from 'next/navigation'

type ImportType = 'cost-codes' | 'committed' | 'forecast' | 'prelims' | 'elements'

const TEMPLATES: Record<ImportType, { cols: string[]; notes: string[] }> = {
  elements: {
    cols: ['Name', 'Budget', 'Sort_Order', 'Code_Prefix'],
    notes: [
      'Name (or Element, Trade, Section) is the only required column',
      'Budget is optional — can be set on the Budget page after import',
      'Sort_Order controls display order (lower = higher up)',
      'Mode "Add / update" keeps existing elements and updates budgets',
      'Mode "Replace all" deletes all elements first — use with caution',
    ],
  },
  'cost-codes': {
    cols: ['Code', 'Description', 'Trade', 'Category', 'Notes'],
    notes: [
      'Code must be unique per project (e.g. PRE-010)',
      'Trade must match a trade name in CVR Trade exactly',
      'Category must be one of: Labour, Plant, Materials, Subcontractor, Indirect',
      'If a code already exists it will be updated (upsert)',
    ],
  },
  committed: {
    cols: ['Code', 'Supplier', 'Description', 'Status', 'Qty', 'Unit', 'Unit Rate', 'Total'],
    notes: [
      'Code must exist in Cost Codes — upload cost codes first',
      'Status: Placed, Pending, Provisional, Forecast, On Hold, Cancelled',
      'Total = Qty × Unit Rate if both present, otherwise use Total column directly',
      'Trade is auto-assigned from the cost code',
    ],
  },
  prelims: {
    cols: ['Section', 'Code', 'Description', 'Budget', 'CTD', 'Committed', 'Qty', 'Unit', 'Rate', 'Util%', 'Start Week', 'Finish Week', 'Notes'],
    notes: [
      'Unit must be: Weeks, nr, each, m, m2, m3, t, kg, Item, LS, Months',
      'Util% is a number 0–100 (e.g. 50 = 50% utilisation)',
      'If Unit = Weeks: Amount = Qty × Rate × Remaining Weeks × Util%',
      'If Unit ≠ Weeks: Amount = Qty × Rate × Util%',
      'Existing blank rows are kept — imported rows are appended',
    ],
  },
  forecast: {
    cols: ['Code', 'Supplier', 'Status', 'Factor', 'Qty', 'Unit', 'Rate', 'Comment'],
    notes: [
      'Code must exist in Cost Codes — upload cost codes first',
      'Total = Factor × Qty × Rate (or Qty × Rate, or Rate alone)',
      'Status: Estimate, Quote, Final, Variation - Recoverable, Variation - Non Recoverable, Contingency',
      'Trade is auto-assigned from the cost code',
    ],
  },
}

interface Result { ok: boolean; inserted: number; skipped: number; errors: string[]; total: number }

interface Props {
  projectId: string
  type: ImportType
  onClose: () => void
}

export default function UploadModal({ projectId, type, onClose }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile]         = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult]     = useState<Result | null>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const tmpl = TEMPLATES[type]
  const label = type === 'cost-codes' ? 'Cost Codes' : type === 'committed' ? 'Committed Costs' : type === 'prelims' ? 'Prelims' : 'Forecast'

  function handleFile(f: File) {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Please upload an Excel (.xlsx / .xls) or CSV file')
      return
    }
    setFile(f)
    setResult(null)
  }

  async function upload() {
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const endpoint = type === 'elements'
        ? `/api/projects/${projectId}/elements`
        : `/api/projects/${projectId}/import`
      const res  = await fetch(endpoint, { method: 'POST', body: fd })
      const data = await res.json()
      setResult(data)
      if (data.inserted > 0) startTransition(() => router.refresh())
    } catch (e: any) {
      setResult({ ok: false, inserted: 0, skipped: 0, errors: [e.message], total: 0 })
    } finally {
      setUploading(false)
    }
  }

  // Generate template CSV for download
  function downloadTemplate() {
    const header = tmpl.cols.join(',')
    const example: Record<ImportType, string[]> = {
      'cost-codes': ['PRE-010','Project Manager','Preliminaries','Labour',''],
      committed:    ['ELE-001','Green Transfo','120 MVA Transformer','Placed','1','nr','1640000',''],
      forecast:     ['CIV-001','Murphy Civil','Quote','1','','nr','385000','Fixed price quote'],
      prelims:      ['Site Management','PRE-010','Project Manager','0','0','0','1','Weeks','3650','100','1','65',''],
      elements:     ['Preliminaries','150000','1','PRE'],
    }
    const csv  = `${header}\n${example[type].join(',')}\n`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${type}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ background: '#565e74' }}>
            <div className="flex items-center gap-2.5 text-white">
              <Upload size={18} />
              <div>
                <div className="font-bold text-sm">Import {label}</div>
                <div className="text-[11px] opacity-60">Upload Excel or CSV file</div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/60 hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">

            {/* Column format */}
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Required columns</div>
                <button onClick={downloadTemplate}
                  className="text-xs text-[#565e74] underline hover:no-underline font-medium">
                  ↓ Download template
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tmpl.cols.map(col => (
                  <span key={col} className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                    style={{ background: '#E8EDF7', color: '#565e74' }}>{col}</span>
                ))}
              </div>
              <button onClick={() => setShowNotes(n => !n)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2">
                {showNotes ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {showNotes ? 'Hide notes' : 'Show notes'}
              </button>
              {showNotes && (
                <ul className="mt-2 space-y-1">
                  {tmpl.notes.map((n, i) => (
                    <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                      <span className="text-gray-300 flex-shrink-0">•</span>{n}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
              onClick={() => fileRef.current?.click()}
              className={clx(
                'border-2 border-dashed rounded-lg px-4 py-8 text-center cursor-pointer transition-colors',
                dragOver ? 'border-[#565e74] bg-[#E8EDF7]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50',
                file ? 'border-[#DEE5B5] bg-[#F1F4E0]' : ''
              )}>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm font-medium" style={{ color: '#456919' }}>
                  <FileSpreadsheet size={18} />
                  {file.name}
                  <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                </div>
              ) : (
                <>
                  <Upload size={22} className="mx-auto text-gray-300 mb-2" />
                  <div className="text-sm text-gray-500">Drop file here or <span className="text-[#565e74] font-medium">click to browse</span></div>
                  <div className="text-xs text-gray-400 mt-0.5">Excel (.xlsx, .xls) or CSV</div>
                </>
              )}
            </div>

            {/* Result */}
            {result && (
              <div className={clx('rounded-lg p-4 text-sm', result.inserted > 0 ? '' : 'bg-red-50')}
                style={result.inserted > 0 ? { background: '#F1F4E0' } : {}}>
                <div className="flex items-center gap-2 font-semibold mb-1">
                  {result.inserted > 0
                    ? <><CheckCircle size={15} style={{ color: '#456919' }} /><span style={{ color: '#456919' }}>Import complete</span></>
                    : <><AlertCircle size={15} className="text-red-600" /><span className="text-red-700">Import issues</span></>
                  }
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="text-gray-600">✔ {result.inserted} rows inserted / updated</div>
                  {result.skipped > 0 && <div className="text-gray-500">↷ {result.skipped} rows skipped</div>}
                  {result.errors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {result.errors.map((e, i) => (
                        <div key={i} className="text-red-600 bg-red-50 rounded px-2 py-1">{e}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between items-center pt-1">
              <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
                {result ? 'Close' : 'Cancel'}
              </button>
              {!result && (
                <button onClick={upload} disabled={!file || uploading}
                  className="flex items-center gap-2 px-5 py-2 rounded text-sm font-semibold text-white transition-colors disabled:opacity-40"
                  style={{ background: '#565e74' }}>
                  {uploading ? (
                    <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />Importing…</>
                  ) : (
                    <><Upload size={14} />Import {label}</>
                  )}
                </button>
              )}
              {result && result.inserted > 0 && (
                <button onClick={onClose}
                  className="px-5 py-2 rounded text-sm font-semibold text-white"
                  style={{ background: '#565e74' }}>
                  Done
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
