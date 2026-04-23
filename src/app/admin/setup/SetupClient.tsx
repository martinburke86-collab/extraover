'use client'
import { useState } from 'react'

export default function SetupClient() {
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [password,setPass]    = useState('')
  const [confirm, setConfirm] = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim())          { setError('Please enter your full name.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }
    if (password.length < 8)   { setError('Password must be at least 8 characters.'); return }
    setLoading(true)

    // 1. Create account
    const createRes = await fetch('/api/admin/users', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password, globalRole: 'owner', _setup: true }),
    })

    if (!createRes.ok) {
      const data = await createRes.json().catch(() => ({}))
      setError(data.error || `Server error (${createRes.status}) — check Vercel logs`)
      setLoading(false)
      return
    }

    // 2. Sign in via our custom API
    const signinRes = await fetch('/api/auth/signin', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })

    if (signinRes.ok) {
      window.location.href = '/portfolio'
    } else {
      // Account was created but sign-in failed — redirect to login
      window.location.href = '/login'
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: 14,
    border: '0.5px solid #d1d5db', borderRadius: 8, outline: 'none',
    boxSizing: 'border-box', background: '#fafbfc',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f9', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ width: 400 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ background: '#1e3a5f', padding: '28px 32px 24px' }}>
            <img src="/logo.png" alt="ExtraOver" style={{ width: 130, filter: 'invert(1) brightness(2)', marginBottom: 8 }} />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0 }}>Create your owner account</p>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '28px 32px' }}>
            <div style={{ background: '#EAF3DE', border: '0.5px solid #DEE5B5', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#27500A' }}>
              First-time setup. This account will be the Owner — you can add more users from the Admin panel once signed in.
            </div>

            {[
              { label: 'Full name',        val: name,    set: setName,  type: 'text',     ph: 'Martin Burke' },
              { label: 'Email address',    val: email,   set: setEmail, type: 'email',    ph: 'martin@company.ie' },
              { label: 'Password',         val: password,set: setPass,  type: 'password', ph: '8+ characters' },
              { label: 'Confirm password', val: confirm, set: setConfirm,type:'password', ph: '••••••••' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 16 }}>
                <label style={lbl}>{f.label}</label>
                <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)}
                  required placeholder={f.ph} style={inp} />
              </div>
            ))}

            {error && (
              <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 11, background: loading ? '#374b64' : '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Creating account…' : 'Create Owner Account →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
