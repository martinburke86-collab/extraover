import { NextResponse } from 'next/server'
import { initDB, db } from '@/lib/db'
import { getDashboardKPIs, getTradeSummaries, getPrelimItems } from '@/lib/calculations'
// @ts-ignore
import ExcelJS from 'exceljs'

const C = {
  navy:'FF1e3a5f', navyMid:'FF2d4f7a', navyLt:'FFdae2fd',
  red:'FFC00000',  redLt:'FFFFB9B9',
  gold:'FFFFC000', goldLt:'FFFFEEB9',
  olive:'FFDEE5B5',oliveLt:'FFF1F4E0',
  input:'FFFFFCC7',
  white:'FFFFFFFF', surfLow:'FFEEF4FA', surf:'FFE5EFF7',
  posGreen:'FFD0FC9A', positive:'FF456919', negative:'FF9F403D', negRed:'FFFFE8E6',
  gray:'FF6E7D86', black:'FF26343D',
}

const CURR0 = '€#,##0;[Red](€#,##0)'
const CURR2 = '€#,##0.00;[Red](€#,##0.00)'
const PCT   = '0.0%'

function fl(argb:string):any { return {type:'pattern',pattern:'solid',fgColor:{argb}} }
function fn(bold=false,size=9,colour=C.black):any { return {name:'Calibri',size,bold,color:{argb:colour}} }
function bd(style:'thin'|'medium'='thin'):any { const s={style,color:{argb:'FFD5E5EF'}}; return {top:s,bottom:s,left:s,right:s} }

function sc(cell:any,val:any,bg=C.white,bold=false,size=9,color=C.black,fmt?:string,h:'left'|'right'|'center'='left',bdr:'thin'|'medium'='thin') {
  cell.value=val; cell.fill=fl(bg); cell.font=fn(bold,size,color)
  cell.alignment={horizontal:h,vertical:'middle'}; cell.border=bd(bdr)
  if(fmt) cell.numFmt=fmt
}

function hdrRow(ws:any,row:number,cols:number,text:string,bg=C.navy,size=12) {
  const lastCol=String.fromCharCode(64+cols)
  ws.mergeCells(`A${row}:${lastCol}${row}`)
  sc(ws.getCell(`A${row}`),text,bg,true,size,C.white)
  ws.getRow(row).height=24
}

function colHeaders(ws:any,row:number,headers:[string,string,string,string?][]) {
  headers.forEach(([col,label,bg,fc='FFFFFFFF'])=>{
    sc(ws.getCell(`${col}${row}`),label,bg,true,8,fc,'',col<='B'?'left':'right')
  })
  ws.getRow(row).height=15
}

function subHdr(ws:any,row:number,cols:number,text:string) {
  const lastCol=String.fromCharCode(64+cols)
  ws.mergeCells(`A${row}:${lastCol}${row}`)
  sc(ws.getCell(`A${row}`),text,C.surf,true,8,C.gray)
  ws.getRow(row).height=13
}

function tradeGroupRow(ws:any,row:number,cols:number,trade:string) {
  const lastCol=String.fromCharCode(64+cols)
  ws.mergeCells(`A${row}:${lastCol}${row}`)
  sc(ws.getCell(`A${row}`),String(trade).toUpperCase(),C.surf,true,9,C.navy)
  ws.getRow(row).height=14
}

function subtotalRow(ws:any,row:number,mergeEnd:string,label:string,valCol:string,val:number,extraVals?:[string,number][]) {
  ws.mergeCells(`A${row}:${mergeEnd}${row}`)
  sc(ws.getCell(`A${row}`),label,C.navyLt,true,9)
  sc(ws.getCell(`${valCol}${row}`),val,C.navyLt,true,9,C.black,CURR0,'right','medium')
  extraVals?.forEach(([c,v])=>sc(ws.getCell(`${c}${row}`),v,C.navyLt,true,9,C.black,CURR0,'right','medium'))
  ws.getRow(row).height=14
}

function grandTotalRow(ws:any,row:number,mergeEnd:string,vals:[string,number|null][]) {
  ws.mergeCells(`A${row}:${mergeEnd}${row}`)
  sc(ws.getCell(`A${row}`),'GRAND TOTAL',C.goldLt,true,9,C.black,'','left','medium')
  vals.forEach(([c,v])=>{
    if(v!==null) sc(ws.getCell(`${c}${row}`),v,C.goldLt,true,9,C.black,CURR0,'right','medium')
  })
  ws.getRow(row).height=16
}

export async function GET(_:Request,{params}:{params:{id:string}}) {
  await initDB()
  const pid=params.id

  const [proj,kpis,trades,prelims,variations,ctdRows,committedRows,forecastRows,sCurveRows,costCodes] = await Promise.all([
    db.execute({sql:'SELECT * FROM projects WHERE id=?',args:[pid]}).then(r=>r.rows[0] as any),
    getDashboardKPIs(pid),
    getTradeSummaries(pid),
    getPrelimItems(pid),
    db.execute({sql:'SELECT * FROM variations WHERE project_id=? ORDER BY ref',args:[pid]}).then(r=>r.rows as any[]),
    db.execute({sql:`SELECT cl.*,cc.code,cc.description as cc_desc,cc.trade,cc.category FROM cost_lines cl JOIN cost_codes cc ON cl.cost_code_id=cc.id WHERE cl.project_id=? ORDER BY cc.trade,cc.code`,args:[pid]}).then(r=>r.rows as any[]),
    db.execute({sql:`SELECT c.*,cc.code,cc.description as cc_desc,cc.trade FROM committed_lines c JOIN cost_codes cc ON c.cost_code_id=cc.id WHERE c.project_id=? ORDER BY cc.trade,cc.code`,args:[pid]}).then(r=>r.rows as any[]),
    db.execute({sql:`SELECT f.*,cc.code as cc_code,cc.description as cc_desc,cc.trade FROM forecast_lines f JOIN cost_codes cc ON f.cost_code_id=cc.id WHERE f.project_id=? ORDER BY f.sort_order`,args:[pid]}).then(r=>r.rows as any[]),
    db.execute({sql:'SELECT * FROM s_curve_rows WHERE project_id=? ORDER BY sort_order',args:[pid]}).then(r=>r.rows as any[]),
    db.execute({sql:'SELECT * FROM cost_codes WHERE project_id=? ORDER BY code',args:[pid]}).then(r=>r.rows as any[]),
  ])

  const wb=new ExcelJS.Workbook()
  wb.creator='ExtraOver'; wb.created=new Date()

  const projName=proj?.name||'Project'
  const period=new Date().toLocaleDateString('en-IE',{month:'long',year:'numeric'})
  const adjSum=kpis.contractSum+kpis.approvedVars
  const fcMargin=adjSum-kpis.efc
  const fmPct=adjSum?fcMargin/adjSum:0
  const cashPos=kpis.revenueReceived-kpis.totalPaid
  const overUnder=kpis.totalClaimed-kpis.actualsTotal
  const ragBg=fmPct>=0.08?C.posGreen:fmPct>=0.03?C.goldLt:C.redLt

  // ══════════════════════════════════════════════════
  // 1. DASHBOARD
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('Dashboard',{views:[{state:'frozen',ySplit:7}]})
    ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,paperSize:9}
    ;[2,26,18,18,18,18,2,26,18,18,18,18,2,22,18,18,18].forEach((w,i)=>ws.getColumn(i+1).width=w)

    // Row 1: title
    ws.mergeCells('B1:Q1')
    sc(ws.getCell('B1'),`EXTRAOVER — EXECUTIVE DASHBOARD`,C.navy,true,14,C.white,'','left')
    ws.getRow(1).height=28

    // Row 2: project + period
    ws.mergeCells('B2:G2'); sc(ws.getCell('B2'),projName,C.navyMid,true,11,C.white)
    ws.mergeCells('H2:Q2'); sc(ws.getCell('H2'),`Reporting Period: ${period}`,C.navyMid,false,10,C.white,'','right')
    ws.getRow(2).height=20; ws.getRow(3).height=6

    // Row 4-5: KPI strip
    const kpiBlocks=[
      {cols:'B:C',label:'ADJUSTED CONTRACT SUM',val:adjSum,fmt:CURR0,bg:C.surfLow,vc:C.black},
      {cols:'D:E',label:'ESTIMATED FINAL COST',val:kpis.efc,fmt:CURR0,bg:C.surfLow,vc:C.black},
      {cols:'F:G',label:'FORECAST MARGIN',val:fcMargin,fmt:CURR0,bg:ragBg,vc:fcMargin>=0?C.positive:C.negative},
      {cols:'H:I',label:'MARGIN %',val:fmPct,fmt:PCT,bg:ragBg,vc:fcMargin>=0?C.positive:C.negative},
      {cols:'J:K',label:'FINANCIAL % COMPLETE',val:kpis.financialPct,fmt:PCT,bg:C.surfLow,vc:C.black},
      {cols:'L:M',label:'OVER / (UNDER) CLAIM',val:overUnder,fmt:CURR0,bg:overUnder>0?C.redLt:C.surfLow,vc:overUnder>0?C.negative:C.black},
    ]
    kpiBlocks.forEach(({cols,label,val,fmt,bg,vc})=>{
      const [c1,c2]=cols.split(':')
      ws.mergeCells(`${c1}4:${c2}4`); sc(ws.getCell(`${c1}4`),label,bg,true,8,C.gray)
      ws.mergeCells(`${c1}5:${c2}5`); sc(ws.getCell(`${c1}5`),val,bg,true,12,vc,fmt)
    })
    ws.getRow(4).height=14; ws.getRow(5).height=22; ws.getRow(6).height=8

    // Three panels side by side: B-F | H-L | N-Q
    let fr=8,cr=8,tr=8

    // Panel 1: Financial Position
    ws.mergeCells(`B${fr}:F${fr}`)
    sc(ws.getCell(`B${fr}`),'FINANCIAL POSITION',C.navy,true,10,C.white,'','center')
    ws.getRow(fr).height=18; fr++

    const finRows:[string,number,string?,boolean?,string?][]=[
      ['CONTRACT',0,'sub'],
      ['Original Contract Sum',kpis.contractSum,CURR0],
      ['Approved Variations',kpis.approvedVars,CURR0],
      ['Adjusted Contract Sum',adjSum,CURR0,true,C.surfLow],
      ['FORECAST',0,'sub'],
      ['Estimated Final Cost',kpis.efc,CURR0],
      ['Forecast Margin (€)',fcMargin,CURR0,true,fcMargin>=0?C.posGreen:C.redLt],
      ['Forecast Margin (%)',fmPct,PCT],
      ['VS BUDGET',0,'sub'],
      ['Original Budget Cost',kpis.originalBudget,CURR0],
      ['Original Margin',kpis.originalMargin,CURR0],
      ['Savings / (Overrun)',fcMargin-kpis.originalMargin,CURR0,true,(fcMargin-kpis.originalMargin)>=0?C.posGreen:C.redLt],
    ]
    for(const [label,val,fmt,bold,bg] of finRows){
      if(fmt==='sub'){ws.mergeCells(`B${fr}:F${fr}`);sc(ws.getCell(`B${fr}`),label,C.surf,true,8,C.gray);ws.getRow(fr).height=13}
      else{
        ws.mergeCells(`B${fr}:D${fr}`);ws.mergeCells(`E${fr}:F${fr}`)
        sc(ws.getCell(`B${fr}`),label,bg||C.white,bold||false,9)
        sc(ws.getCell(`E${fr}`),val,bg||C.white,bold||false,9,label.includes('Margin')||(label.includes('(Overrun)'))?val>=0?C.positive:C.negative:C.black,fmt,'right')
        ws.getRow(fr).height=15
      }
      fr++
    }

    // Panel 2: Claims & Cash
    ws.mergeCells(`H${cr}:L${cr}`)
    sc(ws.getCell(`H${cr}`),'PROGRESS CLAIMS & CASH',C.red,true,10,C.white,'','center')
    ws.getRow(cr).height=18; cr++

    const claimRows:[string,number,string?,boolean?,string?][]=[
      ['APPLICATIONS & CERTS',0,'sub'],
      ['Total Claimed to Date',kpis.totalClaimed,CURR0],
      ['Cumulative Certified',kpis.cumulCertified,CURR0,true,C.redLt],
      ['CASH POSITION',0,'sub'],
      ['Revenue Received',kpis.revenueReceived,CURR0],
      ['Total Paid to Date',kpis.totalPaid,CURR0],
      ['Cash Position',cashPos,CURR0,true,cashPos>=0?C.posGreen:C.redLt],
      ['COST ANALYSIS',0,'sub'],
      ['Posted Costs',kpis.postedCostTotal,CURR0],
      ['Accruals',kpis.accrualsTotal,CURR0],
      ['Actuals incl. Accruals',kpis.actualsTotal,CURR0,true,C.surf],
      ['Financial % Complete',kpis.financialPct,PCT],
      ['Over / (Under) Claim',overUnder,CURR0,true,overUnder>0?C.redLt:C.posGreen],
    ]
    for(const [label,val,fmt,bold,bg] of claimRows){
      if(fmt==='sub'){ws.mergeCells(`H${cr}:L${cr}`);sc(ws.getCell(`H${cr}`),label,C.surf,true,8,C.gray);ws.getRow(cr).height=13}
      else{
        ws.mergeCells(`H${cr}:J${cr}`);ws.mergeCells(`K${cr}:L${cr}`)
        sc(ws.getCell(`H${cr}`),label,bg||C.white,bold||false,9)
        sc(ws.getCell(`K${cr}`),val,bg||C.white,bold||false,9,
          (label.includes('Position')||label.includes('Claim')||label.includes('Actuals'))&&val<0?C.negative:val>0&&label.includes('Position')?C.positive:C.black,
          fmt,'right')
        ws.getRow(cr).height=15
      }
      cr++
    }

    // Panel 3: Trade P/L
    ws.mergeCells(`N${tr}:Q${tr}`)
    sc(ws.getCell(`N${tr}`),'TRADE PERFORMANCE',C.gold,true,10,C.black,'','center')
    ws.getRow(tr).height=18; tr++

    ;[['N','Trade',C.navyMid,C.white],['O','EFC',C.navyMid,C.white],['P','Proj P/L',C.navyMid,C.white],['Q','P/L %',C.navyMid,C.white]].forEach(([c,h,bg,fc])=>{
      sc(ws.getCell(`${c}${tr}`),h,bg as string,true,8,fc as string,'',c==='N'?'left':'right')
    })
    ws.getRow(tr).height=14; tr++

    for(const t of trades){
      const pl=t.finalValue-t.efc, plPct=t.finalValue?pl/t.finalValue:0
      const bg=pl<0?C.negRed:pl>0?'FFF0FCE0':C.white
      ;[['N',t.trade,''],['O',t.efc,CURR0],['P',pl,CURR0],['Q',plPct,PCT]].forEach(([c,v,fmt])=>{
        sc(ws.getCell(`${c}${tr}`),v,bg,c==='N',9,c==='P'?(pl<0?C.negative:C.positive):C.black,fmt as string,c==='N'?'left':'right')
      })
      ws.getRow(tr).height=14; tr++
    }
    const totFV=trades.reduce((s,t)=>s+t.finalValue,0),totEFC=trades.reduce((s,t)=>s+t.efc,0),totPL=totFV-totEFC
    ;[['N','TOTAL',''],['O',totEFC,CURR0],['P',totPL,CURR0],['Q',totFV?totPL/totFV:0,PCT]].forEach(([c,v,fmt])=>{
      sc(ws.getCell(`${c}${tr}`),v,C.goldLt,true,9,c==='P'?(totPL<0?C.negative:C.positive):C.black,fmt as string,c==='N'?'left':'right','medium')
    })
    ws.getRow(tr).height=18
  }

  // ══════════════════════════════════════════════════
  // 2. CVR TRADE
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('CVR Trade',{views:[{state:'frozen',ySplit:3}]})
    ws.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1}
    ;[24,18,16,14,14,14,14,14,14,14,14,16,14,12,14].forEach((w,i)=>ws.getColumn(i+1).width=w)

    hdrRow(ws,1,15,`CVR TRADE BREAKDOWN — ${projName}`)

    ;[['A:B','TRADE',C.navy,C.white],['C:F','VALUE',C.red,C.white],['G:I','COSTS TO DATE',C.navyMid,C.white],
      ['J:L','EFC BUILD-UP',C.olive,C.black],['M:O','PROFIT / LOSS',C.gold,C.black]
    ].forEach(([cols,label,bg,fc])=>{
      const[c1,c2]=(cols as string).split(':')
      ws.mergeCells(`${c1}2:${c2}2`)
      sc(ws.getCell(`${c1}2`),label,bg as string,true,9,fc as string,'','center')
      ws.getRow(2).height=15
    })

    ;[['A','Trade',C.navy,C.white],['B','Method',C.navy,C.white],
      ['C','Budget',C.navyMid,C.white],['D','Val Certified',C.red,C.white],['E','Vars N/A',C.red,C.white],['F','Final Value',C.red,C.white],
      ['G','Posted Cost',C.navyMid,C.white],['H','Accruals',C.navyMid,C.white],['I','Total CTD',C.navyMid,C.white],
      ['J','Committed',C.olive,C.black],['K','Uncommitted',C.olive,C.black],['L','EFC',C.olive,C.black],
      ['M','Proj P/L',C.gold,C.black],['N','P/L %',C.goldLt,C.black],['O','Left to Spend',C.goldLt,C.black],
    ].forEach(([col,label,bg,fc])=>{
      sc(ws.getCell(`${col}3`),label,bg as string,true,8,fc as string,'',col<='B'?'left':'right')
      ws.getRow(3).height=15
    })

    let r=4
    for(const t of trades){
      const fv=t.finalValue,pl=fv-t.efc,plPct=fv?pl/fv:0
      const plBg=pl<0?C.redLt:C.posGreen
      ;[['A',t.trade,C.white],['B',t.forecastMethod,C.surfLow],
        ['C',t.budget,C.surfLow,CURR0],['D',t.valueCertified,C.white,CURR0],['E',t.varsNotAgreed,C.white,CURR0],['F',fv,C.redLt,CURR0],
        ['G',t.postedCost,C.white,CURR0],['H',t.accruals,C.white,CURR0],['I',t.totalCTD,C.navyLt,CURR0],
        ['J',t.committed,C.white,CURR0],['K',t.uncommitted,C.oliveLt,CURR0],['L',t.efc,C.olive,CURR0],
        ['M',pl,plBg,CURR0],['N',plPct,C.goldLt,PCT],['O',t.efc-t.totalCTD,C.goldLt,CURR0],
      ].forEach(([col,val,bg,fmt])=>{
        sc(ws.getCell(`${col}${r}`),val,bg as string,col==='A'||col==='L',9,
          col==='M'?(pl<0?C.negative:C.positive):C.black,fmt as string,col<='B'?'left':'right')
      })
      ws.getRow(r).height=15; r++
    }

    const tots={fv:0,budget:0,ctd:0,comm:0,unc:0,efc:0}
    trades.forEach(t=>{tots.fv+=t.finalValue;tots.budget+=t.budget;tots.ctd+=t.totalCTD;tots.comm+=t.committed;tots.unc+=t.uncommitted;tots.efc+=t.efc})
    const totPL=tots.fv-tots.efc
    ;[['A','TOTAL',C.goldLt],['B','',C.goldLt],['C',tots.budget,C.goldLt,CURR0],['D','',C.goldLt],['E','',C.goldLt],['F',tots.fv,C.goldLt,CURR0],
      ['G','',C.goldLt],['H','',C.goldLt],['I',tots.ctd,C.goldLt,CURR0],['J',tots.comm,C.goldLt,CURR0],['K',tots.unc,C.goldLt,CURR0],['L',tots.efc,C.goldLt,CURR0],
      ['M',totPL,C.goldLt,CURR0],['N',tots.fv?totPL/tots.fv:0,C.goldLt,PCT],['O',tots.efc-tots.ctd,C.goldLt,CURR0]
    ].forEach(([col,val,bg,fmt])=>{
      sc(ws.getCell(`${col}${r}`),val,bg as string,true,9,col==='M'?(totPL<0?C.negative:C.positive):C.black,fmt as string,col<='B'?'left':'right','medium')
    })
    ws.getRow(r).height=18
  }

  // ══════════════════════════════════════════════════
  // 3. PRELIMS
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('Prelims',{views:[{state:'frozen',ySplit:4}]})
    ws.pageSetup={orientation:'landscape',fitToPage:true}
    ;[16,10,30,14,14,14,8,8,8,14,10,10,14,16,14,22].forEach((w,i)=>ws.getColumn(i+1).width=w)
    hdrRow(ws,1,16,`PRELIMINARIES REGISTER — ${projName}`)

    ;[['A:C','ITEM',C.navy,C.white],['D:F','COSTS',C.red,C.white],
      ['G:L','RATE BUILD-UP → UNCOMMITTED',C.olive,C.black],['M:O','PROJECTED FINAL COST',C.gold,C.black],['P:P','NOTES',C.navyMid,C.white]
    ].forEach(([cols,label,bg,fc])=>{
      const[c1,c2]=(cols as string).split(':')
      ws.mergeCells(`${c1}2:${c2}2`)
      sc(ws.getCell(`${c1}2`),label,bg as string,true,9,fc as string,'','center')
      ws.getRow(2).height=15
    })

    ;[['A','Section',C.navy,C.white],['B','Code',C.navy,C.white],['C','Description',C.navy,C.white],
      ['D','Budget',C.red,C.white],['E','CTD',C.red,C.white],['F','Committed',C.red,C.white],
      ['G','Util %',C.olive,C.black],['H','Qty',C.olive,C.black],['I','Unit',C.olive,C.black],
      ['J','Rate',C.olive,C.black],['K','Start Wk',C.olive,C.black],['L','Finish Wk',C.olive,C.black],
      ['M','Uncommitted',C.gold,C.black],['N','Proj Final Cost',C.gold,C.black],['O','▲ vs Budget',C.goldLt,C.black],['P','Notes',C.navyMid,C.white]
    ].forEach(([col,label,bg,fc])=>{
      sc(ws.getCell(`${col}3`),label,bg as string,true,8,fc as string,'',col<='C'?'left':'right')
      ws.getRow(3).height=15
    })

    let r=4; let curSec=''
    for(const p of prelims){
      if(p.section!==curSec){
        curSec=p.section
        ws.mergeCells(`A${r}:P${r}`)
        sc(ws.getCell(`A${r}`),p.section.toUpperCase(),C.navyLt,true,9,C.navy)
        ws.getRow(r).height=14; r++
      }
      const vsB=p.budget?p.budget-p.projected_final_cost:null
      ;[['A',p.section,C.white],['B',p.cost_code,C.white],['C',p.description,C.white],
        ['D',p.budget||0,C.input,CURR0],['E',p.ctd||0,C.input,CURR0],['F',p.committed||0,C.input,CURR0],
        ['G',p.utilisation_pct/100,C.white,PCT],['H',p.qty,C.white],['I',p.unit,C.white],
        ['J',p.rate||0,C.input,CURR0],['K',p.start_week,C.white],['L',p.finish_week,C.white],
        ['M',p.amount,C.goldLt,CURR0],['N',p.projected_final_cost,C.goldLt,CURR0],
        ['O',vsB,vsB!==null?(vsB<0?C.redLt:C.posGreen):C.white,vsB!==null?CURR0:undefined],
        ['P',p.notes||'',C.white]
      ].forEach(([col,val,bg,fmt])=>{
        if(!col) return
        sc(ws.getCell(`${String(col)}${r}`),val??'',bg as string,col==='N',9,
          col==='O'&&vsB!==null?(vsB<0?C.negative:C.positive):C.black,fmt as string,col<='C'?'left':'right')
      })
      ws.getRow(r).height=14; r++
    }
    ws.mergeCells(`A${r}:C${r}`)
    sc(ws.getCell(`A${r}`),'TOTAL PRELIMINARIES',C.goldLt,true,9,C.black,'','left','medium')
    ;[['D',prelims.reduce((s,p)=>s+p.budget,0)],['E',prelims.reduce((s,p)=>s+p.ctd,0)],
      ['F',prelims.reduce((s,p)=>s+p.committed,0)],['M',prelims.reduce((s,p)=>s+p.amount,0)],
      ['N',prelims.reduce((s,p)=>s+p.projected_final_cost,0)]
    ].forEach(([c,v])=>sc(ws.getCell(`${c}${r}`),v,C.goldLt,true,9,C.black,CURR0,'right','medium'))
    ws.getRow(r).height=16
  }

  // ══════════════════════════════════════════════════
  // 4. COST TO DATE
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('Cost to Date',{views:[{state:'frozen',ySplit:2}]})
    ws.pageSetup={orientation:'landscape',fitToPage:true}
    ;[20,12,30,16,16,16,16,14].forEach((w,i)=>ws.getColumn(i+1).width=w)
    hdrRow(ws,1,8,`COST TO DATE — ${projName}`)
    ;['Trade','Code','Description','Posted Cost','Accruals','Sub Recon','Total CTD','Category'].forEach((h,i)=>{
      sc(ws.getCell(`${String.fromCharCode(65+i)}2`),h,C.navy,true,8,C.white,'',i>=3?'right':'left')
      ws.getRow(2).height=15
    })
    let r=3,curTrade='',ts={p:0,a:0,s:0,t:0}
    for(const row of ctdRows){
      if(row.trade!==curTrade){
        if(curTrade){
          ws.mergeCells(`A${r}:C${r}`)
          sc(ws.getCell(`A${r}`),`${curTrade} — Subtotal`,C.navyLt,true,9)
          ;[['D',ts.p],['E',ts.a],['F',ts.s],['G',ts.t]].forEach(([c,v])=>sc(ws.getCell(`${c}${r}`),v,C.navyLt,true,9,C.black,CURR0,'right','medium'))
          ws.getRow(r).height=14; r++; ts={p:0,a:0,s:0,t:0}
        }
        curTrade=row.trade as string
        tradeGroupRow(ws,r,8,row.trade as string); r++
      }
      const p=Number(row.posted_cost)||0,a=Number(row.accruals)||0,s=Number(row.sub_recon)||0,t=p+a+s
      ts.p+=p;ts.a+=a;ts.s+=s;ts.t+=t
      ;[row.trade,row.code,row.cc_desc,p,a,s,t,row.category].forEach((v,i)=>{
        sc(ws.getCell(`${String.fromCharCode(65+i)}${r}`),v??'',i>=3&&i<=6?C.input:C.white,false,9,C.black,i>=3&&i<=6?CURR0:undefined,i>=3?'right':'left')
      })
      ws.getRow(r).height=14; r++
    }
    const gt=ctdRows.reduce((s,r)=>s+(Number(r.posted_cost)||0)+(Number(r.accruals)||0)+(Number(r.sub_recon)||0),0)
    grandTotalRow(ws,r,'F',[['G',gt]])
  }

  // ══════════════════════════════════════════════════
  // 5. COMMITTED
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('Committed',{views:[{state:'frozen',ySplit:2}]})
    ws.pageSetup={orientation:'landscape',fitToPage:true}
    ;[18,20,28,14,8,12,16,16,14].forEach((w,i)=>ws.getColumn(i+1).width=w)
    hdrRow(ws,1,9,`COMMITTED COSTS REGISTER — ${projName}`)
    ;['Trade','Supplier','Description','Status','Qty','Unit','Unit Rate','Total','Code'].forEach((h,i)=>{
      sc(ws.getCell(`${String.fromCharCode(65+i)}2`),h,C.navy,true,8,C.white,'',i>=4?'right':'left')
      ws.getRow(2).height=15
    })
    const sBg:{[k:string]:string}={Placed:C.posGreen,Pending:C.goldLt,Provisional:C.redLt,Forecast:C.navyLt,'On Hold':C.surf,Cancelled:C.redLt}
    let r=3,curTrade='',tot=0
    for(const row of committedRows){
      if(row.trade!==curTrade){
        if(curTrade){
          ws.mergeCells(`A${r}:G${r}`)
          sc(ws.getCell(`A${r}`),`${curTrade} — Subtotal`,C.navyLt,true,9)
          sc(ws.getCell(`H${r}`),tot,C.navyLt,true,9,C.black,CURR0,'right','medium')
          ws.getRow(r).height=14; r++; tot=0
        }
        curTrade=row.trade as string
        tradeGroupRow(ws,r,9,row.trade as string); r++
      }
      const t=Number(row.total)||0; tot+=t
      ;[row.trade,row.supplier,row.cc_desc,row.status,row.qty,row.unit,row.unit_rate,t,row.code].forEach((v,i)=>{
        sc(ws.getCell(`${String.fromCharCode(65+i)}${r}`),v??'',i===3?(sBg[row.status as string]||C.white):i===7?C.input:C.white,
          false,9,C.black,i===6||i===7?CURR0:undefined,i>=4?'right':'left')
      })
      ws.getRow(r).height=14; r++
    }
    grandTotalRow(ws,r,'G',[['H',committedRows.reduce((s,r)=>s+(Number(r.total)||0),0)]])
  }

  // ══════════════════════════════════════════════════
  // 6. FORECAST
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('Forecast',{views:[{state:'frozen',ySplit:2}]})
    ws.pageSetup={orientation:'landscape',fitToPage:true}
    ;[18,20,12,16,8,8,8,16,16,20].forEach((w,i)=>ws.getColumn(i+1).width=w)
    hdrRow(ws,1,10,`FORECAST SHEET — ${projName}`)
    ;['Trade','Supplier','Code','Status','Factor','Qty','Unit','Rate','Total','Comment'].forEach((h,i)=>{
      sc(ws.getCell(`${String.fromCharCode(65+i)}2`),h,i>=4?C.olive:C.navy,true,8,i>=4?C.black:C.white,'',i>=4?'right':'left')
      ws.getRow(2).height=15
    })
    const sBg:{[k:string]:string}={Estimate:C.navyLt,Quote:C.navyLt,Final:C.posGreen,'Variation - Recoverable':C.goldLt,'Variation - Non Recoverable':C.redLt,Contingency:C.oliveLt}
    let r=3,curTrade='',tot=0
    for(const row of forecastRows){
      if(row.trade!==curTrade){
        if(curTrade){
          ws.mergeCells(`A${r}:H${r}`)
          sc(ws.getCell(`A${r}`),`${curTrade} — Subtotal`,C.navyLt,true,9)
          sc(ws.getCell(`I${r}`),tot,C.navyLt,true,9,C.black,CURR0,'right','medium')
          ws.getRow(r).height=14; r++; tot=0
        }
        curTrade=row.trade as string
        tradeGroupRow(ws,r,10,row.trade as string); r++
      }
      const t=Number(row.total)||0; tot+=t
      ;[row.trade,row.supplier,row.cc_code,row.status,row.factor,row.quantity,row.unit,row.rate,t,row.comment].forEach((v,i)=>{
        sc(ws.getCell(`${String.fromCharCode(65+i)}${r}`),v??'',i===3?(sBg[row.status as string]||C.white):i===8?C.oliveLt:C.white,
          false,9,C.black,i===7||i===8?CURR0:undefined,i>=4?'right':'left')
      })
      ws.getRow(r).height=14; r++
    }
    grandTotalRow(ws,r,'H',[['I',forecastRows.reduce((s,r)=>s+(Number(r.total)||0),0)]])
  }

  // ══════════════════════════════════════════════════
  // 7. VARIATIONS
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('Variations',{views:[{state:'frozen',ySplit:2}]})
    ws.pageSetup={orientation:'landscape',fitToPage:true}
    ;[10,32,18,14,14,16,16,16,16,24].forEach((w,i)=>ws.getColumn(i+1).width=w)
    hdrRow(ws,1,10,`VARIATIONS REGISTER — ${projName}`)
    ;['Ref','Description','Status','Submitted','Approved','Income','Cost Estimate','Cost Actual','Margin','Notes'].forEach((h,i)=>{
      sc(ws.getCell(`${String.fromCharCode(65+i)}2`),h,i>=5?C.red:C.navy,true,8,C.white,'',i>=5?'right':'left')
      ws.getRow(2).height=15
    })
    const sBg:{[k:string]:string}={Approved:C.posGreen,Submitted:C.navyLt,Pending:C.goldLt,Rejected:C.redLt,'On Hold':C.surf}
    let r=3
    for(const v of variations){
      const inc=Number(v.income_value)||0,cE=Number(v.cost_estimate)||0,cA=Number(v.cost_actual)||0,cost=cA||cE,margin=inc-cost
      ;[v.ref,v.description,v.status,v.date_submitted,v.date_approved,inc,cE,cA||null,margin,v.notes].forEach((val,i)=>{
        sc(ws.getCell(`${String.fromCharCode(65+i)}${r}`),val??'',
          i===2?(sBg[v.status]||C.white):i===8?(margin<0?C.redLt:C.posGreen):C.white,
          i===0,9,i===8?(margin<0?C.negative:C.positive):C.black,
          i>=5&&i<=8?CURR0:(i===3||i===4)?'DD-MMM-YY':undefined,i>=5?'right':'left')
      })
      ws.getRow(r).height=15; r++
    }
    const tI=variations.reduce((s,v)=>s+(Number(v.income_value)||0),0)
    const tCE=variations.reduce((s,v)=>s+(Number(v.cost_estimate)||0),0)
    const tCA=variations.reduce((s,v)=>s+(Number(v.cost_actual)||0),0)
    const tM=tI-(tCA||tCE)
    ws.mergeCells(`A${r}:E${r}`)
    sc(ws.getCell(`A${r}`),`TOTAL (${variations.length} variations)`,C.goldLt,true,9,C.black,'','left','medium')
    ;[['F',tI],['G',tCE],['H',tCA],['I',tM]].forEach(([c,v])=>
      sc(ws.getCell(`${c}${r}`),v,C.goldLt,true,9,c==='I'?(tM<0?C.negative:C.positive):C.black,CURR0,'right','medium'))
    ws.getRow(r).height=16
  }

  // ══════════════════════════════════════════════════
  // 8. S-CURVE
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('S-Curve')
    ws.pageSetup={orientation:'landscape'}
    ;[14,16,16,16,16,16].forEach((w,i)=>ws.getColumn(i+1).width=w)
    hdrRow(ws,1,6,`S-CURVE — COST PROFILE — ${projName}`)
    ;['Period','Planned','Actual','Cumul Planned','Cumul Actual','Certified'].forEach((h,i)=>{
      sc(ws.getCell(`${String.fromCharCode(65+i)}2`),h,i===0?C.navy:C.navyMid,true,8,C.white,'',i===0?'left':'right')
      ws.getRow(2).height=15
    })
    let r=3
    for(const row of sCurveRows){
      ;[row.period_label,row.planned_cost,row.actual_cost,row.cumul_planned,row.cumul_actual,row.certified].forEach((v,i)=>{
        sc(ws.getCell(`${String.fromCharCode(65+i)}${r}`),v??0,r%2===0?C.surfLow:C.white,false,9,C.black,i>0?CURR0:undefined,i===0?'left':'right')
      })
      ws.getRow(r).height=14; r++
    }
    // Chart data available in rows above (open in Excel to create chart from data)
  }

  // ══════════════════════════════════════════════════
  // 9. COST CODES
  // ══════════════════════════════════════════════════
  {
    const ws=wb.addWorksheet('Cost Codes')
    ;[12,30,20,16,20].forEach((w,i)=>ws.getColumn(i+1).width=w)
    hdrRow(ws,1,5,`COST CODE REGISTER — ${projName}`)
    ;['Code','Description','Trade','Category','Notes'].forEach((h,i)=>{
      sc(ws.getCell(`${String.fromCharCode(65+i)}2`),h,C.navy,true,8,C.white)
      ws.getRow(2).height=15
    })
    const catBg:{[k:string]:string}={Labour:C.navyLt,Plant:C.oliveLt,Materials:C.olive,Subcontractor:C.goldLt,Indirect:C.surf}
    let r=3
    for(const cc of costCodes){
      ;[cc.code,cc.description,cc.trade,cc.category,cc.notes].forEach((v,i)=>{
        sc(ws.getCell(`${String.fromCharCode(65+i)}${r}`),v??'',i===3?(catBg[cc.category as string]||C.surf):C.white,i===0,9)
      })
      ws.getRow(r).height=14; r++
    }
  }

  const buf=await wb.xlsx.writeBuffer()
  const fn=`ExtraOver_${projName.replace(/[^a-z0-9]/gi,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`
  return new NextResponse(buf as any,{
    status:200,
    headers:{
      'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':`attachment; filename="${fn}"`,
    },
  })
}
