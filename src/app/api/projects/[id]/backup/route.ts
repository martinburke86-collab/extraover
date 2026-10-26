import { NextResponse } from 'next/server'
import { initDB } from '@/lib/db'
import { requireProjectApi } from '@/lib/apiAuth'
import { exportProjectBackup } from '@/lib/backup'

// GET: full project backup as JSON, restorable with POST /api/projects/restore
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()
  const backup = await exportProjectBackup(params.id)
  const fn = `ExtraOver_${backup.project.name.replace(/[^a-z0-9]/gi, '_')}_backup_${backup.exportedAt.slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(backup), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="${fn}"` },
  })
}
