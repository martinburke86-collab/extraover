// Run with: npx tsx src/lib/seed.ts
// Adds a fully worked demo project (the same one as the "Add demo project"
// button) and fills the shared Elements / Trades lists if they are empty.
// Never deletes or changes existing data, so it is safe on any database.
import { db, initDB, cuid } from './db'
import { createDemoProject } from './demoProject'

// BCIS SFCA Group Elements
const globalElements = [
  'Substructure','Frame','Upper Floors','Roof','Stairs & Ramps',
  'External Walls','Windows & External Doors','Internal Walls & Partitions','Internal Doors',
  'Wall Finishes','Floor Finishes','Ceiling Finishes',
  'Fittings, Furnishings & Equipment',
  'Sanitary Installations','Disposal Installations','Water Installations',
  'Heat Source','Space Heating & Air Treatment','Ventilation',
  'Electrical Installations','Lift & Conveyor Installations',
  'Fire & Lightning Protection','Communication, Security & Control',
  "Builder's Work in Connection",
  'Site Preparation Works','Roads, Paths & Pavings','Soft Landscaping & Planting',
  'Fencing, Railings & Walls','External Drainage','External Services',
  'Preliminaries',"Main Contractor's OHP",'Contingencies',
]
const globalTradesList = [
  'Civil & Groundworks','Structural Concrete','Structural Steelwork',
  'External Envelope','Roofing','Windows & Glazing',
  'Mechanical','Electrical','Plumbing','Fire Protection',
  'Fit Out & Finishes','External Works','Prelims & Management',
]

async function fillIfEmpty(table: 'global_elements' | 'global_trades', names: string[]) {
  const n = Number(((await db.execute(`SELECT COUNT(*) as n FROM ${table}`)).rows[0] as any).n)
  if (n > 0) return
  for (let i = 0; i < names.length; i++) {
    await db.execute({ sql: `INSERT INTO ${table} (id, name, sort_order) VALUES (?,?,?)`, args: [cuid(), names[i], i] })
  }
}

async function seed() {
  await initDB()
  await fillIfEmpty('global_elements', globalElements)
  await fillIfEmpty('global_trades', globalTradesList)
  const owner = (await db.execute(`SELECT id FROM users WHERE global_role='owner' ORDER BY rowid LIMIT 1`)).rows[0] as any
  const { id } = await createDemoProject(owner ? String(owner.id) : null)
  console.log(`Demo project added: /${id}/dashboard`)
}

seed().catch(err => { console.error(err); process.exit(1) })
