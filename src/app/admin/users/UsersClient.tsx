'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type UserProject = { projectId: string; projectName: string; code: string; role: string }
type User = { id: string; email: string; name: string; globalRole: string; createdAt: string; projects: UserProject[] }
type Project = { id: string; name: string; code: string }

const ROLE_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  owner:  { label: 'Owner',  bg: '#F0F4FF', text: '#3730a3', dot: '#4338ca' },
  user:   { label: 'User',   bg: '#F3F4F6', text: '#4B5563', dot: '#6B7280' },
  editor: { label: 'Editor', bg: '#F1F4E0', text: '#456919', dot: '#3B6D11' },
  viewer: { label: 'Viewer', bg: '#E6F1FB', text: '#0C447C', dot: '#185FA5' },
}

function Badge({ role }: { role: string }) {
  const cfg = ROLE_CFG[role] ?? ROLE_CFG.user
  return (
    <span style={{ background: cfg.bg, color: cfg.text, fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

export default function UsersClient({ users: initial, projects, currentUserId }: {
  users: User[]; projects: Project[]; currentUserId: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [users, setUsers]   = useState<User[]>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // New user form
  const [showNew, setShowNew]     = useState(false)
  const [newName, setNewName]     = useState('')
  const [newEmail, setNewEmail]   = useState('')
  const [newPass, setNewPass]     = useState('')
  const [newRole, setNewRole]     = useState<'owner' | 'user'>('user')

  // Expanded user (project assignments)
  const [expandedId, setExpanded] = useState<string | null>(null)

  // Change password
  const [pwdUserId, setPwdUserId] = useState<string | null>(null)
  const [newPwd, setNewPwd]       = useState('')

  async function createUser() {
    if (!newName || !newEmail || !newPass) { setError('All fields required'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, email: newEmail, password: newPass, globalRole: newRole }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Failed to create user'); return }
    setShowNew(false); setNewName(''); setNewEmail(''); setNewPass(''); setNewRole('user')
    startTransition(() => router.refresh())
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    startTransition(() => router.refresh())
  }

  async function changePassword(userId: string) {
    if (!newPwd || newPwd.length < 8) { setError('Password must be at least 8 characters'); return }
    setSaving(true)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId, password: newPwd }),
    })
    setSaving(false); setPwdUserId(null); setNewPwd('')
  }

  async function setProjectRole(userId: string, projectId: string, role: string) {
    await fetch('/api/admin/user-projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, projectId, role: role || null }),
    })
    startTransition(() => router.refresh())
  }

  const inp: React.CSSProperties = {
    border: '0.5px solid #d1d5db', borderRadius: 6, padding: '8px 10px',
    fontSize: 13, width: '100%', outline: 'none', background: '#fafbfc',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f9', fontFamily: 'Inter, var(--font-sans), sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: '#1e3a5f', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/portfolio" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, textDecoration: 'none' }}>
            ← Portfolio
          </a>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
          <img src="/logo.png" alt="ExtraOver" style={{ width: 90, filter: 'invert(1) brightness(2)' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Admin · User Management</span>
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 500, color: '#111', margin: 0 }}>User Management</h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              {users.length} user{users.length !== 1 ? 's' : ''} · Owner role has full access to all projects
            </p>
          </div>
          <button onClick={() => setShowNew(true)}
            style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Invite user
          </button>
        </div>

        {error && (
          <div style={{ background: '#FEF2F2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>
            {error}
          </div>
        )}

        {/* New user form */}
        {showNew && (
          <div style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111', marginBottom: 14 }}>Invite new user</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Full name</label>
                <input style={inp} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Martin Burke" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Email</label>
                <input style={inp} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="martin@company.ie" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>Password</label>
                <input style={inp} type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min 8 characters" />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 4 }}>System role</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={newRole} onChange={e => setNewRole(e.target.value as any)}>
                  <option value="user">User (project access via assignments)</option>
                  <option value="owner">Owner (full access to everything)</option>
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, background: '#f8f9fb', padding: '8px 12px', borderRadius: 6 }}>
              Share these credentials directly with the user. They can change their password after signing in.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createUser} disabled={saving}
                style={{ background: '#456919', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Creating…' : 'Create user'}
              </button>
              <button onClick={() => { setShowNew(false); setError('') }}
                style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* User list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {users.map(u => {
            const isMe       = u.id === currentUserId
            const isExpanded = expandedId === u.id
            const isPwdOpen  = pwdUserId === u.id

            return (
              <div key={u.id} style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                {/* User row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: '#1e3a5f',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600, flexShrink: 0,
                  }}>
                    {u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{u.name}</span>
                      {isMe && <span style={{ fontSize: 10, background: '#EAF3DE', color: '#27500A', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>You</span>}
                      <Badge role={u.globalRole} />
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{u.email}</div>
                    {u.projects.length > 0 && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                        {u.projects.map(p => `${p.code} (${p.role})`).join(' · ')}
                      </div>
                    )}
                    {u.globalRole === 'user' && u.projects.length === 0 && (
                      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>⚠ No project assignments — user cannot access any projects</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setExpanded(isExpanded ? null : u.id)}
                      style={{ fontSize: 12, color: '#185FA5', background: '#E6F1FB', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 500 }}>
                      {isExpanded ? 'Done' : 'Manage access'}
                    </button>
                    <button onClick={() => { setPwdUserId(isPwdOpen ? null : u.id); setNewPwd('') }}
                      style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
                      Password
                    </button>
                    {!isMe && (
                      <button onClick={() => deleteUser(u.id, u.name)}
                        style={{ fontSize: 12, color: '#991B1B', background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* Password change */}
                {isPwdOpen && (
                  <div style={{ background: '#fffde8', borderTop: '0.5px solid #fde68a', padding: '12px 18px', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input style={{ ...inp, width: 240 }} type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
                      placeholder="New password (min 8 chars)" />
                    <button onClick={() => changePassword(u.id)} disabled={saving}
                      style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {saving ? 'Saving…' : 'Set password'}
                    </button>
                    <button onClick={() => setPwdUserId(null)}
                      style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                )}

                {/* Project access panel */}
                {isExpanded && u.globalRole !== 'owner' && (
                  <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '14px 18px', background: '#f8f9fb' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                      Project access — select a role for each project, or leave blank to deny access
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                      {projects.map(p => {
                        const assignment = u.projects.find(a => a.projectId === p.id)
                        return (
                          <div key={p.id} style={{ background: '#fff', border: '0.5px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.code}</div>
                            </div>
                            <select
                              value={assignment?.role ?? ''}
                              onChange={e => setProjectRole(u.id, p.id, e.target.value)}
                              style={{ border: '0.5px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer', background: assignment ? '#f0f4fa' : '#fafbfc', color: assignment ? '#1e3a5f' : '#9ca3af', fontWeight: assignment ? 600 : 400 }}>
                              <option value="">No access</option>
                              <option value="editor">Editor</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isExpanded && u.globalRole === 'owner' && (
                  <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '12px 18px', background: '#f0f4ff', fontSize: 13, color: '#3730a3' }}>
                    Owners have full access to all projects — no per-project assignments needed.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
