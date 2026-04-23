import { db, cuid } from './db'

type AuditAction = 'Created' | 'Updated' | 'Deleted'

export async function writeAudit(
  projectId: string,
  category: string,
  action: AuditAction,
  recordLabel: string,
  field?: string,
  oldValue?: string | number | null,
  newValue?: string | number | null,
  userName?: string,
) {
  if (action === 'Updated') {
    const ov = oldValue == null ? '' : String(oldValue)
    const nv = newValue == null ? '' : String(newValue)
    if (ov === nv) return
  }

  try {
    await db.execute({
      sql: `INSERT INTO audit_log (id, project_id, created_at, category, action, record_label, field, old_value, new_value, user_name)
            VALUES (?,?,datetime('now'),?,?,?,?,?,?,?)`,
      args: [
        cuid(), projectId, category, action,
        recordLabel || null, field || null,
        oldValue != null ? String(oldValue) : null,
        newValue != null ? String(newValue) : null,
        userName || null,
      ],
    })
  } catch {
    // Audit failure should never break the main operation
  }
}

export async function auditChanges(
  projectId: string,
  category: string,
  recordLabel: string,
  changes: Array<{ field: string; old: number | string | null; next: number | string | null }>,
  userName?: string,
) {
  for (const c of changes) {
    const ov = c.old  == null ? '' : String(c.old)
    const nv = c.next == null ? '' : String(c.next)
    if (ov !== nv) {
      await writeAudit(projectId, category, 'Updated', recordLabel, c.field, c.old, c.next, userName)
    }
  }
}

export function auditMoney(n: number | null | undefined): string {
  if (n == null) return '—'
  return '€' + Math.round(n).toLocaleString('en-IE')
}
