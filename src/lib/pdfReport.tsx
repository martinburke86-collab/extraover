// @ts-nocheck
import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { DashboardKPIs, TradeSummary, PrelimItem } from './calculations'

// ── Colours ───────────────────────────────────────────────────────────────────
const NAVY   = '#1e3a5f'
const NAVY2  = '#2d4f7a'
const SLATE  = '#565e74'
const OLIVE  = '#456919'
const RED    = '#9f403d'
const GOLD   = '#856c0b'
const GRAY   = '#6b7280'
const LIGHT  = '#f0f4f8'
const HEADER = '#dae4f0'
const WHITE  = '#ffffff'
const BORDER = '#d1d9e0'
const GREEN_BG = '#f1f9e8'
const RED_BG   = '#fef5f5'
const AMBER_BG = '#fffbe8'

// ── Helpers ───────────────────────────────────────────────────────────────────
function money(n: number) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(Math.round(n))
  const str = abs.toLocaleString('en-IE')
  return (n < 0 ? '(€' : '€') + str + (n < 0 ? ')' : '')
}
function pct(n: number) { return (n * 100).toFixed(1) + '%' }
function dateStr(s: string) {
  if (!s) return '—'
  try { return new Date(s).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return s }
}
function mvmt(curr: number, prev: number) {
  if (!prev) return null
  const d = curr - prev
  return { val: d, pct: prev ? d / Math.abs(prev) : 0, up: d >= 0 }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:        { fontFamily: 'Helvetica', fontSize: 8, color: '#26343d', paddingBottom: 44 },
  cover:       { backgroundColor: NAVY, padding: 50, minHeight: '100%', justifyContent: 'space-between' },
  coverTag:    { fontSize: 8, color: 'rgba(255,255,255,0.45)', letterSpacing: 2.5, marginBottom: 6 },
  coverTitle:  { fontSize: 26, color: WHITE, fontFamily: 'Helvetica-Bold', lineHeight: 1.2, marginBottom: 4 },
  coverSub:    { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 24 },
  coverDiv:    { height: 0.5, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: 24 },
  coverKpiRow: { flexDirection: 'row', gap: 10 },
  coverKpi:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 5, padding: 11 },
  coverKpiLbl: { fontSize: 6.5, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.2, marginBottom: 4 },
  coverKpiVal: { fontSize: 14, color: WHITE, fontFamily: 'Helvetica-Bold' },
  coverMeta:   { fontSize: 7.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.9 },
  coverBrand:  { fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 3.5 },

  pageHdr:     { backgroundColor: NAVY, paddingHorizontal: 28, paddingVertical: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageHdrL:    { fontSize: 8.5, color: WHITE, fontFamily: 'Helvetica-Bold' },
  pageHdrR:    { fontSize: 7, color: 'rgba(255,255,255,0.5)' },

  body:        { paddingHorizontal: 28, paddingTop: 16 },
  secTitle:    { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: NAVY, letterSpacing: 0.8, marginBottom: 7, borderBottomWidth: 1.5, borderBottomColor: NAVY, paddingBottom: 3 },
  secTitleSm:  { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: SLATE, letterSpacing: 0.5, marginBottom: 5, marginTop: 10 },

  kpiRow:  { flexDirection: 'row', gap: 7, marginBottom: 12 },
  kpiBox:  { flex: 1, backgroundColor: LIGHT, borderRadius: 4, padding: 8 },
  kpiLbl:  { fontSize: 6, color: GRAY, letterSpacing: 0.6, marginBottom: 3 },
  kpiVal:  { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NAVY },
  kpiSub:  { fontSize: 6, color: GRAY, marginTop: 2 },
  kpiG:    { color: OLIVE },
  kpiR:    { color: RED },
  kpiGold: { color: GOLD },

  tbl:     { marginBottom: 14 },
  thead:   { flexDirection: 'row', backgroundColor: NAVY, borderRadius: 2 },
  th:      { paddingVertical: 5, paddingHorizontal: 4, fontSize: 6.5, color: WHITE, fontFamily: 'Helvetica-Bold' },
  thR:     { textAlign: 'right' },
  tr:      { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDER },
  trAlt:   { backgroundColor: LIGHT },
  trTot:   { flexDirection: 'row', backgroundColor: HEADER, borderTopWidth: 1.5, borderTopColor: NAVY },
  td:      { paddingVertical: 4, paddingHorizontal: 4, fontSize: 7 },
  tdR:     { textAlign: 'right' },
  tdB:     { fontFamily: 'Helvetica-Bold' },
  tdG:     { color: OLIVE, fontFamily: 'Helvetica-Bold' },
  tdR2:    { color: RED,   fontFamily: 'Helvetica-Bold' },
  tdGold:  { color: GOLD,  fontFamily: 'Helvetica-Bold' },
  tdSlate: { color: SLATE },

  pill:    { borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1.5, fontSize: 6, fontFamily: 'Helvetica-Bold' },

  infoGrid: { flexDirection: 'row', gap: 7, marginBottom: 12 },
  infoBox:  { flex: 1, borderWidth: 0.5, borderColor: BORDER, borderRadius: 4, padding: 8 },
  infoLbl:  { fontSize: 6, color: GRAY, marginBottom: 2, letterSpacing: 0.5 },
  infoVal:  { fontSize: 8, fontFamily: 'Helvetica-Bold', color: NAVY },
  infoSub:  { fontSize: 6, color: GRAY, marginTop: 1 },

  footer:  { position: 'absolute', bottom: 14, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 5 },
  footTxt: { fontSize: 6.5, color: GRAY },

  wipBox:  { flexDirection: 'row', gap: 7, marginBottom: 12 },
  wipItem: { flex: 1, borderRadius: 4, padding: 8, borderWidth: 0.5 },
})

// ── Shared components ─────────────────────────────────────────────────────────

function PageHdr({ project, period }: any) {
  return (
    <View style={s.pageHdr} fixed>
      <Text style={s.pageHdrL}>EXTRAOVER · {project.name} · {project.code}</Text>
      <Text style={s.pageHdrR}>{period} · CVR Report</Text>
    </View>
  )
}

function PageFtr({ project, period, generated }: any) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footTxt}>ExtraOver · {project.name}</Text>
      <Text style={s.footTxt}>{period}</Text>
      <Text style={s.footTxt} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

function SectionTitle({ children, mt = 0 }: any) {
  return <Text style={[s.secTitle, mt ? { marginTop: mt } : {}]}>{children}</Text>
}

function InfoBox({ label, value, sub, color }: any) {
  return (
    <View style={s.infoBox}>
      <Text style={s.infoLbl}>{label.toUpperCase()}</Text>
      <Text style={[s.infoVal, color ? { color } : {}]}>{value || '—'}</Text>
      {sub ? <Text style={s.infoSub}>{sub}</Text> : null}
    </View>
  )
}

function KpiBox({ label, value, sub, color }: any) {
  return (
    <View style={s.kpiBox}>
      <Text style={s.kpiLbl}>{label.toUpperCase()}</Text>
      <Text style={[s.kpiVal, color ? { color } : {}]}>{value || '—'}</Text>
      {sub ? <Text style={s.kpiSub}>{sub}</Text> : null}
    </View>
  )
}

// ── 1. Cover Page ─────────────────────────────────────────────────────────────
function CoverPage({ project, kpis, period, generated }: any) {
  const adj = kpis.contractSum + kpis.approvedVars
  const marginPct = adj ? (kpis.forecastMargin / adj * 100).toFixed(1) : '0.0'
  const isProfit  = kpis.forecastMargin >= 0

  return (
    <Page size="A4" style={s.page}>
      <View style={s.cover}>
        <View>
          <Text style={s.coverBrand}>EXTRAOVER · CVR COST REPORT</Text>
        </View>
        <View>
          <Text style={s.coverTag}>COST VALUE RECONCILIATION</Text>
          <Text style={s.coverTitle}>{project.name}</Text>
          <Text style={s.coverSub}>{project.client || 'Client not specified'}</Text>
          <View style={s.coverDiv} />
          <View style={s.coverKpiRow}>
            <View style={s.coverKpi}>
              <Text style={s.coverKpiLbl}>CONTRACT SUM</Text>
              <Text style={s.coverKpiVal}>{money(adj)}</Text>
            </View>
            <View style={s.coverKpi}>
              <Text style={s.coverKpiLbl}>FORECAST EFC</Text>
              <Text style={s.coverKpiVal}>{money(kpis.efc)}</Text>
            </View>
            <View style={s.coverKpi}>
              <Text style={s.coverKpiLbl}>FORECAST P&L</Text>
              <Text style={[s.coverKpiVal, { color: isProfit ? '#9edd6e' : '#ff9a9a' }]}>
                {money(kpis.forecastMargin)}
              </Text>
            </View>
            <View style={s.coverKpi}>
              <Text style={s.coverKpiLbl}>MARGIN</Text>
              <Text style={[s.coverKpiVal, { color: isProfit ? '#9edd6e' : '#ff9a9a' }]}>
                {marginPct}%
              </Text>
            </View>
          </View>
        </View>
        <View>
          <View style={s.coverDiv} />
          <Text style={s.coverMeta}>Period: {period}</Text>
          <Text style={s.coverMeta}>Contract type: {project.contractType || '—'}</Text>
          <Text style={s.coverMeta}>Prepared by: {project.preparedBy || '—'}</Text>
          {project.appRef ? <Text style={s.coverMeta}>Application ref: {project.appRef}</Text> : null}
          {project.startDate ? <Text style={s.coverMeta}>Contract start: {dateStr(project.startDate)}</Text> : null}
          {project.finishDate ? <Text style={s.coverMeta}>Contract finish: {dateStr(project.finishDate)}</Text> : null}
          {project.gifa > 0 ? <Text style={s.coverMeta}>GIFA: {project.gifa.toLocaleString('en-IE')} m²</Text> : null}
          <Text style={s.coverMeta}>Generated: {generated}</Text>
        </View>
      </View>
    </Page>
  )
}

// ── 2. Executive Summary ──────────────────────────────────────────────────────
function SummaryPage({ project, kpis, period, generated }: any) {
  const adj         = kpis.contractSum + kpis.approvedVars
  const fmPct       = adj ? kpis.forecastMargin / adj : 0
  const wip         = kpis.cumulCertified - kpis.revenueReceived
  const profitEarned = kpis.cumulCertified * fmPct
  const overUnder   = kpis.totalClaimed - kpis.actualsTotal

  // Movement vs previous period
  const efcMvmt = kpis.prevEfc ? kpis.efc - kpis.prevEfc : null

  return (
    <Page size="A4" style={s.page}>
      <PageHdr project={project} period={period} />
      <View style={s.body}>
        <SectionTitle>EXECUTIVE SUMMARY</SectionTitle>

        {/* Contract */}
        <Text style={s.secTitleSm}>Contract Position</Text>
        <View style={s.kpiRow}>
          <KpiBox label="Contract sum"       value={money(kpis.contractSum)} />
          <KpiBox label="Approved variations" value={money(kpis.approvedVars)} />
          <KpiBox label="Adjusted contract"   value={money(adj)} sub="incl. approved vars" />
          <KpiBox label="Original budget"     value={money(kpis.originalBudget)} />
          <KpiBox label="Target margin"       value={money(kpis.originalMargin)}
            sub={adj ? pct(kpis.originalMargin / adj) : ''} />
        </View>

        {/* Forecast */}
        <Text style={s.secTitleSm}>Forecast Position</Text>
        <View style={s.kpiRow}>
          <KpiBox label="Forecast EFC"     value={money(kpis.efc)}
            sub={efcMvmt != null ? `Mvmt: ${efcMvmt >= 0 ? '+' : ''}${money(efcMvmt)}` : ''} />
          <KpiBox label="Forecast margin"  value={money(kpis.forecastMargin)}
            color={kpis.forecastMargin >= 0 ? OLIVE : RED} />
          <KpiBox label="Margin %"         value={pct(fmPct)}
            color={fmPct >= 0 ? OLIVE : RED} />
          <KpiBox label="Savings / (overrun)" value={money(kpis.savingsOverrun)}
            color={kpis.savingsOverrun >= 0 ? OLIVE : RED} />
          <KpiBox label="Financial progress"  value={pct(kpis.financialPct)}
            sub={`${money(kpis.actualsTotal)} spent`} />
        </View>

        {/* Earned value / Profit earned */}
        <Text style={s.secTitleSm}>Earned Value &amp; Profit to Date</Text>
        <View style={s.kpiRow}>
          <KpiBox label="Certified to date"  value={money(kpis.cumulCertified)} />
          <KpiBox label="Cost to date"       value={money(kpis.actualsTotal)} />
          <KpiBox label="Profit earned"      value={money(profitEarned)}
            sub={`${pct(fmPct)} margin × certified`}
            color={profitEarned >= 0 ? OLIVE : RED} />
          <KpiBox label="Over / (under) claim" value={money(overUnder)}
            color={overUnder > 0 ? RED : OLIVE} />
          <KpiBox label="CPI"
            value={kpis.actualsTotal > 0 ? (kpis.cumulCertified / kpis.actualsTotal).toFixed(2) : '—'}
            sub="Certified ÷ actual cost"
            color={kpis.actualsTotal > 0 && kpis.cumulCertified >= kpis.actualsTotal ? OLIVE : RED} />
        </View>

        {/* WIP & Cash */}
        <Text style={s.secTitleSm}>Cash &amp; WIP Position</Text>
        <View style={s.wipBox}>
          <View style={[s.wipItem, { borderColor: wip >= 0 ? '#9edd6e' : '#ffb3b3',
            backgroundColor: wip >= 0 ? GREEN_BG : RED_BG }]}>
            <Text style={s.kpiLbl}>{wip >= 0 ? 'WIP (CERTIFIED NOT YET RECEIVED)' : 'OVERBILLING'}</Text>
            <Text style={[s.kpiVal, { color: wip >= 0 ? OLIVE : RED }]}>{money(Math.abs(wip))}</Text>
            <Text style={s.kpiSub}>Certified {money(kpis.cumulCertified)} · Received {money(kpis.revenueReceived)}</Text>
          </View>
          <View style={[s.wipItem, { borderColor: BORDER, backgroundColor: LIGHT }]}>
            <Text style={s.kpiLbl}>CASH POSITION</Text>
            <Text style={[s.kpiVal, { color: kpis.cashPosition >= 0 ? OLIVE : RED }]}>{money(kpis.cashPosition)}</Text>
            <Text style={s.kpiSub}>Received {money(kpis.revenueReceived)} · Paid {money(kpis.totalPaid)}</Text>
          </View>
          <View style={[s.wipItem, { borderColor: BORDER, backgroundColor: LIGHT }]}>
            <Text style={s.kpiLbl}>TOTAL CLAIMED</Text>
            <Text style={s.kpiVal}>{money(kpis.totalClaimed)}</Text>
            <Text style={s.kpiSub}>vs certified {money(kpis.cumulCertified)}</Text>
          </View>
        </View>

        {/* Risk & Opportunity */}
        {(kpis.riskValue !== 0 || kpis.opportunityValue !== 0) && (
          <>
            <SectionTitle mt={6}>RISK &amp; OPPORTUNITY</SectionTitle>
            <View style={s.kpiRow}>
              <View style={[s.kpiBox, { backgroundColor: RED_BG }]}>
                <Text style={s.kpiLbl}>RISK VALUE</Text>
                <Text style={[s.kpiVal, s.kpiR]}>{money(kpis.riskValue)}</Text>
              </View>
              <View style={[s.kpiBox, { backgroundColor: GREEN_BG }]}>
                <Text style={s.kpiLbl}>OPPORTUNITY VALUE</Text>
                <Text style={[s.kpiVal, s.kpiG]}>{money(kpis.opportunityValue)}</Text>
              </View>
              <View style={s.kpiBox}>
                <Text style={s.kpiLbl}>MOST LIKELY MARGIN</Text>
                <Text style={[s.kpiVal, kpis.mostLikelyMargin >= 0 ? s.kpiG : s.kpiR]}>
                  {money(kpis.mostLikelyMargin)}
                </Text>
              </View>
              <View style={s.kpiBox} />
              <View style={s.kpiBox} />
            </View>
          </>
        )}

        {/* GIFA */}
        {project.gifa > 0 && (
          <>
            <SectionTitle mt={6}>GIFA ANALYSIS</SectionTitle>
            <View style={s.kpiRow}>
              <KpiBox label="GIFA" value={project.gifa.toLocaleString('en-IE') + ' m²'} />
              <KpiBox label="Contract sum / m²" value={money(Math.round(adj / project.gifa))} />
              <KpiBox label="EFC / m²"          value={money(Math.round(kpis.efc / project.gifa))} />
              <KpiBox label="CTD / m²"          value={money(Math.round(kpis.actualsTotal / project.gifa))} />
              <KpiBox label="Profit earned / m²" value={money(Math.round(profitEarned / project.gifa))} />
            </View>
          </>
        )}
      </View>
      <PageFtr project={project} period={period} generated={generated} />
    </Page>
  )
}

// ── 3. CVR Trade Table ────────────────────────────────────────────────────────
function TradePage({ project, trades, period, generated }: any) {
  const tot = trades.reduce((a: any, t: TradeSummary) => ({
    budget: a.budget + t.budget, ctd: a.ctd + t.totalCTD,
    committed: a.committed + t.committed, efc: a.efc + t.efc,
    pl: a.pl + t.projectedPL, vc: a.vc + t.valueCertified,
  }), { budget:0, ctd:0, committed:0, efc:0, pl:0, vc:0 })

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <PageHdr project={project} period={period} />
      <View style={s.body}>
        <SectionTitle>CVR TRADE SUMMARY</SectionTitle>
        <View style={s.tbl}>
          <View style={s.thead}>
            <Text style={[s.th, { flex: 2.5 }]}>Element</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>Budget</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>CTD</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>Committed</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>Forecast</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>EFC</Text>
            <Text style={[s.th, s.thR, { flex: 0.9 }]}>Var to Budget</Text>
            <Text style={[s.th, s.thR, { flex: 0.85 }]}>Var %</Text>
            <Text style={[s.th, s.thR, { flex: 0.95 }]}>Proj P&L</Text>
            <Text style={[s.th, s.thR, { flex: 1.0 }]}>Val Certified</Text>
          </View>
          {trades.map((t: TradeSummary, i: number) => {
            const varAmt = t.budget ? t.efc - t.budget : 0
            const varPct = t.budget ? varAmt / t.budget : 0
            const over   = varAmt > 0
            return (
              <View key={t.id || i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
                <Text style={[s.td, { flex: 2.5 }]}>{t.trade}</Text>
                <Text style={[s.td, s.tdR, { flex: 1.1 }]}>{t.budget ? money(t.budget) : '—'}</Text>
                <Text style={[s.td, s.tdR, s.tdSlate, { flex: 1.1 }]}>{t.totalCTD ? money(t.totalCTD) : '—'}</Text>
                <Text style={[s.td, s.tdR, s.tdGold, { flex: 1.1 }]}>{t.committed ? money(t.committed) : '—'}</Text>
                <Text style={[s.td, s.tdR, { flex: 1.1 }]}>{t.uncommitted ? money(t.uncommitted) : '—'}</Text>
                <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>{money(t.efc)}</Text>
                <Text style={[s.td, s.tdR, { flex: 0.9 }, t.budget ? (over ? s.tdR2 : s.tdG) : {}]}>
                  {t.budget ? (over ? '+' : '') + money(varAmt) : '—'}
                </Text>
                <Text style={[s.td, s.tdR, { flex: 0.85 }, t.budget ? (over ? s.tdR2 : s.tdG) : {}]}>
                  {t.budget ? pct(varPct) : '—'}
                </Text>
                <Text style={[s.td, s.tdR, { flex: 0.95 }, t.projectedPL >= 0 ? s.tdG : s.tdR2]}>
                  {money(t.projectedPL)}
                </Text>
                <Text style={[s.td, s.tdR, { flex: 1.0 }]}>{t.valueCertified ? money(t.valueCertified) : '—'}</Text>
              </View>
            )
          })}
          <View style={s.trTot}>
            <Text style={[s.td, s.tdB, { flex: 2.5 }]}>TOTAL</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>{money(tot.budget)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, s.tdSlate, { flex: 1.1 }]}>{money(tot.ctd)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, s.tdGold, { flex: 1.1 }]}>{money(tot.committed)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>—</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>{money(tot.efc)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 0.9 }, tot.budget && tot.efc - tot.budget > 0 ? s.tdR2 : s.tdG]}>
              {tot.budget ? money(tot.efc - tot.budget) : '—'}
            </Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 0.85 }, tot.budget && tot.efc - tot.budget > 0 ? s.tdR2 : s.tdG]}>
              {tot.budget ? pct((tot.efc - tot.budget) / tot.budget) : '—'}
            </Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 0.95 }, tot.pl >= 0 ? s.tdG : s.tdR2]}>{money(tot.pl)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 1.0 }]}>{money(tot.vc)}</Text>
          </View>
        </View>
      </View>
      <PageFtr project={project} period={period} generated={generated} />
    </Page>
  )
}

// ── 4. Budget Summary ─────────────────────────────────────────────────────────
function BudgetPage({ project, trades, kpis, period, generated }: any) {
  const hasBudgets = trades.some((t: TradeSummary) => t.budget > 0)
  if (!hasBudgets) return null

  const totBudget = trades.reduce((s: number, t: TradeSummary) => s + t.budget, 0)
  const totEfc    = trades.reduce((s: number, t: TradeSummary) => s + t.efc, 0)
  const totVar    = totBudget - totEfc

  return (
    <Page size="A4" style={s.page}>
      <PageHdr project={project} period={period} />
      <View style={s.body}>
        <SectionTitle>BUDGET FORMATION</SectionTitle>

        <View style={s.kpiRow}>
          <KpiBox label="Total element budget" value={money(totBudget)} />
          <KpiBox label="Total EFC"            value={money(totEfc)} />
          <KpiBox label="Budget variance"      value={money(totVar)}
            sub={totBudget ? pct(totVar / totBudget) : ''}
            color={totVar >= 0 ? OLIVE : RED} />
          <KpiBox label="Cost to date"         value={money(kpis.actualsTotal)} />
          <KpiBox label="Committed"            value={money(trades.reduce((s: number, t: TradeSummary) => s + t.committed, 0))} />
        </View>

        <View style={s.tbl}>
          <View style={s.thead}>
            <Text style={[s.th, { flex: 2.8 }]}>Element</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>Budget</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>EFC</Text>
            <Text style={[s.th, s.thR, { flex: 1.0 }]}>CTD</Text>
            <Text style={[s.th, s.thR, { flex: 0.9 }]}>Committed</Text>
            <Text style={[s.th, s.thR, { flex: 0.9 }]}>Variance</Text>
            <Text style={[s.th, s.thR, { flex: 0.75 }]}>Var %</Text>
            <Text style={[s.th, { flex: 0.75 }]}>Status</Text>
          </View>
          {trades.map((t: TradeSummary, i: number) => {
            const varAmt = t.budget ? t.budget - t.efc : 0
            const varPct = t.budget ? varAmt / t.budget : 0
            const rag    = !t.budget ? 'none' : varAmt >= 0 ? 'ok' : varAmt / t.budget < -0.05 ? 'over' : 'warn'
            return (
              <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
                <Text style={[s.td, { flex: 2.8 }]}>{t.trade}</Text>
                <Text style={[s.td, s.tdR, { flex: 1.1 }]}>{t.budget ? money(t.budget) : '—'}</Text>
                <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>{money(t.efc)}</Text>
                <Text style={[s.td, s.tdR, s.tdSlate, { flex: 1.0 }]}>{t.totalCTD ? money(t.totalCTD) : '—'}</Text>
                <Text style={[s.td, s.tdR, s.tdGold, { flex: 0.9 }]}>{t.committed ? money(t.committed) : '—'}</Text>
                <Text style={[s.td, s.tdR, { flex: 0.9 }, rag === 'ok' ? s.tdG : rag === 'over' ? s.tdR2 : s.tdGold]}>
                  {t.budget ? money(varAmt) : '—'}
                </Text>
                <Text style={[s.td, s.tdR, { flex: 0.75 }, rag === 'ok' ? s.tdG : rag === 'over' ? s.tdR2 : s.tdGold]}>
                  {t.budget ? pct(varPct) : '—'}
                </Text>
                <Text style={[s.td, { flex: 0.75, fontSize: 6 },
                  rag === 'ok' ? { color: OLIVE } : rag === 'over' ? { color: RED } : rag === 'warn' ? { color: GOLD } : { color: GRAY }]}>
                  {rag === 'ok' ? 'On budget' : rag === 'over' ? 'Over budget' : rag === 'warn' ? 'Near limit' : '—'}
                </Text>
              </View>
            )
          })}
          <View style={s.trTot}>
            <Text style={[s.td, s.tdB, { flex: 2.8 }]}>TOTAL</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>{money(totBudget)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>{money(totEfc)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, s.tdSlate, { flex: 1.0 }]}>{money(kpis.actualsTotal)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, s.tdGold, { flex: 0.9 }]}>
              {money(trades.reduce((s: number, t: TradeSummary) => s + t.committed, 0))}
            </Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 0.9 }, totVar >= 0 ? s.tdG : s.tdR2]}>{money(totVar)}</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 0.75 }, totVar >= 0 ? s.tdG : s.tdR2]}>
              {totBudget ? pct(totVar / totBudget) : '—'}
            </Text>
            <Text style={[s.td, { flex: 0.75 }]} />
          </View>
        </View>
      </View>
      <PageFtr project={project} period={period} generated={generated} />
    </Page>
  )
}

// ── 5. Variations ─────────────────────────────────────────────────────────────
function VariationsPage({ project, variations, period, generated }: any) {
  if (!variations.length) return null

  const approved  = variations.filter((v: any) => v.status === 'Approved')
  const pending   = variations.filter((v: any) => ['Submitted','Under Review'].includes(v.status))

  const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    'Approved':     { bg: '#d0fc9a', text: OLIVE },
    'Submitted':    { bg: '#ffeeb9', text: GOLD },
    'Under Review': { bg: '#ffeeb9', text: GOLD },
    'Instructed':   { bg: '#e8ecff', text: '#3730a3' },
    'Rejected':     { bg: '#ffe8e6', text: RED },
    'On Hold':      { bg: '#f1efe8', text: SLATE },
  }

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <PageHdr project={project} period={period} />
      <View style={s.body}>
        <SectionTitle>VARIATIONS REGISTER</SectionTitle>

        {/* Summary strip */}
        <View style={s.kpiRow}>
          <KpiBox label="Total variations"    value={String(variations.length)} />
          <KpiBox label="Approved income"     value={money(approved.reduce((s: number, v: any) => s + v.income, 0))} color={OLIVE} />
          <KpiBox label="Approved margin"
            value={money(approved.reduce((s: number, v: any) => s + v.income - v.costEst, 0))}
            color={OLIVE} />
          <KpiBox label="Submitted / review"  value={money(pending.reduce((s: number, v: any) => s + v.income, 0))} color={GOLD} />
          <KpiBox label="Total pipeline"
            value={money(variations.filter((v: any) => v.status !== 'Rejected').reduce((s: number, v: any) => s + v.income, 0))} />
        </View>

        <View style={s.tbl}>
          <View style={s.thead}>
            <Text style={[s.th, { flex: 0.65 }]}>Ref</Text>
            <Text style={[s.th, { flex: 2.8 }]}>Description</Text>
            <Text style={[s.th, { flex: 0.95 }]}>Status</Text>
            <Text style={[s.th, { flex: 1.1 }]}>Category</Text>
            <Text style={[s.th, { flex: 0.8 }]}>Instructed by</Text>
            <Text style={[s.th, s.thR, { flex: 0.75 }]}>% Complete</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>Income value</Text>
            <Text style={[s.th, s.thR, { flex: 1.1 }]}>Cost estimate</Text>
            <Text style={[s.th, s.thR, { flex: 1.0 }]}>Margin</Text>
          </View>
          {variations.map((v: any, i: number) => {
            const margin = v.income - v.costEst
            const sc = STATUS_COLORS[v.status] || { bg: '#f1efe8', text: SLATE }
            return (
              <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]}>
                <Text style={[s.td, s.tdB, { flex: 0.65, color: SLATE }]}>{v.ref}</Text>
                <Text style={[s.td, { flex: 2.8 }]}>{v.description}</Text>
                <View style={{ flex: 0.95, padding: 3, justifyContent: 'center' }}>
                  <Text style={[s.pill, { backgroundColor: sc.bg, color: sc.text, alignSelf: 'flex-start' }]}>
                    {v.status}
                  </Text>
                </View>
                <Text style={[s.td, { flex: 1.1, fontSize: 6.5, color: SLATE }]}>{v.category || '—'}</Text>
                <Text style={[s.td, { flex: 0.8, fontSize: 6.5 }]}>{v.instructedBy || '—'}</Text>
                <Text style={[s.td, s.tdR, { flex: 0.75 }]}>{v.pctComplete != null ? v.pctComplete + '%' : '—'}</Text>
                <Text style={[s.td, s.tdR, { flex: 1.1 }]}>{money(v.income)}</Text>
                <Text style={[s.td, s.tdR, { flex: 1.1 }]}>{money(v.costEst)}</Text>
                <Text style={[s.td, s.tdR, { flex: 1.0 }, margin >= 0 ? s.tdG : s.tdR2]}>{money(margin)}</Text>
              </View>
            )
          })}
          <View style={s.trTot}>
            <Text style={[s.td, s.tdB, { flex: 0.65 }]}>—</Text>
            <Text style={[s.td, s.tdB, { flex: 2.8 }]}>TOTAL</Text>
            <Text style={[s.td, { flex: 0.95 + 1.1 + 0.8 + 0.75 }]} />
            <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>
              {money(variations.reduce((s: number, v: any) => s + v.income, 0))}
            </Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 1.1 }]}>
              {money(variations.reduce((s: number, v: any) => s + v.costEst, 0))}
            </Text>
            {(() => {
              const m = variations.reduce((s: number, v: any) => s + v.income - v.costEst, 0)
              return <Text style={[s.td, s.tdR, s.tdB, { flex: 1.0 }, m >= 0 ? s.tdG : s.tdR2]}>{money(m)}</Text>
            })()}
          </View>
        </View>
      </View>
      <PageFtr project={project} period={period} generated={generated} />
    </Page>
  )
}

// ── 6. Prelims Summary ────────────────────────────────────────────────────────
function PrelimsPage({ project, prelims, kpis, period, generated }: any) {
  if (!prelims.length) return null

  // Group by section
  const sections: Record<string, PrelimItem[]> = {}
  prelims.forEach((item: PrelimItem) => {
    const sec = item.section || item.stage || 'General'
    if (!sections[sec]) sections[sec] = []
    sections[sec].push(item)
  })

  const totalBudget = prelims.reduce((s: number, i: PrelimItem) => s + (i.budget || 0), 0)
  const totalPfc    = prelims.reduce((s: number, i: PrelimItem) => s + (i.pfc || 0), 0)

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <PageHdr project={project} period={period} />
      <View style={s.body}>
        <SectionTitle>PRELIMINARIES SUMMARY</SectionTitle>

        <View style={s.kpiRow}>
          <KpiBox label="Total budget"   value={money(totalBudget)} />
          <KpiBox label="Proj. final cost" value={money(totalPfc)}
            color={totalPfc <= totalBudget ? OLIVE : RED} />
          <KpiBox label="Variance"       value={money(totalBudget - totalPfc)}
            color={(totalBudget - totalPfc) >= 0 ? OLIVE : RED} />
          <KpiBox label="Total items"    value={String(prelims.length)} />
        </View>

        <View style={s.tbl}>
          <View style={s.thead}>
            <Text style={[s.th, { flex: 2.5 }]}>Section / Description</Text>
            <Text style={[s.th, { flex: 0.65 }]}>Unit</Text>
            <Text style={[s.th, s.thR, { flex: 0.7 }]}>Qty</Text>
            <Text style={[s.th, s.thR, { flex: 0.85 }]}>Rate</Text>
            <Text style={[s.th, s.thR, { flex: 0.8 }]}>Budget</Text>
            <Text style={[s.th, s.thR, { flex: 0.8 }]}>CTD</Text>
            <Text style={[s.th, s.thR, { flex: 0.8 }]}>Committed</Text>
            <Text style={[s.th, s.thR, { flex: 0.85 }]}>Proj. Final</Text>
          </View>

          {Object.entries(sections).map(([sec, items]: [string, PrelimItem[]], si: number) => {
            const secPfc    = items.reduce((s: number, i: PrelimItem) => s + (i.pfc || 0), 0)
            const secBudget = items.reduce((s: number, i: PrelimItem) => s + (i.budget || 0), 0)
            return (
              <React.Fragment key={sec}>
                {/* Section header */}
                <View style={{ flexDirection: 'row', backgroundColor: NAVY2, paddingVertical: 3, paddingHorizontal: 4 }}>
                  <Text style={{ flex: 5.85, fontSize: 7, color: WHITE, fontFamily: 'Helvetica-Bold' }}>{sec}</Text>
                  <Text style={{ flex: 0.8, fontSize: 7, color: WHITE, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>{money(secBudget)}</Text>
                  <Text style={{ flex: 0.8, fontSize: 7, color: '#ffd280', fontFamily: 'Helvetica-Bold', textAlign: 'right', marginLeft: 4 }}>→ {money(secPfc)}</Text>
                </View>
                {items.map((item: PrelimItem, ii: number) => (
                  <View key={ii} style={[s.tr, ii % 2 === 0 ? {} : s.trAlt]}>
                    <Text style={[s.td, { flex: 2.5, paddingLeft: 8 }]}>{item.description}</Text>
                    <Text style={[s.td, { flex: 0.65 }]}>{item.unit || '—'}</Text>
                    <Text style={[s.td, s.tdR, { flex: 0.7 }]}>{item.qty != null ? item.qty : '—'}</Text>
                    <Text style={[s.td, s.tdR, { flex: 0.85 }]}>{item.rate ? money(item.rate) : '—'}</Text>
                    <Text style={[s.td, s.tdR, { flex: 0.8 }]}>{item.budget ? money(item.budget) : '—'}</Text>
                    <Text style={[s.td, s.tdR, s.tdSlate, { flex: 0.8 }]}>{item.ctd ? money(item.ctd) : '—'}</Text>
                    <Text style={[s.td, s.tdR, s.tdGold, { flex: 0.8 }]}>{item.committed ? money(item.committed) : '—'}</Text>
                    <Text style={[s.td, s.tdR, s.tdB, { flex: 0.85 }]}>{item.pfc ? money(item.pfc) : '—'}</Text>
                  </View>
                ))}
              </React.Fragment>
            )
          })}

          <View style={s.trTot}>
            <Text style={[s.td, s.tdB, { flex: 2.5 }]}>TOTAL PRELIMS</Text>
            <Text style={[s.td, { flex: 0.65 + 0.7 + 0.85 }]} />
            <Text style={[s.td, s.tdR, s.tdB, { flex: 0.8 }]}>{money(totalBudget)}</Text>
            <Text style={[s.td, s.tdR, { flex: 0.8 }]}>—</Text>
            <Text style={[s.td, s.tdR, { flex: 0.8 }]}>—</Text>
            <Text style={[s.td, s.tdR, s.tdB, { flex: 0.85 }, totalPfc <= totalBudget ? s.tdG : s.tdR2]}>{money(totalPfc)}</Text>
          </View>
        </View>
      </View>
      <PageFtr project={project} period={period} generated={generated} />
    </Page>
  )
}

// ── Main document ─────────────────────────────────────────────────────────────
export function CVRReport({ project, periodLabel, kpis, trades, prelims, variations, generatedAt }: {
  project: any; periodLabel: string; kpis: DashboardKPIs
  trades: TradeSummary[]; prelims: PrelimItem[]
  variations: any[]; generatedAt: string
}) {
  return (
    <Document title={`CVR Report — ${project.name}`} author="ExtraOver">
      <CoverPage    project={project} kpis={kpis} period={periodLabel} generated={generatedAt} />
      <SummaryPage  project={project} kpis={kpis} period={periodLabel} generated={generatedAt} />
      <TradePage    project={project} trades={trades} period={periodLabel} generated={generatedAt} />
      <BudgetPage   project={project} trades={trades} kpis={kpis} period={periodLabel} generated={generatedAt} />
      {variations.length > 0 && (
        <VariationsPage project={project} variations={variations} period={periodLabel} generated={generatedAt} />
      )}
      {prelims.length > 0 && (
        <PrelimsPage project={project} prelims={prelims} kpis={kpis} period={periodLabel} generated={generatedAt} />
      )}
    </Document>
  )
}
