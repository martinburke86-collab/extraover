import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { getSession } from '@/lib/getSession'

export async function GET() {
  await initDB()
  const r = await db.execute('SELECT id, name, code FROM projects ORDER BY created_at DESC')
  return NextResponse.json(r.rows)
}

export async function DELETE(req: Request) {
  await initDB()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  await db.execute({ sql: `DELETE FROM projects WHERE id=?`, args: [id] })
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  await initDB()
  const session = await getSession()
  const b = await req.json()
  const id = cuid()

  try {

  await db.execute({
    sql: `INSERT INTO projects
            (id,name,code,client,contract_type,prepared_by,
             contract_sum,approved_vars,original_budget,original_margin,gifa,
             contract_start,contract_finish,revised_start,revised_finish,
             created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
    args: [
      id, b.name, b.code, b.client||'', b.contractType||'', b.preparedBy||'',
      Number(b.contractSum)||0, Number(b.approvedVars)||0,
      Number(b.originalBudget)||0, Number(b.originalMargin)||0,
      Number(b.gifa)||0, b.startDate||null, b.finishDate||null,
      b.startDate||null, b.finishDate||null,
    ],
  })

  const periodId = cuid()
  const label = b.reportPeriod || new Date().toLocaleDateString('en-IE',{month:'long',year:'numeric'})
  await db.execute({
    sql: `INSERT INTO report_periods VALUES (?,?,?,?,1,NULL)`,
    args: [periodId, id, label, new Date().toISOString().slice(0,10)],
  })

  const ALL: [string,string,number][] = [
    ['Substructure','1',1],['Frame','2.1',2],['Upper Floors','2.2',3],
    ['Roof','2.3',4],['Stairs & Ramps','2.4',5],['External Walls','2.5',6],
    ['Windows & External Doors','2.6',7],['Internal Walls & Partitions','2.7',8],
    ['Internal Doors','2.8',9],['Wall Finishes','3.1',10],
    ['Floor Finishes','3.2',11],['Ceiling Finishes','3.3',12],
    ['Fittings, Furnishings & Equipment','4',13],
    ['Sanitary Installations','5.1',14],['Disposal Installations','5.3',15],
    ['Water Installations','5.4',16],['Heat Source','5.5',17],
    ['Space Heating & Air Treatment','5.6',18],['Ventilation','5.7',19],
    ['Electrical Installations','5.8',20],['Fuel Installations','5.9',21],
    ['Lift & Conveyor Installations','5.10',22],
    ['Fire & Lightning Protection','5.11',23],
    ['Communication, Security & Control','5.12',24],
    ['Specialist Installations','5.13',25],
    ["Builder's Work in Connection",'5.14',26],
    ['Site Preparation Works','8.1',27],['Roads, Paths & Pavings','8.2',28],
    ['Soft Landscaping & Planting','8.3',29],['Fencing, Railings & Walls','8.4',30],
    ['External Drainage','8.6',31],['External Services','8.7',32],
    ['Preliminaries','A',33],["Main Contractor's OHP",'B',34],
    ['Contingencies','C',35],
  ]

  const selected: string[] = b.selectedElements || ALL.map(e=>e[0])
  const budgets: Record<string,number> = b.budgets || {}

  for (const [name,prefix,sort] of ALL) {
    if (!selected.includes(name)) continue
    const method = name==='Preliminaries' ? 'prelims' : 'budget_remaining'
    await db.execute({
      sql: `INSERT INTO trades (id,project_id,name,code_prefix,sort_order,value_certified,vars_not_agreed,adjustments,forecast_method,forecast_hard_key,budget) VALUES (?,?,?,?,?,0,0,0,?,NULL,?)`,
      args: [cuid(),id,name,prefix,sort,method,Number(budgets[name])||0],
    })
  }

  if (selected.includes('Preliminaries')) {
    const pre = [
      ['Site Management','A.01','Contracts Manager / Project Director','Weeks'],
      ['Site Management','A.02','Site Manager / General Foreman','Weeks'],
      ['Site Management','A.03',"Contractor's Quantity Surveyor",'Weeks'],
      ['Site Management','A.04','Site Engineer & Setting Out','Weeks'],
      ['Site Management','A.05','Safety Officer / PSCS','Weeks'],
      ['Welfare & Offices','A.07','Site Office Units & Furniture','Weeks'],
      ['Welfare & Offices','A.08','Welfare Facilities','Weeks'],
      ['Plant & Equipment','A.11','Plant & Equipment - General','Weeks'],
      ['Temporary Works','A.14','Temporary Works Design & Execution','nr'],
      ['Bond & Insurance','A.19','Contractor All Risks Insurance','nr'],
    ]
    for (let i=0;i<pre.length;i++) {
      const [sec,code,desc,unit] = pre[i]
      await db.execute({
        sql:`INSERT INTO prelim_items
               (id, project_id, sort_order, stage, section, description, cost_code,
                budget, ctd, committed, utilisation_pct, qty, unit, rate,
                start_week, finish_week, notes)
             VALUES (?,?,?,?,?,?,?,0,0,0,100,1,?,0,1,52,NULL)`,
        args:[cuid(),id,i,'Construction',sec,desc,code,unit],
      })
    }
  }

  await db.execute({
    sql:`INSERT INTO value_periods
           (id, project_id, period_id, cumul_claimed, cumul_certified, front_loading,
            unapproved_claims, other_adjustments, revenue_received, total_paid,
            risk_value, opportunity_value, app_ref)
         VALUES (?,?,?,0,0,0,0,0,0,0,0,0,NULL)`,
    args:[cuid(),id,periodId],
  })

  // Give the creating user owner-level access to this project
  if (session?.userId) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO user_projects (id, user_id, project_id, role) VALUES (?,?,?,?)`,
      args: [cuid(), session.userId, id, 'owner'],
    })
  }

  return NextResponse.json({ id })

  } catch (err: any) {
    console.error('Project creation failed:', err)
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error', detail: String(err) },
      { status: 500 }
    )
  }
}
