import { NextResponse } from 'next/server'
import { db, initDB } from '@/lib/db'

export async function GET() {
  await initDB()
  const r = await db.execute('SELECT id, name, code FROM projects ORDER BY created_at DESC')
  return NextResponse.json(r.rows)
}
