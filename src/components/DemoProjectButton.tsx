'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Adds a worked demo project for the signed-in user and opens its dashboard.
// Secondary action styling: white with blue text (Costline).
export default function DemoProjectButton({ label = 'Add demo project', className = '' }: { label?: string; className?: string }) {
  const router = useRouter()
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/projects/demo', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.id) throw new Error(data.error || 'Could not create the demo project')
      router.push(`/${data.id}/dashboard`)
    } catch (e: any) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <span className={`inline-flex flex-col items-end ${className}`}>
      <button onClick={create} disabled={busy}
        title="Adds a fully worked sample project for you to explore. Your other projects are not changed."
        className="text-xs font-medium px-3.5 py-1.5 rounded-md bg-surface text-primary border border-primary-fixed-dim hover:bg-primary-container disabled:opacity-50 transition-colors">
        {busy ? 'Building demo...' : label}
      </button>
      {error && <span role="alert" className="text-[11px] text-error mt-1">{error}</span>}
    </span>
  )
}
