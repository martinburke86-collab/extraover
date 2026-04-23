'use client'
import { type Role } from '@/lib/roleUtils'

export default function ViewerBanner({ role }: { role: Role }) {
  if (role !== 'viewer') return null
  return (
    <div style={{
      background: '#EFF6FF', borderBottom: '0.5px solid #BFDBFE',
      padding: '8px 24px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#1e40af' }}>visibility</span>
      <span style={{ fontSize: 12, color: '#1e40af', fontWeight: 500 }}>
        Read-only access — you can view this data but cannot make changes.
      </span>
    </div>
  )
}
