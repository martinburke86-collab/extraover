import { getTradeSummaries } from '@/lib/calculations'
import { initDB } from '@/lib/db'
import { fmt, pct, clx } from '@/lib/utils'
import { PageHeader } from '@/components/ui'
import TradeClient from './TradeClient'

export const dynamic = 'force-dynamic'

export default async function TradePage({ params }: { params: { id: string } }) {
  await initDB()
  const trades = await getTradeSummaries(params.id)
  return <TradeClient trades={trades} projectId={params.id} />
}
