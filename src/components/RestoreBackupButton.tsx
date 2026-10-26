'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Restores an ExtraOver backup file as a NEW project owned by the current
// user, then opens it. The file is gzip-compressed in the browser before
// upload to stay well under the hosting request size limit.
export default function RestoreBackupButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  const input  = useRef<HTMLInputElement>(null)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  async function restore(file: File) {
    setBusy(true); setError('')
    try {
      let body: BodyInit = file, type = 'application/json'
      if (typeof CompressionStream !== 'undefined') {
        body = await new Response(file.stream().pipeThrough(new CompressionStream('gzip'))).blob()
        type = 'application/gzip'
      }
      const res  = await fetch('/api/projects/restore', { method: 'POST', headers: { 'Content-Type': type }, body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.id) throw new Error(data.error || 'Restore failed, nothing was changed')
      router.push(`/${data.id}/dashboard`)
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <span className={`inline-flex flex-col items-end ${className}`}>
      <input ref={input} type="file" accept=".json,application/json" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) restore(f) }} />
      <button onClick={() => input.current?.click()} disabled={busy}
        title="Restore a project backup file as a new project. Existing projects are not changed."
        className="text-xs font-medium px-3.5 py-1.5 rounded-md bg-surface text-primary border border-primary-fixed-dim hover:bg-primary-container disabled:opacity-50 transition-colors">
        {busy ? 'Restoring...' : 'Restore backup'}
      </button>
      {error && <span role="alert" className="text-[11px] text-error mt-1 max-w-xs text-right">{error}</span>}
    </span>
  )
}
