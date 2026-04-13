import { initDB, db, cuid } from '@/lib/db'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  await initDB()

  async function create(formData: FormData) {
    'use server'
    await initDB()
    const id = cuid()
    await db.execute({
      sql: `INSERT INTO projects VALUES (?,?,?,?,?,?,0,0,0,0,NULL,NULL,NULL,NULL,datetime('now'),datetime('now'))`,
      args: [
        id,
        formData.get('name') as string,
        formData.get('code') as string,
        formData.get('client') as string,
        formData.get('contractType') as string,
        formData.get('preparedBy') as string,
      ],
    })
    const tradeNames = ['Preliminaries','Design','Civil Works','Electrical Works','Mechanical Works','Commissioning','Other / Contingency']
    const tradeBudgets: Record<string,number> = {}
    for (let i = 0; i < tradeNames.length; i++) {
      const method = tradeNames[i] === 'Preliminaries' ? 'prelims' : 'budget_remaining'
      await db.execute({
        sql: `INSERT INTO trades (id,project_id,name,code_prefix,sort_order,value_certified,vars_not_agreed,adjustments,forecast_method,forecast_hard_key,budget) VALUES (?,?,?,NULL,?,0,0,0,?,NULL,0)`,
        args: [cuid(), id, tradeNames[i], i + 1, method],
      })
    }
    // Seed 10 blank prelim rows
    const blankPrelims = [
      ['Site Management',  '16.001', 'Project Manager / Contracts Manager'],
      ['Site Management',  '16.002', 'Site Manager / General Foreman'],
      ['Site Management',  '16.004', 'Contractor\'s Quantity Surveyor'],
      ['Site Management',  '16.005', 'Site Engineer and Setting Out'],
      ['Site Management',  '16.006', 'Safety Officer / PSCS Representative'],
      ['Welfare & Offices','16.010', 'Site Office Units'],
      ['Welfare & Offices','16.011', 'Welfare Facilities'],
      ['Welfare & Offices','16.013', 'IT Equipment - Computers and Printers'],
      ['Running Costs',    '16.015', 'Stationery and Consumables'],
      ['Bond & Insurance', '16.069', 'Temporary Works Design'],
    ]
    for (let i = 0; i < blankPrelims.length; i++) {
      const [section, code, desc] = blankPrelims[i]
      const unit = section === 'Bond & Insurance' ? 'nr' : 'Weeks'
      await db.execute({
        sql: `INSERT INTO prelim_items VALUES (?,?,?,?,?,0,0,0,1,?,0,100,1,52,?,NULL)`,
        args: [cuid(), id, section, code, desc, unit, i],
      })
    }
    redirect(`/${id}/settings`)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6" style={{ background: '#1e3a5f' }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center text-white font-black text-[10px] tracking-tight">EO</div>
            <span className="text-white font-black text-lg uppercase tracking-tight">ExtraOver</span>
          </div>
          <p className="text-white/60 text-sm mt-1">Create a new project to get started</p>
        </div>

        <form action={create} className="px-8 py-6 space-y-4">
          {[
            ['name',         'Project Name *',    'e.g. City Centre Office Block', true],
            ['code',         'Project Code *',    'e.g. PRJ-001',                     true],
            ['client',       'Client',            'e.g. Dublin City Council',   false],
            ['contractType', 'Contract Type',     'e.g. Lump Sum / Design & Build',  false],
            ['preparedBy',   'Prepared By',       'e.g. John Smith QS',               false],
          ].map(([name, label, placeholder, required]) => (
            <div key={name as string}>
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1.5">
                {label as string}
              </label>
              <input
                name={name as string}
                placeholder={placeholder as string}
                required={!!required}
                className="w-full border border-outline-variant rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              />
            </div>
          ))}

          <div className="pt-2 space-y-2">
            <button type="submit"
              className="w-full text-white rounded py-3 font-bold text-sm uppercase tracking-tight transition-colors"
              style={{ background: '#1e3a5f' }}>
              Create Project →
            </button>
            <p className="text-[10px] text-on-surface-variant text-center">
              You'll be taken to Settings to enter the contract sum and programme dates.
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
