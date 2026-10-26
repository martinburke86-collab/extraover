import { NextResponse } from 'next/server'
import { gunzipSync } from 'zlib'
import { initDB } from '@/lib/db'
import { requireUserApi } from '@/lib/apiAuth'
import { restoreProjectBackup, BackupError } from '@/lib/backup'

const MAX_JSON_BYTES = 100 * 1024 * 1024

// POST: restore a backup as a NEW project owned by the caller. Accepts the
// JSON as-is, or gzip-compressed (Content-Type: application/gzip) to stay
// under the hosting request size limit. Never overwrites existing data.
export async function POST(req: Request) {
  const guard = await requireUserApi()
  if (!guard.ok) return guard.res
  await initDB()
  let parsed: unknown
  try {
    const buf = Buffer.from(await req.arrayBuffer())
    const gz = (req.headers.get('content-type') ?? '').includes('gzip')
    const text = gz ? gunzipSync(buf, { maxOutputLength: MAX_JSON_BYTES }).toString('utf8') : buf.toString('utf8')
    parsed = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'The file could not be read as an ExtraOver backup' }, { status: 400 })
  }
  try {
    const result = await restoreProjectBackup(parsed, guard.session.userId, guard.session.name)
    return NextResponse.json(result)
  } catch (err: any) {
    if (err instanceof BackupError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('Restore failed:', err)
    return NextResponse.json({ error: 'Restore failed, nothing was changed' }, { status: 500 })
  }
}
