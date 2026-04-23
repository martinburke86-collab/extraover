'use client'
import { useState } from 'react'

export default function LoginClient() {
  const [email,   setEmail]   = useState('')
  const [password,setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)

    const res = await fetch('/api/auth/signin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })

    if (res.ok) {
      window.location.href = '/portfolio'
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Sign-in failed. Check your credentials.')
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: 14,
    border: '0.5px solid #d1d5db', borderRadius: 8, outline: 'none',
    boxSizing: 'border-box', background: '#fafbfc',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 380 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ background: '#1e3a5f', padding: '28px 32px 24px' }}>
            <img src="/logo.png" alt="ExtraOver" style={{ width: 130, filter: 'invert(1) brightness(2)', marginBottom: 8 }} />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Cost Value Reconciliation
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Email address
              </label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus placeholder="your@email.com" style={inp} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                Password
              </label>
              <input type="password" value={password} onChange={e => setPass(e.target.value)}
                required placeholder="••••••••" style={inp} />
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 11, background: loading ? '#374b64' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Signing in…' : 'Sign in to ExtraOver'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 16 }}>
          ExtraOver v28 · Access controlled
        </p>
      </div>
    </div>
  )
}
