// Run with: npx tsx src/lib/seed.ts
import { db, initDB, cuid } from './db'

async function seed() {
  await initDB()

  // Clear all
  await db.executeMultiple(`
    DELETE FROM period_snapshots;
    DELETE FROM s_curve_rows;
    DELETE FROM value_periods;
    DELETE FROM cost_lines;
    DELETE FROM committed_lines;
    DELETE FROM forecast_lines;
    DELETE FROM cost_codes;
    DELETE FROM trades;
    DELETE FROM report_periods;
    DELETE FROM projects;
  `)

  const projectId = cuid()
  await db.execute({
    sql: `INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),datetime('now'))`,
    args: [projectId, 'New Project', 'PRJ-001', '',
      '', '', 0, 0, 0, 0,
      '2026-07-03', '2027-08-18', '2026-07-03', '2027-09-30'],
  })

  const periodId = cuid()
  await db.execute({
    sql: `INSERT INTO report_periods VALUES (?,?,?,?,1,NULL)`,
    args: [periodId, projectId, 'March 2026', '2026-03-31'],
  })

  // Trades — 16 trades matching the MBC Cost Code Register
  const tradeList = [
    ['Preliminaries',                          'PRE', 1],
    ['Site Preparation',                       '01',  2],
    ['Demolition',                             '02',  3],
    ['Foundations',                            '03',  4],
    ['Frame And Superstructure',               '04',  5],
    ['External Walls',                         '05',  6],
    ['Windows, External Doors And Glazed Systems', '06', 7],
    ['Roofing',                                '07',  8],
    ['Internal Walls And Partitions',          '08',  9],
    ['Internal Doors And Ironmongery',         '09',  10],
    ['Fire Protection (Passive)',              '10',  11],
    ['Finishes',                               '11',  12],
    ['Mechanical, Electrical And Plumbing (Mep)', '12', 13],
    ['Fittings, Furniture And Equipment (Ffe)','13',  14],
    ['Builders Work And Associated Items',     '14',  15],
    ['External Works',                         '15',  16],
  ] as [string, string, number][]

  for (const [name, prefix, sort] of tradeList) {
    const method = name === 'Preliminaries' ? 'prelims' : 'budget_remaining'
    await db.execute({
      sql: `INSERT INTO trades (id,project_id,name,code_prefix,sort_order,value_certified,vars_not_agreed,adjustments,forecast_method,forecast_hard_key,budget) VALUES (?,?,?,?,?,0,0,0,?,NULL,0)`,
      args: [cuid(), projectId, name, prefix, sort, method],
    })
  }

  // BCIS SFCA 4th Edition — Cost Codes
  const codes: [string, string, string, string][] = [
    ['1.01', 'Excavation & Earthworks', 'Substructure', 'Subcontractor'],
    ['1.02', 'Piling', 'Substructure', 'Subcontractor'],
    ['1.03', 'Pile Caps & Ground Beams', 'Substructure', 'Subcontractor'],
    ['1.04', 'Strip & Pad Foundations', 'Substructure', 'Subcontractor'],
    ['1.05', 'Raft Foundation', 'Substructure', 'Subcontractor'],
    ['1.06', 'Basement Structure', 'Substructure', 'Subcontractor'],
    ['1.07', 'Waterproofing & Tanking', 'Substructure', 'Subcontractor'],
    ['1.08', 'Ground Floor Slab', 'Substructure', 'Subcontractor'],
    ['1.09', 'Retaining Walls', 'Substructure', 'Subcontractor'],
    ['1.10', 'Drainage Below Slab', 'Substructure', 'Subcontractor'],
    ['2.1.01', 'Structural Steel Frame', 'Frame', 'Subcontractor'],
    ['2.1.02', 'Steel Connections & Ancillaries', 'Frame', 'Subcontractor'],
    ['2.1.03', 'Concrete Frame - Columns', 'Frame', 'Subcontractor'],
    ['2.1.04', 'Concrete Frame - Beams', 'Frame', 'Subcontractor'],
    ['2.1.05', 'Concrete Frame - Walls & Cores', 'Frame', 'Subcontractor'],
    ['2.1.06', 'Concrete Formwork', 'Frame', 'Labour'],
    ['2.1.07', 'Concrete Reinforcement', 'Frame', 'Materials'],
    ['2.1.08', 'Precast Concrete Elements', 'Frame', 'Subcontractor'],
    ['2.1.09', 'Timber Frame System', 'Frame', 'Subcontractor'],
    ['2.1.10', 'Post-Tensioning', 'Frame', 'Subcontractor'],
    ['2.2.01', 'Concrete Upper Floor Slabs', 'Upper Floors', 'Subcontractor'],
    ['2.2.02', 'Precast / Hollowcore Planks', 'Upper Floors', 'Subcontractor'],
    ['2.2.03', 'Composite Steel Deck', 'Upper Floors', 'Subcontractor'],
    ['2.2.04', 'Timber Upper Floors', 'Upper Floors', 'Subcontractor'],
    ['2.2.05', 'Structural Screeds to Upper Floors', 'Upper Floors', 'Subcontractor'],
    ['2.3.01', 'Roof Structure & Timberwork', 'Roof', 'Subcontractor'],
    ['2.3.02', 'Flat Roof Membrane System', 'Roof', 'Subcontractor'],
    ['2.3.03', 'Pitched Roof Covering', 'Roof', 'Subcontractor'],
    ['2.3.04', 'Standing Seam Metal Roof', 'Roof', 'Subcontractor'],
    ['2.3.05', 'Roof Insulation', 'Roof', 'Materials'],
    ['2.3.06', 'Rooflights & Roof Glazing', 'Roof', 'Subcontractor'],
    ['2.3.07', 'Rainwater Outlets & Drainage', 'Roof', 'Subcontractor'],
    ['2.3.08', 'Roof Trims, Flashings & Eaves', 'Roof', 'Subcontractor'],
    ['2.3.09', 'Green / Sedum Roof System', 'Roof', 'Subcontractor'],
    ['2.3.10', 'Roof Safety Systems & Anchors', 'Roof', 'Subcontractor'],
    ['2.4.01', 'Concrete Stairs', 'Stairs & Ramps', 'Subcontractor'],
    ['2.4.02', 'Steel Stairs', 'Stairs & Ramps', 'Subcontractor'],
    ['2.4.03', 'Feature / Architectural Stairs', 'Stairs & Ramps', 'Subcontractor'],
    ['2.4.04', 'External Escape Stairs', 'Stairs & Ramps', 'Subcontractor'],
    ['2.4.05', 'Ramps & Accessibility Features', 'Stairs & Ramps', 'Subcontractor'],
    ['2.4.06', 'Balustrades & Handrails', 'Stairs & Ramps', 'Subcontractor'],
    ['2.5.01', 'Masonry External Walls', 'External Walls', 'Subcontractor'],
    ['2.5.02', 'Cavity Wall Insulation', 'External Walls', 'Materials'],
    ['2.5.03', 'Masonry Support Angles & Ancillaries', 'External Walls', 'Materials'],
    ['2.5.04', 'Rainscreen Cladding System', 'External Walls', 'Subcontractor'],
    ['2.5.05', 'Curtain Walling', 'External Walls', 'Subcontractor'],
    ['2.5.06', 'Metal / Profiled Sheet Cladding', 'External Walls', 'Subcontractor'],
    ['2.5.07', 'Render & External Coatings', 'External Walls', 'Subcontractor'],
    ['2.5.08', 'External Wall Insulation (EWI)', 'External Walls', 'Subcontractor'],
    ['2.5.09', 'Feature Cladding / Brickslip', 'External Walls', 'Subcontractor'],
    ['2.5.10', 'Masonry Accessories (Ties, DPC, Lintels)', 'External Walls', 'Materials'],
    ['2.6.01', 'Windows - Aluminium / PVC-U', 'Windows & External Doors', 'Subcontractor'],
    ['2.6.02', 'Windows - Timber', 'Windows & External Doors', 'Subcontractor'],
    ['2.6.03', 'External Doors - Aluminium Framed', 'Windows & External Doors', 'Subcontractor'],
    ['2.6.04', 'External Doors - Steel Security', 'Windows & External Doors', 'Subcontractor'],
    ['2.6.05', 'Automatic Sliding / Swing Doors', 'Windows & External Doors', 'Subcontractor'],
    ['2.6.06', 'Roller Shutters & Sectional Doors', 'Windows & External Doors', 'Subcontractor'],
    ['2.6.07', 'Shopfront Glazing', 'Windows & External Doors', 'Subcontractor'],
    ['2.6.08', 'Louvres & External Grilles', 'Windows & External Doors', 'Subcontractor'],
    ['2.6.09', 'Perimeter Flashings & Ancillaries', 'Windows & External Doors', 'Materials'],
    ['2.7.01', 'Blockwork - Internal Walls', 'Internal Walls & Partitions', 'Labour'],
    ['2.7.02', 'Blockwork - Fire / Acoustic Rated', 'Internal Walls & Partitions', 'Labour'],
    ['2.7.03', 'Metal Stud Partition Framing', 'Internal Walls & Partitions', 'Subcontractor'],
    ['2.7.04', 'Plasterboard - Single Layer', 'Internal Walls & Partitions', 'Subcontractor'],
    ['2.7.05', 'Plasterboard - Multi-Layer (Fire / Acoustic)', 'Internal Walls & Partitions', 'Subcontractor'],
    ['2.7.06', 'Proprietary Acoustic Partition', 'Internal Walls & Partitions', 'Subcontractor'],
    ['2.7.07', 'Glazed Internal Partitions', 'Internal Walls & Partitions', 'Subcontractor'],
    ['2.8.01', 'Internal Door Sets - Standard', 'Internal Doors', 'Subcontractor'],
    ['2.8.02', 'Internal Door Sets - Fire Rated', 'Internal Doors', 'Subcontractor'],
    ['2.8.03', 'Sliding & Pocket Doors', 'Internal Doors', 'Subcontractor'],
    ['2.8.04', 'Ironmongery - Scheduled Allowance', 'Internal Doors', 'Materials'],
    ['2.8.05', 'Fire Shutters & Curtains', 'Internal Doors', 'Subcontractor'],
    ['3.1.01', 'Plaster / Render to Masonry', 'Wall Finishes', 'Subcontractor'],
    ['3.1.02', 'Skim Coat / Dry Lining Finish', 'Wall Finishes', 'Subcontractor'],
    ['3.1.03', 'Ceramic / Porcelain Wall Tiling', 'Wall Finishes', 'Subcontractor'],
    ['3.1.04', 'Natural Stone Wall Cladding', 'Wall Finishes', 'Subcontractor'],
    ['3.1.05', 'Painting & Decorating - Walls', 'Wall Finishes', 'Subcontractor'],
    ['3.1.06', 'Wall Coverings & Wallpaper', 'Wall Finishes', 'Subcontractor'],
    ['3.2.01', 'Floor Screed', 'Floor Finishes', 'Subcontractor'],
    ['3.2.02', 'Ceramic / Porcelain Floor Tiling', 'Floor Finishes', 'Subcontractor'],
    ['3.2.03', 'Natural Stone Flooring', 'Floor Finishes', 'Subcontractor'],
    ['3.2.04', 'Carpet & Underlay', 'Floor Finishes', 'Subcontractor'],
    ['3.2.05', 'Vinyl / LVT Flooring', 'Floor Finishes', 'Subcontractor'],
    ['3.2.06', 'Engineered Timber Flooring', 'Floor Finishes', 'Subcontractor'],
    ['3.2.07', 'Raised Access Flooring', 'Floor Finishes', 'Subcontractor'],
    ['3.2.08', 'Polished / Sealed Concrete', 'Floor Finishes', 'Subcontractor'],
    ['3.2.09', 'Entrance Matting & Grilles', 'Floor Finishes', 'Materials'],
    ['3.3.01', 'Plasterboard Ceiling - Direct Fixed', 'Ceiling Finishes', 'Subcontractor'],
    ['3.3.02', 'Plasterboard Ceiling - Suspended', 'Ceiling Finishes', 'Subcontractor'],
    ['3.3.03', 'Mineral / Metal Tile Suspended Ceiling', 'Ceiling Finishes', 'Subcontractor'],
    ['3.3.04', 'Feature Ceiling System', 'Ceiling Finishes', 'Subcontractor'],
    ['3.3.05', 'Painting & Decorating - Ceilings', 'Ceiling Finishes', 'Subcontractor'],
    ['4.01', 'Kitchen & Catering Equipment', 'Fittings, Furnishings & Equipment', 'Subcontractor'],
    ['4.02', 'Fixed Joinery & Millwork', 'Fittings, Furnishings & Equipment', 'Subcontractor'],
    ['4.03', 'Sanitary Accessories & Mirrors', 'Fittings, Furnishings & Equipment', 'Materials'],
    ['4.04', 'Signage & Wayfinding', 'Fittings, Furnishings & Equipment', 'Subcontractor'],
    ['4.05', 'Window Blinds & Soft Furnishings', 'Fittings, Furnishings & Equipment', 'Subcontractor'],
    ['4.06', 'White Goods & Domestic Equipment', 'Fittings, Furnishings & Equipment', 'Materials'],
    ['4.07', 'Specialist Equipment Allowance', 'Fittings, Furnishings & Equipment', 'Subcontractor'],
    ['4.08', 'Loose Furniture Allowance', 'Fittings, Furnishings & Equipment', 'Materials'],
    ['5.1.01', 'WC Suites & Flushing Cisterns', 'Sanitary Installations', 'Materials'],
    ['5.1.02', 'Wash Hand Basins & Pedestals', 'Sanitary Installations', 'Materials'],
    ['5.1.03', 'Shower Trays, Enclosures & Screens', 'Sanitary Installations', 'Subcontractor'],
    ['5.1.04', 'Baths & Panels', 'Sanitary Installations', 'Materials'],
    ['5.1.05', 'Urinals', 'Sanitary Installations', 'Materials'],
    ['5.1.06', 'Disabled / Assisted Bathroom Fittings', 'Sanitary Installations', 'Materials'],
    ['5.1.07', 'Sanitary Pipework & Connections', 'Sanitary Installations', 'Subcontractor'],
    ['5.1.08', 'Sanitary Ancillaries (Taps, Wastes)', 'Sanitary Installations', 'Materials'],
    ['5.3.01', 'Soil & Waste Pipework - Above Ground', 'Disposal Installations', 'Subcontractor'],
    ['5.3.02', 'Rainwater Pipework - Internal', 'Disposal Installations', 'Subcontractor'],
    ['5.3.03', 'Grease Traps & Interceptors', 'Disposal Installations', 'Subcontractor'],
    ['5.3.04', 'Sewage Treatment & Pumping', 'Disposal Installations', 'Subcontractor'],
    ['5.4.01', 'Cold Water Storage & Distribution', 'Water Installations', 'Subcontractor'],
    ['5.4.02', 'Hot Water Generation & Distribution', 'Water Installations', 'Subcontractor'],
    ['5.4.03', 'Calorifiers & Hot Water Cylinders', 'Water Installations', 'Subcontractor'],
    ['5.4.04', 'Booster Pumps & Pressurisation Sets', 'Water Installations', 'Subcontractor'],
    ['5.4.05', 'Water Treatment & Softening', 'Water Installations', 'Subcontractor'],
    ['5.5.01', 'Gas Boilers', 'Heat Source', 'Subcontractor'],
    ['5.5.02', 'Oil Boilers', 'Heat Source', 'Subcontractor'],
    ['5.5.03', 'Heat Pumps (Air / Ground Source)', 'Heat Source', 'Subcontractor'],
    ['5.5.04', 'District Heating Connection', 'Heat Source', 'Subcontractor'],
    ['5.5.05', 'Biomass / Renewable Heat Source', 'Heat Source', 'Subcontractor'],
    ['5.6.01', 'LPHW Heating Distribution Pipework', 'Space Heating & Air Treatment', 'Subcontractor'],
    ['5.6.02', 'Radiators & Panel Heaters', 'Space Heating & Air Treatment', 'Subcontractor'],
    ['5.6.03', 'Underfloor Heating', 'Space Heating & Air Treatment', 'Subcontractor'],
    ['5.6.04', 'Fan Coil Units', 'Space Heating & Air Treatment', 'Subcontractor'],
    ['5.6.05', 'Air Handling Units (AHU)', 'Space Heating & Air Treatment', 'Subcontractor'],
    ['5.6.06', 'Chiller Plant', 'Space Heating & Air Treatment', 'Subcontractor'],
    ['5.7.01', 'Ductwork - Supply & Extract', 'Ventilation', 'Subcontractor'],
    ['5.7.02', 'Fans, Dampers & Grilles', 'Ventilation', 'Subcontractor'],
    ['5.7.03', 'Mechanical Extract Ventilation (MEV)', 'Ventilation', 'Subcontractor'],
    ['5.7.04', 'Heat Recovery Ventilation (MVHR)', 'Ventilation', 'Subcontractor'],
    ['5.7.05', 'Smoke Extract & AOV Systems', 'Ventilation', 'Subcontractor'],
    ['5.7.06', 'Kitchen & Fume Extract', 'Ventilation', 'Subcontractor'],
    ['5.8.01', 'HV / LV Switchgear & Distribution Boards', 'Electrical Installations', 'Subcontractor'],
    ['5.8.02', 'Containment - Trunking, Conduit & Cable Tray', 'Electrical Installations', 'Subcontractor'],
    ['5.8.03', 'Power Wiring & Outlets', 'Electrical Installations', 'Subcontractor'],
    ['5.8.04', 'Lighting - General', 'Electrical Installations', 'Subcontractor'],
    ['5.8.05', 'Lighting - Emergency & Exit', 'Electrical Installations', 'Subcontractor'],
    ['5.8.06', 'Lighting - External & Feature', 'Electrical Installations', 'Subcontractor'],
    ['5.8.07', 'Earthing & Bonding', 'Electrical Installations', 'Subcontractor'],
    ['5.8.08', 'PV Solar Panels & Inverters', 'Electrical Installations', 'Subcontractor'],
    ['5.8.09', 'EV Charging Points', 'Electrical Installations', 'Subcontractor'],
    ['5.8.10', 'UPS & Standby Generation', 'Electrical Installations', 'Subcontractor'],
    ['5.10.01', 'Passenger Lifts', 'Lift & Conveyor Installations', 'Subcontractor'],
    ['5.10.02', 'Goods / Platform Lifts', 'Lift & Conveyor Installations', 'Subcontractor'],
    ['5.10.03', 'Escalators', 'Lift & Conveyor Installations', 'Subcontractor'],
    ['5.10.04', 'Lifting Equipment & Hoists', 'Lift & Conveyor Installations', 'Subcontractor'],
    ['5.11.01', 'Dry / Wet Riser Systems', 'Fire & Lightning Protection', 'Subcontractor'],
    ['5.11.02', 'Sprinkler System', 'Fire & Lightning Protection', 'Subcontractor'],
    ['5.11.03', 'Fire Detection & Alarm System', 'Fire & Lightning Protection', 'Subcontractor'],
    ['5.11.04', 'Emergency Lighting', 'Fire & Lightning Protection', 'Subcontractor'],
    ['5.11.05', 'Lightning Protection System', 'Fire & Lightning Protection', 'Subcontractor'],
    ['5.11.06', 'Gaseous Suppression System', 'Fire & Lightning Protection', 'Subcontractor'],
    ['5.12.01', 'Structured Data Cabling (IT/Voice)', 'Communication, Security & Control', 'Subcontractor'],
    ['5.12.02', 'CCTV System', 'Communication, Security & Control', 'Subcontractor'],
    ['5.12.03', 'Access Control & Door Entry', 'Communication, Security & Control', 'Subcontractor'],
    ['5.12.04', 'Intruder Alarm', 'Communication, Security & Control', 'Subcontractor'],
    ['5.12.05', 'Public Address / Nurse Call', 'Communication, Security & Control', 'Subcontractor'],
    ['5.12.06', 'BMS / Building Management System', 'Communication, Security & Control', 'Subcontractor'],
    ['5.12.07', 'Audio Visual Systems', 'Communication, Security & Control', 'Subcontractor'],
    ['5.13.01', 'Swimming Pool / Leisure Equipment', 'Specialist Installations', 'Subcontractor'],
    ['5.13.02', 'Medical / Laboratory Gases', 'Specialist Installations', 'Subcontractor'],
    ['5.13.03', 'Clean Room Fit-Out', 'Specialist Installations', 'Subcontractor'],
    ['5.14.01', 'Coring & Cutting for Services', 'Builder\'s Work in Connection', 'Labour'],
    ['5.14.02', 'Mechanical Firestopping', 'Builder\'s Work in Connection', 'Subcontractor'],
    ['5.14.03', 'Service Ducts & Plinths', 'Builder\'s Work in Connection', 'Labour'],
    ['5.14.04', 'Pipe Bridges & Support Steelwork', 'Builder\'s Work in Connection', 'Subcontractor'],
    ['5.14.05', 'Intumescent Paint to Structural Steel', 'Builder\'s Work in Connection', 'Subcontractor'],
    ['8.1.01', 'Site Clearance & Grubbing Up', 'Site Preparation Works', 'Subcontractor'],
    ['8.1.02', 'Topsoil Strip & Stockpile', 'Site Preparation Works', 'Labour'],
    ['8.1.03', 'Bulk Excavation', 'Site Preparation Works', 'Subcontractor'],
    ['8.1.04', 'Disposal of Excavated Material', 'Site Preparation Works', 'Subcontractor'],
    ['8.1.05', 'Dewatering & Ground Stabilisation', 'Site Preparation Works', 'Subcontractor'],
    ['8.1.06', 'Demolition of Existing Structures', 'Site Preparation Works', 'Subcontractor'],
    ['8.2.01', 'Sub-Base & Formation', 'Roads, Paths & Pavings', 'Subcontractor'],
    ['8.2.02', 'Tarmac / Asphalt Roadways & Car Parks', 'Roads, Paths & Pavings', 'Subcontractor'],
    ['8.2.03', 'Block Paving', 'Roads, Paths & Pavings', 'Subcontractor'],
    ['8.2.04', 'Concrete Paving', 'Roads, Paths & Pavings', 'Subcontractor'],
    ['8.2.05', 'Natural Stone Paving', 'Roads, Paths & Pavings', 'Subcontractor'],
    ['8.2.06', 'Kerbs, Edgings & Channels', 'Roads, Paths & Pavings', 'Subcontractor'],
    ['8.2.07', 'Line Markings & Traffic Signage', 'Roads, Paths & Pavings', 'Materials'],
    ['8.3.01', 'Topsoil & Soil Preparation', 'Soft Landscaping & Planting', 'Labour'],
    ['8.3.02', 'Turfing & Seeding', 'Soft Landscaping & Planting', 'Subcontractor'],
    ['8.3.03', 'Trees, Shrubs & Planting', 'Soft Landscaping & Planting', 'Subcontractor'],
    ['8.3.04', 'Irrigation Systems', 'Soft Landscaping & Planting', 'Subcontractor'],
    ['8.4.01', 'Security Fencing & Gates', 'Fencing, Railings & Walls', 'Subcontractor'],
    ['8.4.02', 'Timber Fencing & Palisade', 'Fencing, Railings & Walls', 'Subcontractor'],
    ['8.4.03', 'Railings & Balustrades (External)', 'Fencing, Railings & Walls', 'Subcontractor'],
    ['8.4.04', 'Boundary Walls - Masonry', 'Fencing, Railings & Walls', 'Subcontractor'],
    ['8.4.05', 'Retaining Walls (External)', 'Fencing, Railings & Walls', 'Subcontractor'],
    ['8.6.01', 'Surface Water Drainage', 'External Drainage', 'Subcontractor'],
    ['8.6.02', 'Foul Drainage - Below Ground', 'External Drainage', 'Subcontractor'],
    ['8.6.03', 'Soakaways & Attenuation Tanks', 'External Drainage', 'Subcontractor'],
    ['8.6.04', 'Manholes & Inspection Chambers', 'External Drainage', 'Subcontractor'],
    ['8.6.05', 'Oil / Petrol Interceptors', 'External Drainage', 'Subcontractor'],
    ['8.7.01', 'Water Supply - External', 'External Services', 'Subcontractor'],
    ['8.7.02', 'Gas Supply - External', 'External Services', 'Subcontractor'],
    ['8.7.03', 'Electrical Supply - External', 'External Services', 'Subcontractor'],
    ['8.7.04', 'Telecoms & Data Ducting - External', 'External Services', 'Subcontractor'],
    ['8.7.05', 'External Lighting', 'External Services', 'Subcontractor'],
    ['A.01', 'Contracts Manager / Project Director', 'Preliminaries', 'Labour'],
    ['A.02', 'Site Manager / General Foreman', 'Preliminaries', 'Labour'],
    ['A.03', 'Contractor\'s Quantity Surveyor', 'Preliminaries', 'Labour'],
    ['A.04', 'Site Engineer & Setting Out', 'Preliminaries', 'Labour'],
    ['A.05', 'Safety Officer / PSCS', 'Preliminaries', 'Labour'],
    ['A.06', 'Environmental Manager', 'Preliminaries', 'Labour'],
    ['A.07', 'Site Office - Units & Furniture', 'Preliminaries', 'Materials'],
    ['A.08', 'Welfare Facilities', 'Preliminaries', 'Materials'],
    ['A.09', 'Temporary Roads & Hardstanding', 'Preliminaries', 'Materials'],
    ['A.10', 'Temporary Services (Power, Water)', 'Preliminaries', 'Materials'],
    ['A.11', 'Plant & Equipment - General', 'Preliminaries', 'Materials'],
    ['A.12', 'Scaffolding & Access Equipment', 'Preliminaries', 'Subcontractor'],
    ['A.13', 'Craneage & Hoisting', 'Preliminaries', 'Materials'],
    ['A.14', 'Temporary Works Design & Execution', 'Preliminaries', 'Subcontractor'],
    ['A.15', 'Security - Hoardings, Fencing & Guards', 'Preliminaries', 'Subcontractor'],
    ['A.16', 'Environmental Controls & Protection', 'Preliminaries', 'Indirect'],
    ['A.17', 'Site Waste & Skip Hire', 'Preliminaries', 'Indirect'],
    ['A.18', 'Sundry Labour & General Attendance', 'Preliminaries', 'Labour'],
    ['A.19', 'Contractor All Risks Insurance', 'Preliminaries', 'Indirect'],
    ['A.20', 'Public Liability Insurance', 'Preliminaries', 'Indirect'],
    ['A.21', 'Performance Bond', 'Preliminaries', 'Indirect'],
    ['A.22', 'Employer\'s Liability Insurance', 'Preliminaries', 'Indirect'],
    ['A.23', 'Health & Safety (Statutory)', 'Preliminaries', 'Indirect'],
    ['A.24', 'Programme & Planning', 'Preliminaries', 'Indirect'],
    ['B.01', 'Head Office Overheads', 'Main Contractor\'s OHP', 'Indirect'],
    ['B.02', 'Main Contractor\'s Profit', 'Main Contractor\'s OHP', 'Indirect'],
    ['C.01', 'Design Development Contingency', 'Contingencies', 'Indirect'],
    ['C.02', 'Construction Risk Contingency', 'Contingencies', 'Indirect'],
    ['C.03', 'Client Change Contingency', 'Contingencies', 'Indirect'],
  ]


  const codeIdMap: Record<string, string> = {}
  for (const [code, desc, trade, cat] of codes) {
    const id = cuid()
    codeIdMap[code] = id
    await db.execute({
      sql: `INSERT INTO cost_codes VALUES (?,?,?,?,?,?,NULL)`,
      args: [id, projectId, code, desc, trade, cat],
    })
  }

  // Cost Lines — start blank, import via CSV or add manually
  // No demo cost lines seeded

  // Committed Lines — start blank
  // No demo committed lines seeded

  // Forecast Lines — start blank  
  // No demo forecast lines seeded

  // ── Mock Data ────────────────────────────────────────────────────────────
  // Project details
  await db.execute({
    sql: `UPDATE projects SET
      name=?, code=?, client=?, contract_type=?, prepared_by=?,
      contract_sum=?, approved_vars=?, original_budget=?, original_margin=?,
      revised_start=?, revised_finish=?
      WHERE id=?`,
    args: ['City Centre Office Block','PRJ-2024-01','Dublin City Council',
           'Design & Build (RIAI)','M. Burke QS',
           12500000, 125000, 11800000, 700000,
           '2024-03-01','2026-09-30', projectId],
  })

  // Trade budgets and value certified
  // BCIS SFCA — Trade budgets & value certified (€12.5m project)
  const tradeMockData: Record<string, { budget: number; vc: number; vna: number }> = {
    'Substructure':                       { budget: 980000,  vc: 980000, vna: 0 },
    'Frame':                              { budget: 2100000, vc: 1680000,vna: 0 },
    'Upper Floors':                       { budget: 420000,  vc: 280000, vna: 0 },
    'Roof':                               { budget: 380000,  vc: 0,      vna: 0 },
    'Stairs & Ramps':                     { budget: 145000,  vc: 0,      vna: 0 },
    'External Walls':                     { budget: 820000,  vc: 285000, vna: 0 },
    'Windows & External Doors':           { budget: 680000,  vc: 0,      vna: 0 },
    'Internal Walls & Partitions':        { budget: 280000,  vc: 0,      vna: 0 },
    'Internal Doors':                     { budget: 120000,  vc: 0,      vna: 0 },
    'Wall Finishes':                      { budget: 180000,  vc: 0,      vna: 0 },
    'Floor Finishes':                     { budget: 220000,  vc: 0,      vna: 0 },
    'Ceiling Finishes':                   { budget: 95000,   vc: 0,      vna: 0 },
    'Fittings, Furnishings & Equipment':  { budget: 280000,  vc: 0,      vna: 0 },
    'Sanitary Installations':             { budget: 185000,  vc: 0,      vna: 0 },
    'Disposal Installations':             { budget: 45000,   vc: 0,      vna: 0 },
    'Water Installations':                { budget: 82000,   vc: 0,      vna: 0 },
    'Heat Source':                        { budget: 125000,  vc: 0,      vna: 0 },
    'Space Heating & Air Treatment':      { budget: 380000,  vc: 0,      vna: 0 },
    'Ventilation':                        { budget: 185000,  vc: 0,      vna: 0 },
    'Electrical Installations':           { budget: 620000,  vc: 0,      vna: 42000 },
    'Lift & Conveyor Installations':      { budget: 145000,  vc: 0,      vna: 0 },
    'Fire & Lightning Protection':        { budget: 185000,  vc: 0,      vna: 0 },
    'Communication, Security & Control':  { budget: 95000,   vc: 0,      vna: 0 },
    'Specialist Installations':           { budget: 0,       vc: 0,      vna: 0 },
    "Builder's Work in Connection":       { budget: 85000,   vc: 0,      vna: 0 },
    'Site Preparation Works':             { budget: 185000,  vc: 185000, vna: 0 },
    'Roads, Paths & Pavings':             { budget: 120000,  vc: 0,      vna: 0 },
    'Soft Landscaping & Planting':        { budget: 65000,   vc: 0,      vna: 0 },
    'Fencing, Railings & Walls':          { budget: 28000,   vc: 0,      vna: 0 },
    'External Drainage':                  { budget: 82000,   vc: 0,      vna: 0 },
    'External Services':                  { budget: 95000,   vc: 0,      vna: 0 },
    'Preliminaries':                      { budget: 980000,  vc: 480000, vna: 0 },
    "Main Contractor's OHP":              { budget: 625000,  vc: 0,      vna: 0 },
    'Contingencies':                      { budget: 250000,  vc: 0,      vna: 0 },
  }
  const allTrades = (await db.execute({ sql: 'SELECT id, name FROM trades WHERE project_id=?', args: [projectId] })).rows
  for (const t of allTrades) {
    const mock = tradeMockData[t.name as string]
    if (mock) {
      await db.execute({
        sql: 'UPDATE trades SET budget=?, value_certified=?, vars_not_agreed=? WHERE id=?',
        args: [mock.budget, mock.vc, mock.vna, t.id],
      })
    }
  }

  // Cost code ID map for inserting lines
  const allCodes = (await db.execute({ sql: 'SELECT id, code FROM cost_codes WHERE project_id=?', args: [projectId] })).rows
  const cm: Record<string, string> = {}
  for (const c of allCodes) cm[c.code as string] = c.id as string

  // Cost to Date lines — BCIS codes
  const ctdLines: [string, number, number][] = [
    // Preliminaries
    ['A.01', 185000, 0], ['A.02', 142000, 0], ['A.03', 68000, 0],
    ['A.04', 52000, 0],  ['A.05', 38000, 0],  ['A.07', 18500, 2100],
    ['A.08', 9800,  1100],['A.11', 8500,  0],  ['A.12', 42000, 0],
    ['A.13', 28000, 0],  ['A.19', 18000, 0],  ['A.20', 6200,  0],
    // Site Preparation Works
    ['8.1.01', 32000, 0], ['8.1.02', 18500, 0], ['8.1.03', 68000, 0],
    ['8.1.04', 28000, 0], ['8.1.06', 95000, 0],
    // Substructure
    ['1.02', 185000, 0], ['1.03', 62000, 0], ['1.04', 82000, 0],
    ['1.07', 145000, 0], ['1.08', 120000, 0], ['1.09', 48000, 0],
    // Frame
    ['2.1.01', 420000, 0], ['2.1.02', 85000, 0], ['2.1.03', 185000, 0],
    ['2.1.04', 92000, 0],  ['2.1.05', 145000, 0], ['2.1.06', 82000, 0],
    ['2.1.07', 125000, 0], ['2.1.08', 285000, 12000],
    // Upper Floors
    ['2.2.01', 145000, 0], ['2.2.02', 82000, 0],
    // External Walls (partial)
    ['2.5.01', 125000, 0], ['2.5.02', 28000, 0], ['2.5.04', 82000, 8500],
  ]
  for (const [code, posted, acc] of ctdLines) {
    if (!cm[code]) continue
    await db.execute({
      sql: 'INSERT INTO cost_lines VALUES (?,?,?,?,?,?,?,NULL)',
      args: [cuid(), projectId, periodId, cm[code], posted, acc, 0],
    })
  }

  // Committed lines — BCIS codes
  const committedLines: [string, string, string, string, number|null, string|null, number][] = [
    ['A.01','Burke PM Ltd','Contracts Manager – 72wk','Placed',72,'Wks',252000],
    ['A.02','Site Solutions Ltd','Site Manager – 72wk','Placed',72,'Wks',216000],
    ['A.03','QS Partners Ltd','QS Services – 72wk','Placed',72,'Wks',180000],
    ['A.12','Scaffold Co Ltd','Scaffolding Package','Placed',1,'Item',185000],
    ['1.02','Piling & Ground Ltd','Piling Works','Placed',1,'Item',420000],
    ['1.03','Murphy Civil','Pile Caps & Ground Beams','Placed',1,'Item',185000],
    ['1.08','Murphy Civil','Ground Floor Slab','Placed',1,'Item',145000],
    ['2.1.01','Steel Structures Ltd','Structural Steelwork','Placed',1,'Item',820000],
    ['2.1.03','Mulligan Concrete','RC Frame - Columns','Placed',1,'Item',380000],
    ['2.5.04','Facade Contractors Ltd','Rainscreen Cladding','Placed',1,'Item',680000],
    ['2.6.01','Glazing Systems Ltd','Curtain Wall & Windows','Placed',1,'Item',540000],
    ['2.3.02','Roofing Solutions Ltd','Flat Roof Membrane System','Pending',1,'Item',285000],
    ['5.8.01','MEP Contractors Ltd','Electrical Package','Placed',1,'Item',620000],
    ['5.6.01','MEP Contractors Ltd','Heating Distribution','Placed',1,'Item',380000],
    ['5.11.02','Sprinkler Systems Ltd','Sprinkler System','Placed',1,'Item',185000],
    ['8.1.03','Earthworks Ltd','Bulk Excavation','Placed',1,'Item',145000],
  ]
  for (const [code, supplier, desc, status, qty, unit, total] of committedLines) {
    if (!cm[code]) continue
    await db.execute({
      sql: 'INSERT INTO committed_lines VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [cuid(), projectId, cm[code], supplier, desc, status, qty, unit, null, total, null],
    })
  }

  // Forecast lines — BCIS codes
  let fSort = 1
  const forecastLines: [string, string, string, number][] = [
    ['A.01','Burke PM Ltd','Final',252000],
    ['A.02','Site Solutions Ltd','Final',216000],
    ['A.03','QS Partners Ltd','Final',180000],
    ['A.05','Safety First Ltd','Estimate',68000],
    ['A.07','Portakabin Ltd','Final',38500],
    ['A.12','Scaffold Co Ltd','Final',185000],
    ['1.02','Piling & Ground Ltd','Final',420000],
    ['1.03','Murphy Civil','Final',185000],
    ['1.08','Murphy Civil','Final',145000],
    ['2.1.01','Steel Structures Ltd','Final',820000],
    ['2.1.03','Mulligan Concrete','Final',380000],
    ['2.2.01','Murphy Civil','Estimate',280000],
    ['2.3.02','Roofing Solutions Ltd','Quote',295000],
    ['2.5.04','Facade Contractors Ltd','Final',680000],
    ['2.6.01','Glazing Systems Ltd','Final',540000],
    ['2.7.03','Partition Co Ltd','Estimate',185000],
    ['2.8.01','Door Supplies Ltd','Estimate',120000],
    ['3.1.05','Painting Contractors Ltd','Estimate',180000],
    ['3.2.01','Screed & Floor Ltd','Estimate',85000],
    ['3.2.04','Carpet & Floor Ltd','Estimate',95000],
    ['5.8.01','MEP Contractors Ltd','Final',620000],
    ['5.6.01','MEP Contractors Ltd','Final',380000],
    ['5.11.02','Sprinkler Systems Ltd','Final',185000],
    ['5.10.01','Lift Solutions Ltd','Estimate',145000],
    ['5.12.01','ICT Cabling Ltd','Estimate',95000],
    ['8.1.03','Earthworks Ltd','Final',145000],
    ['8.2.02','Civils & Paving Ltd','Estimate',120000],
    ['8.6.01','Drainage Ltd','Estimate',82000],
  ]
  for (const [code, supplier, status, total] of forecastLines) {
    if (!cm[code]) continue
    await db.execute({
      sql: 'INSERT INTO forecast_lines VALUES (?,?,?,NULL,?,?,?,?,?,?,?,?,NULL)',
      args: [cuid(), projectId, cm[code], fSort++, supplier, status, null, null, null, null, total],
    })
  }

  // Variations
  const variationsList = [
    ['VO-001','Additional Basement Level','Approved','2024-05-15','2024-06-10',185000,162000,0,'Approved at design meeting'],
    ['VO-002','Enhanced Facade Specification','Submitted','2024-08-20',null,68000,58000,0,'Client requested upgrade'],
    ['VO-003','Extra Lift Shaft','Approved','2024-09-01','2024-10-15',95000,82000,0,'Programme change by client'],
    ['VO-004','MEP Design Change','Pending','2024-11-05',null,42000,38000,0,'Services coordination issue'],
    ['VO-005','Roof Access Platform','Submitted','2024-12-01',null,28500,24000,0,'Safety requirement added'],
  ] as [string,string,string,string,string|null,number,number,number,string][]

  for (const [ref,desc,status,ds,da,income,costEst,costAct,notes] of variationsList) {
    await db.execute({
      sql: 'INSERT INTO variations VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [cuid(), projectId, ref, desc, status, ds, da, income, costEst, costAct, notes],
    })
  }

  // Prelim items with real rates
  await db.execute({ sql: 'DELETE FROM prelim_items WHERE project_id=?', args: [projectId] })
  const prelimItems = [
    ['Site Management','A.01','Contracts Manager / Project Director',       180000,0,0,1,'Weeks',2500,100,1,72,null],
    ['Site Management','A.02','Site Manager / General Foreman',            144000,0,0,1,'Weeks',2000,100,1,72,null],
    ['Site Management','A.03',"Contractor's Quantity Surveyor",            108000,0,0,1,'Weeks',1500,100,1,72,null],
    ['Site Management','A.04','Site Engineer & Setting Out',                72000,0,0,1,'Weeks',1000,100,1,72,null],
    ['Site Management','A.05','Safety Officer / PSCS',                     54000,0,0,1,'Weeks',750, 100,1,72,null],
    ['Welfare & Offices','A.07','Site Office Units & Furniture',            21600,0,0,1,'Weeks',300, 100,1,72,null],
    ['Welfare & Offices','A.08','Welfare Facilities',                       14400,0,0,1,'Weeks',200, 100,1,72,null],
    ['Plant & Equipment','A.11','Plant & Equipment - General',              18000,0,0,1,'Weeks',250, 100,1,72,null],
    ['Temporary Works','A.14','Temporary Works Design & Execution',         12000,0,0,1,'nr',12000,100,1,1,null],
    ['Bond & Insurance','A.19','Contractor All Risks Insurance',            48000,0,0,1,'nr',48000,100,1,1,null],
  ] as [string,string,string,number,number,number,number,string,number,number,number,number,null][]

  for (let i = 0; i < prelimItems.length; i++) {
    const [section,code,desc,budget,ctd,committed,qty,unit,rate,util,sw,fw,notes] = prelimItems[i]
    await db.execute({
      sql: 'INSERT INTO prelim_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [cuid(), projectId, section, code, desc, budget, ctd, committed, qty, unit, rate, util, sw, fw, i, notes],
    })
  }

  // Value period with real data
  await db.execute({ sql: 'DELETE FROM value_periods WHERE project_id=?', args: [projectId] })
  await db.execute({
    sql: 'INSERT INTO value_periods VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    args: [cuid(), projectId, periodId,
      4250000,  // cumul_claimed
      3980000,  // cumul_certified
      0,        // front_loading
      68000,    // unapproved_claims
      0,        // other_adjustments
      3750000,  // revenue_received
      3200000,  // total_paid
      -45000,   // risk_value
      85000,    // opportunity_value
    ],
  })

  // S-Curve data
  const sCurveData: [string, string, number, number, number][] = [
    ['Mar-24','2024-03-31', 85000,  85000, 0],
    ['Apr-24','2024-04-30', 125000, 210000,0],
    ['May-24','2024-05-31', 185000, 395000,85000],
    ['Jun-24','2024-06-30', 220000, 615000,210000],
    ['Jul-24','2024-07-31', 285000, 900000,380000],
    ['Aug-24','2024-08-31', 320000, 1220000,620000],
    ['Sep-24','2024-09-30', 380000, 1600000,900000],
    ['Oct-24','2024-10-31', 420000, 2020000,1280000],
    ['Nov-24','2024-11-30', 385000, 2405000,1680000],
    ['Dec-24','2024-12-31', 290000, 2695000,2020000],
    ['Jan-25','2025-01-31', 310000, 3005000,2380000],
    ['Feb-25','2025-02-28', 345000, 3350000,2695000],
    ['Mar-25','2025-03-31', 380000, 3730000,3005000],
    ['Apr-25','2025-04-30', 420000, 4150000,3350000],
    ['May-25','2025-05-31', 465000, 4615000,3730000],
    ['Jun-25','2025-06-30', 510000, 5125000,4150000],
  ]
  for (let i = 0; i < sCurveData.length; i++) {
    const [label, date, planned, cumulPlanned, cumulActual] = sCurveData[i]
    await db.execute({
      sql: 'INSERT INTO s_curve_rows VALUES (?,?,?,?,?,?,?,?)',
      args: [cuid(), projectId, label, date, i, cumulPlanned, i < 13 ? cumulActual : null, i < 13 ? cumulActual * 0.95 : null],
    })
  }

  // Value Period — seed a blank one
  await db.execute({
    sql: `INSERT INTO value_periods VALUES (?,?,?,0,0,0,0,0,0,0,0,0)`,
    args: [cuid(), projectId, periodId],
  })


  // Prelim items — seed 10 blank rows using MBC codes
  const blankPrelims = [
    ['Site Management',  'A.01', 'Contracts Manager / Project Director',    'Weeks'],
    ['Site Management',  'A.02', 'Site Manager / General Foreman',          'Weeks'],
    ['Site Management',  'A.03', "Contractor's Quantity Surveyor",          'Weeks'],
    ['Site Management',  'A.04', 'Site Engineer & Setting Out',              'Weeks'],
    ['Site Management',  'A.05', 'Safety Officer / PSCS',                   'Weeks'],
    ['Welfare & Offices','A.07', 'Site Office Units & Furniture',            'Weeks'],
    ['Welfare & Offices','A.08', 'Welfare Facilities',                       'Weeks'],
    ['Plant & Equipment','A.11', 'Plant & Equipment - General',              'Weeks'],
    ['Temporary Works',  'A.14', 'Temporary Works Design & Execution',       'nr'],
    ['Bond & Insurance', 'A.19', 'Contractor All Risks Insurance',           'nr'],
  ]
  for (let i = 0; i < blankPrelims.length; i++) {
    const [section, code, desc, unit] = blankPrelims[i]
    await db.execute({
      sql: `INSERT INTO prelim_items VALUES (?,?,?,?,?,0,0,0,1,?,0,100,1,52,?,NULL)`,
      args: [cuid(), projectId, section, code, desc, unit, i],
    })
  }


  // Variations — start blank, user adds their own
  // (No demo variations seeded)

  // Global Elements & Trades (shared across all projects)
  await db.execute('DELETE FROM global_elements')
  await db.execute('DELETE FROM global_trades')

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
  for (let i = 0; i < globalElements.length; i++) {
    await db.execute({ sql: `INSERT INTO global_elements VALUES (?,?,?)`, args: [cuid(), globalElements[i], i] })
  }
  for (let i = 0; i < globalTradesList.length; i++) {
    await db.execute({ sql: `INSERT INTO global_trades VALUES (?,?,?)`, args: [cuid(), globalTradesList[i], i] })
  }

  console.log('✅ Database seeded successfully')
}

seed().catch(console.error)
