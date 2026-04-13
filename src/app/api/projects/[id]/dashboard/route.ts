import { NextResponse } from 'next/server'
import { initDB } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries } from '@/lib/calculations'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  await initDB()
  const [kpis, trades] = await Promise.all([
    getDashboardKPIs(params.id),
    getTradeSummaries(params.id),
  ])
  return NextResponse.json({ kpis, trades })
}
