import { NextResponse } from 'next/server'
import { initDB } from '@/lib/db'
import { requireUserApi } from '@/lib/apiAuth'
import { createDemoProject } from '@/lib/demoProject'

// POST: add a fully worked demo project owned by the caller. Never deletes
// or changes anything else, so it is safe on a live database.
export async function POST() {
  const guard = await requireUserApi()
  if (!guard.ok) return guard.res
  await initDB()
  try {
    const { id } = await createDemoProject(guard.session.userId, guard.session.name)
    return NextResponse.json({ id })
  } catch (err: any) {
    console.error('Demo project creation failed:', err)
    return NextResponse.json({ error: 'Could not create the demo project' }, { status: 500 })
  }
}
