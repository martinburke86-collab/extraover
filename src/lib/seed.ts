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

  // Cost Codes (287 codes from MBC Cost Code Register)
  const codes: [string, string, string, string][] = [
    ['01.001', 'Site Clearance', 'Site Preparation', 'Strip, grub up roots, remove all surface vegetation and debris'],
    ['01.002', 'Topsoil Strip and Stockpile', 'Site Preparation', 'Strip and store topsoil for re-use in external works'],
    ['01.003', 'Reduced Level Excavation', 'Site Preparation', 'Bulk excavation to formation level'],
    ['01.004', 'Trench Excavation', 'Site Preparation', 'Trenches for foundations, drainage and services'],
    ['01.005', 'Earthworks - Import and Fill', 'Site Preparation', 'Import of structural fill, compaction in layers'],
    ['01.006', 'Disposal of Excavated Material', 'Site Preparation', 'Off-site haulage and disposal; tip fees'],
    ['01.007', 'Dewatering and Ground Stabilisation', 'Site Preparation', 'Pumping, sump drainage; ground improvement works'],
    ['02.001', 'Asbestos Survey and Removal', 'Demolition', 'Type 3 survey, removal by licensed contractor, disposal'],
    ['02.002', 'Soft Strip', 'Demolition', 'Strip-out of fit-out, services, fixtures and finishes prior to demolition'],
    ['02.003', 'Demolition of Buildings and Structures', 'Demolition', 'Full structural demolition'],
    ['02.004', 'Partial Demolition / Selective Removal', 'Demolition', 'Selective structural removal; retain portions of existing'],
    ['02.005', 'Breaking Out Existing Hardstanding and Slabs', 'Demolition', 'RC slabs, concrete ground slabs, bases'],
    ['02.006', 'Making Good After Demolition', 'Demolition', 'Reinstatement of boundaries, surfaces, services after demolition'],
    ['03.001', 'Piling', 'Foundations', 'CFA, bored, driven, or micro-piling inc. trial piles'],
    ['03.002', 'Pile Caps', 'Foundations', 'Concrete pile caps, reinforcement and formwork'],
    ['03.003', 'Ground Beams', 'Foundations', 'RC ground beams connecting pile caps'],
    ['03.004', 'Strip Foundations', 'Foundations', 'Concrete strip footings inc. formwork and reinforcement'],
    ['03.005', 'Pad Foundations', 'Foundations', 'Isolated concrete pad bases'],
    ['03.006', 'Raft Foundations', 'Foundations', 'Raft slab, reinforcement, upstand beams'],
    ['03.007', 'Foundation Concrete', 'Foundations', 'Supply and place of structural concrete in foundations'],
    ['03.008', 'Foundation Formwork', 'Foundations', 'Shuttering to sides and faces of foundations'],
    ['03.009', 'Foundation Reinforcement', 'Foundations', 'Rebar - supply, cut, bend and fix'],
    ['03.010', 'Concrete Ancillaries', 'Foundations', 'Cast-in channels, inserts, holding-down bolts'],
    ['03.011', 'Tanking - External Applied Membrane', 'Foundations', 'Tanked waterproofing to below-ground walls and floors'],
    ['03.012', 'Cavity Drain Membrane System', 'Foundations', 'Dimple membrane, channels and sump pump'],
    ['03.013', 'Radon Barrier', 'Foundations', 'Radon membrane to floor; pipe and sumps where required'],
    ['03.014', 'Retaining Walls', 'Foundations', 'RC or masonry retaining walls; inc. drainage layer and backfill'],
    ['04.001', 'Structural Steel Frame', 'Frame And Superstructure', 'Fabricated steelwork, columns, beams, connections, PFC, angles'],
    ['04.002', 'Steel Connections and Baseplate Details', 'Frame And Superstructure', 'Bolted and welded connections, splice plates'],
    ['04.003', 'Structural Concrete - Columns', 'Frame And Superstructure', 'In-situ RC columns; formwork and reinforcement included'],
    ['04.004', 'Structural Concrete - Beams and Ring Beams', 'Frame And Superstructure', 'In-situ RC beams, up-stand and ring beams'],
    ['04.005', 'Structural Concrete - Slabs', 'Frame And Superstructure', 'Suspended RC slabs; flat slab, ribbed, coffered'],
    ['04.006', 'Structural Concrete - Walls', 'Frame And Superstructure', 'RC core walls, shear walls, lift shaft walls'],
    ['04.007', 'Formwork - General', 'Frame And Superstructure', 'All shuttering not captured above'],
    ['04.008', 'Reinforcement - General', 'Frame And Superstructure', 'All rebar supply and fix not captured above'],
    ['04.009', 'Post-Tensioning', 'Frame And Superstructure', 'PT tendons, stressing and anchorages'],
    ['04.010', 'Timber Frame System', 'Frame And Superstructure', 'Supply and erect structural timber frame panels and trusses'],
    ['04.011', 'Precast Concrete', 'Frame And Superstructure', 'Precast slabs (Hollowcore / Plank), stairs, beams, columns'],
    ['04.012', 'Off-Site Manufactured Structural Elements', 'Frame And Superstructure', 'CLT, modular frames, volumetric units'],
    ['04.013', 'Bathroom / Wet Room Pods', 'Frame And Superstructure', 'Factory-assembled pod supply and installation'],
    ['04.014', 'Structural Stairs - Concrete', 'Frame And Superstructure', 'In-situ or precast concrete stair flights; formwork and rebar'],
    ['04.015', 'Feature Stairs - Steel / Timber / Glass', 'Frame And Superstructure', 'Architectural stair structure'],
    ['04.016', 'Balustrades and Handrails', 'Frame And Superstructure', 'To all stair flights, mezzanines, voids and walkways'],
    ['05.001', 'Coring, Cutting and Chasing', 'Builders Work And Associated Items', 'Penetrations for MEP services through structure'],
    ['05.002', 'Grounds and Pattresses', 'Builders Work And Associated Items', 'Timber grounds, timber inserts and firrings to receive finishes'],
    ['05.003', 'GRP Ducts and Trays', 'Builders Work And Associated Items', 'Fibreglass cable ducts and service trays'],
    ['05.004', 'Preformed Floor Channels (Flowforge / Lindapter)', 'Builders Work And Associated Items', 'Proprietary cast-in floor channels'],
    ['05.005', 'Firestopping - Service Penetrations', 'Builders Work And Associated Items', 'Intumescent collars, pillows, batts at MEP penetrations'],
    ['05.006', 'Intumescent Paint to Structural Steel', 'Builders Work And Associated Items', 'Applied intumescent protection to steelwork for fire rating'],
    ['06.001', 'Brickwork - External Facing', 'External Walls', 'Facing brick to external elevations, coursing and bond type'],
    ['06.002', 'Blockwork - External Leaf', 'External Walls', 'Dense or lightweight block outer leaf of cavity wall'],
    ['06.003', 'Blockwork - Inner Leaf', 'External Walls', 'Block inner leaf of cavity wall'],
    ['06.004', 'Masonry Support Angles and Brackets', 'External Walls', 'Stainless or galvanised support angles at floor levels'],
    ['06.005', 'Lintels', 'External Walls', 'Steel or concrete lintels over openings'],
    ['06.006', 'Cills - Masonry / Precast / Stone', 'External Walls', 'Window and door cills'],
    ['06.007', 'Cavity Wall Insulation', 'External Walls', 'Full-fill or partial-fill rigid or mineral wool cavity batt'],
    ['06.008', 'External Wall Insulation (EWI) System', 'External Walls', 'Adhesive-fixed board, mesh, render base coat, finish'],
    ['06.009', 'Mortar', 'External Walls', 'Pointing and bedding mortar; coloured mortar where specified'],
    ['06.010', 'Wall Ties and Cavity Ancillaries', 'External Walls', 'Ties, clips, DPC, weepholes'],
    ['06.011', 'Brickslip Cladding System', 'External Walls', 'Brick-effect slip panels or individual slips on carrier rail'],
    ['06.012', 'Render and External Coating', 'External Walls', 'Through-colour or sand/cement render; Parex, K-Rend etc.'],
    ['06.013', 'Profiled Sheet Metal Cladding', 'External Walls', 'Sinusoidal or trapezoidal profile sheeting inc. liner'],
    ['06.014', 'Rainscreen Cladding - Panel System', 'External Walls', 'Fibre cement, ACM, terracotta or composite rainscreen panels'],
    ['06.015', 'Rainscreen Cladding - Carrier System', 'External Walls', 'Aluminium sub-frame, support rails and brackets'],
    ['06.016', 'Timber Cladding and Battens', 'External Walls', 'External hardwood or treated softwood board cladding'],
    ['07.001', 'Windows', 'Windows, External Doors And Glazed Systems', 'uPVC, aluminium or timber windows; all hardware included'],
    ['07.002', 'External Doors - Timber / Composite', 'Windows, External Doors And Glazed Systems', 'Front entrance and side access doors'],
    ['07.003', 'External Doors - Aluminium / Steel', 'Windows, External Doors And Glazed Systems', 'Commercial and high-traffic entrance doors'],
    ['07.004', 'Roller Shutter and Plant Access Doors', 'Windows, External Doors And Glazed Systems', 'Industrial roller shutters, sectional overhead doors'],
    ['07.005', 'Curtain Walling', 'Windows, External Doors And Glazed Systems', 'Structural glazed curtain walling system inc. capping and gaskets'],
    ['07.006', 'Shopfront Glazing', 'Windows, External Doors And Glazed Systems', 'Framed or frameless ground-floor commercial glazed screens'],
    ['07.007', 'Louvres and Ventilation Grilles', 'Windows, External Doors And Glazed Systems', 'Fixed or operable louvres for plant areas; external grilles'],
    ['07.008', 'EPDM Gaskets and Weathering Tapes', 'Windows, External Doors And Glazed Systems', 'Perimeter seals, gaskets and compression tapes'],
    ['07.009', 'Cills, Flashings and Window Ancillaries', 'Windows, External Doors And Glazed Systems', 'Sub-cills, perimeter flashings, DPC trays, cavity closers'],
    ['08.001', 'Roof Timberwork', 'Roofing', 'Rafters, purlins, joists, ridge boards and noggins'],
    ['08.002', 'Structural Roof Deck', 'Roofing', 'Plywood, OSB, or concrete deck to receive roofing membrane'],
    ['08.003', 'Fall Arrest and Anchor Systems', 'Roofing', 'Roof safety line, anchor points, walkways, guardrails'],
    ['08.004', 'Roof Access - Fixed Ladders and Hatches', 'Roofing', 'Internal and external fixed ladders; access hatch units'],
    ['08.005', 'Single Ply Membrane Roofing', 'Roofing', 'TPO / PVC / EPDM single ply inc. insulation and upstands'],
    ['08.006', 'Built-Up Felt Roofing', 'Roofing', 'Torch-on or cold-applied multi-layer felt system'],
    ['08.007', 'Standing Seam Metal Roofing', 'Roofing', 'Aluminium, zinc or steel standing seam roof system'],
    ['08.008', 'Green / Sedum Roof System', 'Roofing', 'Substrate, drainage layer and planting; all types'],
    ['08.009', 'Profiled Metal Roof Sheeting', 'Roofing', 'Trapezoidal or sinusoidal metal roof with liner and rooflights'],
    ['08.010', 'Roof Insulation - Mineral Wool', 'Roofing', 'Acoustic or thermal wool quilt above/below deck'],
    ['08.011', 'Roof Insulation - Rigid Board', 'Roofing', 'PIR, PUR or phenolic rigid board; warm roof build-up'],
    ['08.012', 'Roof Insulation - Tapered', 'Roofing', 'Tapered insulation to falls on flat roofs'],
    ['08.013', 'Vapour Control Layer', 'Roofing', 'VCL membrane to prevent interstitial condensation'],
    ['08.014', 'Rainwater Outlets and Siphonic Drainage', 'Roofing', 'Primary and emergency outlets; siphonic systems'],
    ['08.015', 'Gutters and Downpipes', 'Roofing', 'Eaves gutters, box gutters and vertical downpipes'],
    ['08.016', 'Roof Trims, Verges and Flashings', 'Roofing', 'Eaves trim, ridge cap, abutment flashings'],
    ['08.017', 'Fixed Rooflights', 'Roofing', 'Non-opening barrel vault, dome or flat glass rooflights'],
    ['08.018', 'Opening / Pivot Rooflights', 'Roofing', 'Motorised or manual opening rooflights and AOV units'],
    ['09.001', 'Blockwork - Internal Partitions', 'Internal Walls And Partitions', 'Lightweight or dense block internal walls'],
    ['09.002', 'Blockwork - Acoustic or Fire-Rated', 'Internal Walls And Partitions', 'Specified blockwork for fire compartmentation or acoustic separation'],
    ['09.003', 'Metal Stud Partition Framing', 'Internal Walls And Partitions', 'Stud and track framing to receive plasterboard'],
    ['09.004', 'Plasterboard - Single Layer', 'Internal Walls And Partitions', 'Single layer board to partitions and wall linings'],
    ['09.005', 'Plasterboard - Double or Multi-Layer', 'Internal Walls And Partitions', 'Enhanced acoustic or fire-rated multi-board assemblies'],
    ['09.006', 'Acoustic Partition System', 'Internal Walls And Partitions', 'Proprietary demountable or fixed acoustic partition'],
    ['09.007', 'Plasterboard Ceiling - Suspended', 'Internal Walls And Partitions', 'Metal grid and plasterboard ceiling; standard or fire-rated'],
    ['09.008', 'Proprietary Tile Suspended Ceiling', 'Internal Walls And Partitions', 'Armstrong or equivalent mineral / metal tile grid ceiling'],
    ['09.009', 'Feature Ceiling - Timber / Metal / GRG', 'Internal Walls And Partitions', 'Specialist architectural ceiling elements'],
    ['10.001', 'Internal Door Sets - Standard', 'Internal Doors And Ironmongery', 'Pre-hung door set inc. frame, stop and ironmongery allowance'],
    ['10.002', 'Internal Door Sets - Fire-Rated (FD30 / FD60)', 'Internal Doors And Ironmongery', 'Rated door sets with intumescent seals and closers'],
    ['10.003', 'Glazed Internal Screens and Borrowed Lights', 'Internal Doors And Ironmongery', 'Framed or frameless internal glazing'],
    ['10.004', 'Sliding and Pocket Door Systems', 'Internal Doors And Ironmongery', 'Track, hardware and leaf for sliding or pocket doors'],
    ['10.005', 'Door Frames and Linings', 'Internal Doors And Ironmongery', 'Softwood or hardwood frames and linings supplied separately'],
    ['10.006', 'Architraves and Door Stops', 'Internal Doors And Ironmongery', 'Planted architraves, door stops and beads'],
    ['10.007', 'Ironmongery - Scheduled Allowance', 'Internal Doors And Ironmongery', 'Lever handles, locks, hinges, door closers, signage plates'],
    ['10.008', 'Fire Shutters', 'Internal Doors And Ironmongery', 'Electrically operated fire-rated roller shutters'],
    ['10.009', 'Fire Curtains', 'Internal Doors And Ironmongery', 'Fabric fire curtain units for atria and openings'],
    ['11.001', 'Firestopping - Compartment Walls and Floors', 'Fire Protection (Passive)', 'Fire-rated sealing at structural penetrations and junctions'],
    ['11.002', 'Intumescent Collars and Wraps', 'Fire Protection (Passive)', 'Around plastic pipe penetrations through fire compartments'],
    ['11.003', 'Cavity Barriers', 'Fire Protection (Passive)', 'Fire-rated barriers in cavity wall, ceilings and roof spaces'],
    ['11.004', 'Fire Extinguishers and Blankets', 'Fire Protection (Passive)', 'Portable extinguishers, blankets and cabinets'],
    ['12.001', 'Sand and Cement Plaster', 'Finishes', 'Scratch coat and finishing coat on masonry'],
    ['12.002', 'Skim Coat Finish', 'Finishes', 'Finish coat on plasterboard or plaster; thin coat plaster'],
    ['12.003', 'Tape and Joint - Dry Lining', 'Finishes', 'Paper tape and jointing compound to plasterboard joints'],
    ['12.004', 'Painting - Walls and Ceilings', 'Finishes', 'Mist coat, two finish coats; emulsion or eggshell'],
    ['12.005', 'Painting - Timber (Woodwork)', 'Finishes', 'Prime, undercoat and gloss or satin finish to timber'],
    ['12.006', 'Painting - Metalwork', 'Finishes', 'Primer and finish coats to metal doors, frames and balustrades'],
    ['12.007', 'Wall Coverings and Wallpaper', 'Finishes', 'Vinyl or non-woven wallpaper; feature wall treatments'],
    ['12.008', 'Airtightness Membranes and Tapes', 'Finishes', 'Airtightness layer, proprietary tapes and junctions'],
    ['12.009', 'Floor Tiling - Ceramic / Porcelain', 'Finishes', 'Supply and lay; inc. adhesive, grout and tile trim'],
    ['12.010', 'Floor Tiling - Natural Stone', 'Finishes', 'Limestone, slate, marble; inc. sealing and jointing'],
    ['12.011', 'Wall Tiling - Ceramic / Porcelain', 'Finishes', 'Supply and lay; inc. adhesive, grout and trims'],
    ['12.012', 'Wall Tiling - Natural Stone', 'Finishes', 'Supply and lay stone wall tiles inc. sealing'],
    ['12.013', 'Vinyl Flooring - Sheet / LVT', 'Finishes', 'Homogeneous or heterogeneous vinyl; sheet or plank'],
    ['12.014', 'Carpet and Underlay', 'Finishes', 'Broadloom or carpet tile with appropriate underlay'],
    ['12.015', 'Engineered Timber Flooring', 'Finishes', 'Engineered hardwood boards; click or glue-fix'],
    ['12.016', 'Polished / Sealed Concrete Floor', 'Finishes', 'Power float finish, densifier, sealer or micro-cement coat'],
    ['12.017', 'Raised Access Flooring', 'Finishes', 'Pedestal and panel system; standard or high-load'],
    ['12.018', 'Screed - Sand and Cement', 'Finishes', 'Traditional sand-cement screed; bonded or unbonded'],
    ['12.019', 'Screed - Flowing Anhydrite', 'Finishes', 'Self-levelling liquid screed; particularly over UFH'],
    ['12.020', 'Skirting Boards and Architrave', 'Finishes', 'Painted MDF or hardwood skirting; ogee, torus or pencil-round'],
    ['13.001', 'HVAC - Air Handling Units and Plant', 'Mechanical, Electrical And Plumbing (Mep)', 'Supply and return AHUs; packaged plant; rooftop units'],
    ['13.002', 'HVAC - Ductwork and Distribution', 'Mechanical, Electrical And Plumbing (Mep)', 'Supply and extract ductwork, dampers, diffusers, grilles'],
    ['13.003', 'HVAC - Air Conditioning - Fan Coil / VRF', 'Mechanical, Electrical And Plumbing (Mep)', 'FCU, cassette, split and multi-split systems'],
    ['13.004', 'MVHR - Mechanical Ventilation with Heat Recovery', 'Mechanical, Electrical And Plumbing (Mep)', 'Residential or commercial MVHR unit and distribution'],
    ['13.005', 'Continuous Mechanical Extract - MEV', 'Mechanical, Electrical And Plumbing (Mep)', 'Bathroom and kitchen extract fans and ducting'],
    ['13.006', 'Boilers and Heating Plant', 'Mechanical, Electrical And Plumbing (Mep)', 'Gas, oil or heat pump boilers; primary plant and flue'],
    ['13.007', 'Underfloor Heating', 'Mechanical, Electrical And Plumbing (Mep)', 'Wet or electric UFH system; manifolds and pipe layout'],
    ['13.008', 'Radiators and Emitters', 'Mechanical, Electrical And Plumbing (Mep)', 'Panel radiators, towel rails, and associated valves'],
    ['13.009', 'Heat Interface Units (HIUs)', 'Mechanical, Electrical And Plumbing (Mep)', 'Apartment HIUs in district / communal heating systems'],
    ['13.010', 'Hot and Cold Water Services', 'Mechanical, Electrical And Plumbing (Mep)', 'Cold main, hot water cylinder / LTHW generation, distribution'],
    ['13.011', 'Sanitaryware - Supply and Fix', 'Mechanical, Electrical And Plumbing (Mep)', 'WC, WHB, shower, bath; inc. taps and wastes'],
    ['13.012', 'Gas Installation', 'Mechanical, Electrical And Plumbing (Mep)', 'Gas meter, internal distribution pipework and connections'],
    ['13.013', 'Above-Ground Drainage', 'Mechanical, Electrical And Plumbing (Mep)', 'Soil, waste and vent pipework inside building'],
    ['13.014', 'Below-Ground Drainage', 'Mechanical, Electrical And Plumbing (Mep)', 'Underground foul and surface water drainage networks'],
    ['13.015', 'Electrical - Distribution Boards and Switchgear', 'Mechanical, Electrical And Plumbing (Mep)', 'Main switchboard, sub-DBs, metering, busbar trunking'],
    ['13.016', 'Electrical - General Power and Lighting', 'Mechanical, Electrical And Plumbing (Mep)', 'Final circuit wiring, sockets, switches, light fittings'],
    ['13.017', 'Emergency and Exit Lighting', 'Mechanical, Electrical And Plumbing (Mep)', 'Emergency luminaires, maintained exit signs'],
    ['13.018', 'Data, Comms and IT Infrastructure', 'Mechanical, Electrical And Plumbing (Mep)', 'Cat 6 / fibre cabling, server room, comms cabinet'],
    ['13.019', 'Fire Alarm and Detection System', 'Mechanical, Electrical And Plumbing (Mep)', 'Addressable fire panel, detectors, call points, sounders'],
    ['13.020', 'Security and Access Control - Permanent', 'Mechanical, Electrical And Plumbing (Mep)', 'Access control readers, door controllers, intercom'],
    ['13.021', 'CCTV - Permanent Installation', 'Mechanical, Electrical And Plumbing (Mep)', 'Cameras, DVR/NVR, monitoring and cabling'],
    ['13.022', 'Solar PV and Renewable Energy', 'Mechanical, Electrical And Plumbing (Mep)', 'PV panels, inverters, battery storage, generation meter'],
    ['13.023', 'EV Charging Infrastructure', 'Mechanical, Electrical And Plumbing (Mep)', 'EV charge points, sub-board, ducting and earthing'],
    ['13.024', 'Lightning Protection System', 'Mechanical, Electrical And Plumbing (Mep)', 'Air termination, down conductors, earth system'],
    ['13.025', 'BMS and Building Controls', 'Mechanical, Electrical And Plumbing (Mep)', 'Building management system, controllers, sensors, network'],
    ['13.026', 'Sprinkler System', 'Mechanical, Electrical And Plumbing (Mep)', 'Wet, dry or mist fire suppression system'],
    ['13.027', 'Dry Riser / Wet Riser System', 'Mechanical, Electrical And Plumbing (Mep)', 'Rising main, landing valves, inlet breeching'],
    ['13.028', 'Smoke Extract and AOV Systems', 'Mechanical, Electrical And Plumbing (Mep)', 'Smoke control fans, AOV actuators, controls and zoning'],
    ['13.029', 'Passenger Lifts', 'Mechanical, Electrical And Plumbing (Mep)', 'Electric traction or hydraulic passenger lifts; inc. shaft fit-out'],
    ['13.030', 'Goods Lifts and Platform Lifts', 'Mechanical, Electrical And Plumbing (Mep)', 'Goods or DDA platform lifts'],
    ['13.031', 'Escalators and Moving Walkways', 'Mechanical, Electrical And Plumbing (Mep)', 'Commercial escalators and moving walkways'],
    ['14.001', 'Fitted Kitchen Units', 'Fittings, Furniture And Equipment (Ffe)', 'Supply and install kitchen carcasses, doors and worktops'],
    ['14.002', 'Fitted Wardrobes and Storage', 'Fittings, Furniture And Equipment (Ffe)', 'Built-in wardrobe units; sliding or hinged door'],
    ['14.003', 'Bathroom Vanity Units and Cabinets', 'Fittings, Furniture And Equipment (Ffe)', 'Vanity units, over-mirror cabinets, accessories'],
    ['14.004', 'Domestic Appliances', 'Fittings, Furniture And Equipment (Ffe)', 'Oven, hob, extractor, fridge, washing machine etc.'],
    ['14.005', 'Commercial Kitchen Equipment', 'Fittings, Furniture And Equipment (Ffe)', 'Catering-grade cooking, refrigeration and extraction equipment'],
    ['14.006', 'Window Blinds', 'Fittings, Furniture And Equipment (Ffe)', 'Roller, venetian or blackout blinds; motorised if specified'],
    ['14.007', 'Loose Furniture Allowance', 'Fittings, Furniture And Equipment (Ffe)', 'Loose desks, chairs, tables (as applicable to project)'],
    ['14.008', 'Signage - Internal Wayfinding', 'Fittings, Furniture And Equipment (Ffe)', 'Door number plates, directional signs, room name plates'],
    ['14.009', 'Mirrors', 'Fittings, Furniture And Equipment (Ffe)', 'Bathroom mirrors, feature mirrors; inc. fixings'],
    ['14.010', 'Noticeboards, Whiteboards and Screens', 'Fittings, Furniture And Equipment (Ffe)', 'Pinboards, dry-wipe boards, TV/monitor supports'],
    ['14.011', 'Mastic and Sealants - Finishes', 'Fittings, Furniture And Equipment (Ffe)', 'Silicone sealant to all sanitary areas, expansion joints, frames'],
    ['15.001', 'Earthworks - External Grading and Formation', 'External Works', 'Cut and fill, import / export, compact sub-base'],
    ['15.002', 'Concrete Footpaths and Kerbs', 'External Works', 'Insitu concrete paths; precast or insitu kerbs'],
    ['15.003', 'Natural Stone Paving and Setts', 'External Works', 'Granite, limestone or sandstone paving; laid on mortar bed'],
    ['15.004', 'Block Paving', 'External Works', 'Concrete or clay block paving; pattern and edging'],
    ['15.005', 'Tarmacadam / Asphalt Road Surface', 'External Works', 'Binder course and wearing course to roads and car parks'],
    ['15.006', 'Car Parking and Hardstanding', 'External Works', 'Surfacing, bay marking, drainage falls for car parks'],
    ['15.007', 'Road Markings and Line Marking', 'External Works', 'Thermoplastic or painted line markings, arrows, KEEP CLEAR'],
    ['15.008', 'Road Signage', 'External Works', 'Traffic regulation signs, speed signs, warning signs'],
    ['15.009', 'Wayfinding and Amenity Signage', 'External Works', 'Pedestrian direction signs, maps, estate identification'],
    ['15.010', 'Boundary Walls', 'External Works', 'Masonry or concrete boundary walls; inc. copings and piers'],
    ['15.011', 'Retaining Walls - External', 'External Works', 'Gravity, cantilever or reinforced retaining structures externally'],
    ['15.012', 'Fencing and Railings', 'External Works', 'Metal, timber or composite fence panels; posts and fixings'],
    ['15.013', 'Gates and Automated Barriers', 'External Works', 'Vehicular swing or sliding gates; rising arm barriers; automation'],
    ['15.014', 'Seeding and Turfing', 'External Works', 'Grass seed mixes, hydro-seeding or roll-out turf'],
    ['15.015', 'Trees - Supply and Plant', 'External Works', 'Specimen and semi-mature trees; staking and guards'],
    ['15.016', 'Shrubs, Plants and Groundcover', 'External Works', 'Supply, plant and bed preparation'],
    ['15.017', 'Irrigation System', 'External Works', 'Drip or sprinkler irrigation to planted areas'],
    ['15.018', 'Benches and Seating', 'External Works', 'External timber or metal benches; inc. fixings and pads'],
    ['15.019', 'Cycle Stands', 'External Works', 'Sheffield stands or proprietary cycle storage'],
    ['15.020', 'Litter Bins and Dog Waste Bins', 'External Works', 'External waste receptacles; inc. fixings'],
    ['15.021', 'Play Equipment', 'External Works', 'Swings, climbing structures; safety surface'],
    ['15.022', 'External Lighting', 'External Works', 'Bollards, column lights, wall lights, feature lighting to landscape'],
    ['15.023', 'External Surface Water Drainage', 'External Works', 'Gullies, channels, pipes, manholes - surface water network'],
    ['15.024', 'External Foul Water Drainage', 'External Works', 'Foul sewer network; manholes, pumping station if required'],
    ['15.025', 'Attenuation Tank', 'External Works', 'Below-ground storage crate, geocellular or tank system'],
    ['15.026', 'Hydro Brakes and Flow Control Devices', 'External Works', 'Vortex flow controls and inline throttle devices'],
    ['15.027', 'Petrol / Oil Interceptors', 'External Works', 'Bypass or full retention interceptors to car parks'],
    ['15.028', 'Soakaways and Infiltration Features', 'External Works', 'Soakaway crates, permeable paving, rain gardens'],
    ['15.029', 'Utility Connections - Electricity', 'External Works', 'ESB connection; cable, duct, meter chamber, service charge'],
    ['15.030', 'Utility Connections - Water / Drainage', 'External Works', 'Irish Water connection; pipework, chamber, meter'],
    ['15.031', 'Utility Connections - Gas', 'External Works', 'Gas Networks Ireland connection and meter'],
    ['15.032', 'Utility Connections - Telecoms and Data', 'External Works', 'Broadband and telecoms ducting and chambers'],
    ['15.033', 'Works Outside Site Boundary', 'External Works', 'Off-site roads, footpaths, drainage or services'],
    ['16.001', 'Project Manager / Contracts Manager', 'Preliminaries', ''],
    ['16.002', 'Site Manager / General Foreman', 'Preliminaries', ''],
    ['16.003', 'Assistant Site Manager', 'Preliminaries', ''],
    ['16.004', 'Contractor\'s Quantity Surveyor', 'Preliminaries', ''],
    ['16.005', 'Site Engineer and Setting Out', 'Preliminaries', 'Theodolite, total station, lease or owned equipment'],
    ['16.006', 'Safety Officer / PSCS Representative', 'Preliminaries', 'Statutory PSCS role; regular site inspections'],
    ['16.007', 'Document Controller', 'Preliminaries', ''],
    ['16.008', 'Site Labour - General Operative', 'Preliminaries', 'Day-rate or weekly gang on prelims duties'],
    ['16.009', 'Management Staff Expenses', 'Preliminaries', 'Mileage, subsistence, accommodation'],
    ['16.010', 'Site Office Units', 'Preliminaries', 'Portable cabins; delivery, set-up, hire and removal'],
    ['16.011', 'Welfare Facilities', 'Preliminaries', 'Drying room, toilets, canteen; hire period'],
    ['16.012', 'Site Office Furniture', 'Preliminaries', 'Desks, chairs, plan chests, shelving'],
    ['16.013', 'IT Equipment - Computers and Printers', 'Preliminaries', 'Laptops, large-format printer, scanner; lease or purchase'],
    ['16.014', 'Phone and Internet', 'Preliminaries', 'Mobile phones, site broadband, router hire'],
    ['16.015', 'Stationery and Consumables', 'Preliminaries', 'Paper, toner, PPE replenishment, site sundries'],
    ['16.016', 'Temporary Electrical Connection', 'Preliminaries', 'Service charge, cable and connection to DNO / ESB'],
    ['16.017', 'Temporary Water Connection', 'Preliminaries', 'Irish Water charge; temporary meter and pipework'],
    ['16.018', 'Temporary Drainage Connection', 'Preliminaries', 'Temporary surface water and foul water connection'],
    ['16.019', 'Temporary Mechanical Services - Heating / Drying', 'Preliminaries', 'Propane or electric heaters; de-humidifiers'],
    ['16.020', 'Electricity Consumption Charges', 'Preliminaries', 'Unit charges for duration of contract'],
    ['16.021', 'Water Consumption Charges', 'Preliminaries', 'Metered water usage charges'],
    ['16.022', 'Gas Consumption Charges', 'Preliminaries', 'Gas metered usage'],
    ['16.023', 'Phone and Internet Usage Charges', 'Preliminaries', 'Call charges and broadband data charges'],
    ['16.024', 'On-Site Security Personnel', 'Preliminaries', 'Manned guarding; 24-hour or daytime only'],
    ['16.025', 'Off-Site / Remote CCTV Monitoring', 'Preliminaries', 'Monitored CCTV during out-of-hours periods'],
    ['16.026', 'CCTV - Temporary Construction', 'Preliminaries', 'Temporary site CCTV cameras and recording'],
    ['16.027', 'Hoarding - Timber or Metal Panel', 'Preliminaries', 'Solid hoarding; timber frame with plywood or steel cladding'],
    ['16.028', 'Hoarding - Heras Fencing', 'Preliminaries', 'Temporary mesh fencing; panels, feet, clips'],
    ['16.029', 'Site Gates', 'Preliminaries', 'Vehicular access and pedestrian access gates'],
    ['16.030', 'Turnstiles', 'Preliminaries', 'Pedestrian access control turnstiles'],
    ['16.031', 'Hoarding Graphics and Signage', 'Preliminaries', 'Printed graphics, project branding and legal signage'],
    ['16.032', 'Pest Control', 'Preliminaries', 'Rodent baiting, monitoring and clearance programme'],
    ['16.033', 'PPE', 'Preliminaries', 'Hard hats, high-vis, boots, gloves, eye protection'],
    ['16.034', 'Health and Safety Signage', 'Preliminaries', 'Mandatory, warning and prohibition signs; notice boards'],
    ['16.035', 'Third-Party Safety Inspector', 'Preliminaries', 'Independent health and safety audit visits'],
    ['16.036', 'Road Barriers and Traffic Management', 'Preliminaries', 'Concrete or plastic barriers; traffic management plan'],
    ['16.037', 'Edge Protection', 'Preliminaries', 'Handrail and toe-board systems to open edges'],
    ['16.038', 'Fuel and Oil Containment', 'Preliminaries', 'Bunded storage tanks and drip trays'],
    ['16.039', 'Topographical Survey', 'Preliminaries', 'Measured survey of existing site; levels and features'],
    ['16.040', 'Setting Out Engineer (External)', 'Preliminaries', 'Specialist setting out where not covered by staff'],
    ['16.041', 'Temporary Protection of Completed Works', 'Preliminaries', 'Boarding, sheeting, protection boards to finished surfaces'],
    ['16.042', 'Tree Protection', 'Preliminaries', 'Tree protection fencing; root barriers as specified'],
    ['16.043', 'Samples and Mock-Ups', 'Preliminaries', 'Production and approval of material samples; mock-up panels'],
    ['16.044', 'Wheel Wash', 'Preliminaries', 'Automated or manual wheel wash unit; maintenance'],
    ['16.045', 'Vibration Monitoring', 'Preliminaries', 'Geophone instrumentation; weekly reporting'],
    ['16.046', 'Noise Monitoring', 'Preliminaries', 'Sound level monitoring; reporting to local authority'],
    ['16.047', 'Air Quality Monitoring', 'Preliminaries', 'Dust and particulate monitoring; suppression measures'],
    ['16.048', 'Weekly Site Cleaning', 'Preliminaries', 'Regular sweeping, clearing and tidying of site areas'],
    ['16.049', 'Skip Hire and Waste Disposal', 'Preliminaries', 'General and segregated waste; tipping charges'],
    ['16.050', 'Road Sweeper', 'Preliminaries', 'Mechanical road sweeper to maintain public roads clean'],
    ['16.051', 'Maintaining Temporary Roads and Haul Routes', 'Preliminaries', 'Stone topping up, grading and pot-hole repair'],
    ['16.052', 'Builders Clean', 'Preliminaries', 'Pre-handover clean of all internal areas'],
    ['16.053', 'Spark Clean', 'Preliminaries', 'Final deep clean on practical completion'],
    ['16.054', 'Progress Photography', 'Preliminaries', 'Regular photographic record of works progress'],
    ['16.055', 'Drone Survey and Aerial Photography', 'Preliminaries', 'Drone flights for progress monitoring and survey'],
    ['16.056', 'BIM / CAD Management', 'Preliminaries', 'BIM co-ordination, model management, clash detection'],
    ['16.057', 'M&E Sub-Contractor Site Attendance Allowance', 'Preliminaries', 'Additional site presence by M&E consultant'],
    ['16.058', 'O&M Manuals and As-Built Drawings', 'Preliminaries', 'Compilation and issue of operation and maintenance documentation'],
    ['16.059', 'Snagging and Defects Management', 'Preliminaries', 'Snagging lists, defects inspections and close-out'],
    ['16.060', 'Tower Crane - Hire and Operation', 'Preliminaries', 'Crane hire, operator, insurance, erection and dismantling'],
    ['16.061', 'Tower Crane - Foundation Base', 'Preliminaries', 'Design, construct and remove crane base'],
    ['16.062', 'Mobile Crane - Hire with Operator and Banksman', 'Preliminaries', 'All-in mobile crane hire for lifts'],
    ['16.063', 'General Plant - Prelims', 'Preliminaries', 'Diggers, dumpers, telehandler on preliminary duties'],
    ['16.064', 'Transport to / from Site', 'Preliminaries', 'Vehicles, vans; travel time for staff movements'],
    ['16.065', 'Scaffolding - General Access', 'Preliminaries', 'Tube and fitting or system scaffold to external and internal'],
    ['16.066', 'Scaffolding - Stairwell', 'Preliminaries', 'Birdcage scaffold inside stairwells during construction'],
    ['16.067', 'Scaffolding - Lift Shaft', 'Preliminaries', 'Internal scaffold to lift shafts during construction'],
    ['16.068', 'Material Hoists', 'Preliminaries', 'Goods hoist; erect, operate, dismantle and remove'],
    ['16.069', 'Temporary Works Design', 'Preliminaries', 'Structural design of falsework, shoring and propping'],
    ['16.070', 'Shoring and Propping', 'Preliminaries', 'Temporary props, needles and raking shores'],
    ['16.071', 'Excavation Support - Temporary', 'Preliminaries', 'Sheet piles, soldier piles, temporary secant piles'],
    ['16.072', 'Road Closure Orders', 'Preliminaries', 'Council application fees and traffic management costs'],
    ['16.073', 'Scaffolding Licences and Pavement Charges', 'Preliminaries', 'Local authority licence fees for scaffold over public footpath'],
    ['16.074', 'Hoarding Licence Charges', 'Preliminaries', 'Licence fee for hoarding on public land'],
    ['16.075', 'Contract Works Insurance', 'Preliminaries', 'Contractor\'s all-risk insurance for the works'],
    ['16.076', 'Public Liability Insurance', 'Preliminaries', 'Third-party liability cover for the project'],
    ['16.077', 'Head Office Overheads', 'Preliminaries', 'Central office apportionment'],
    ['16.078', 'Contractor\'s Profit', 'Preliminaries', 'Commercial margin on the works'],
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
  const tradeMockData: Record<string, { budget: number; vc: number; vna: number }> = {
    'Preliminaries':                          { budget: 950000,  vc: 480000, vna: 0 },
    'Site Preparation':                       { budget: 185000,  vc: 185000, vna: 0 },
    'Demolition':                             { budget: 220000,  vc: 220000, vna: 0 },
    'Foundations':                            { budget: 680000,  vc: 620000, vna: 15000 },
    'Frame And Superstructure':               { budget: 2450000, vc: 1850000,vna: 0 },
    'External Walls':                         { budget: 1200000, vc: 480000, vna: 0 },
    'Windows, External Doors And Glazed Systems':{ budget: 880000, vc: 0,    vna: 0 },
    'Roofing':                                { budget: 420000,  vc: 0,     vna: 0 },
    'Internal Walls And Partitions':          { budget: 380000,  vc: 0,     vna: 0 },
    'Internal Doors And Ironmongery':         { budget: 145000,  vc: 0,     vna: 0 },
    'Fire Protection (Passive)':              { budget: 95000,   vc: 0,     vna: 0 },
    'Finishes':                               { budget: 920000,  vc: 0,     vna: 0 },
    'Mechanical, Electrical And Plumbing (Mep)':{ budget: 2200000,vc: 0,   vna: 42000 },
    'Fittings, Furniture And Equipment (Ffe)':{ budget: 380000,  vc: 0,    vna: 0 },
    'Builders Work And Associated Items':     { budget: 125000,  vc: 0,    vna: 0 },
    'External Works':                         { budget: 270000,  vc: 0,    vna: 0 },
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

  // Cost to Date lines
  const ctdLines: [string, number, number][] = [
    // Prelims
    ['16.001', 185000, 0], ['16.002', 142000, 0], ['16.004', 68000, 0],
    ['16.005', 52000, 0],  ['16.006', 38000, 0],  ['16.010', 18500, 2100],
    ['16.011', 9800,  1100],['16.012', 4200, 0],  ['16.015', 3800,  420],
    ['16.039', 8500,  0],  ['16.048', 6200,  700],['16.049', 4800,  530],
    // Site Prep
    ['01.001', 32000, 0], ['01.002', 18500, 0], ['01.003', 68000, 0],
    ['01.004', 28000, 0], ['01.005', 24000, 0],
    // Demolition
    ['02.002', 42000, 0], ['02.003', 95000, 0], ['02.004', 38000, 0],
    ['02.005', 28000, 0], ['02.006', 17000, 0],
    // Foundations
    ['03.001', 185000, 0], ['03.002', 62000, 0], ['03.003', 48000, 0],
    ['03.004', 82000, 0],  ['03.005', 38000, 0], ['03.010', 28000, 0],
    ['03.011', 145000, 0], ['03.012', 32000, 0],
    // Frame
    ['04.001', 420000, 0], ['04.002', 185000, 0], ['04.003', 92000, 0],
    ['04.004', 68000, 0],  ['04.005', 145000, 0], ['04.006', 82000, 0],
    ['04.007', 340000, 0], ['04.010', 185000, 0], ['04.011', 145000, 12000],
    ['04.012', 68000, 0],  ['04.013', 42000, 0],
    // External Walls
    ['05.001', 125000, 0], ['05.002', 68000, 0], ['05.003', 82000, 0],
    ['05.004', 48000, 0],  ['05.005', 92000, 0], ['05.006', 65000, 8500],
  ]
  for (const [code, posted, acc] of ctdLines) {
    if (!cm[code]) continue
    await db.execute({
      sql: 'INSERT INTO cost_lines VALUES (?,?,?,?,?,?,?,NULL)',
      args: [cuid(), projectId, periodId, cm[code], posted, acc, 0],
    })
  }

  // Committed lines
  const committedLines: [string, string, string, string, number|null, string|null, number][] = [
    ['16.001','Burke PM Ltd','Project Manager – 72wk','Placed',72,'Wks',252000],
    ['16.002','Site Solutions','Site Manager – 72wk','Placed',72,'Wks',216000],
    ['16.004','QS Partners Ltd','QS Services – 72wk','Placed',72,'Wks',180000],
    ['04.001','Mulligan Concrete','RC Frame Package','Placed',1,'Item',820000],
    ['04.007','Steel Structures Ltd','Structural Steelwork','Placed',1,'Item',285000],
    ['05.001','Facade Contractors Ltd','Rainscreen Cladding','Placed',1,'Item',680000],
    ['06.001','Glazing Systems Ltd','Curtain Wall & Windows','Placed',1,'Item',540000],
    ['07.001','Roofing Solutions Ltd','Flat Roof System','Pending',1,'Item',285000],
    ['12.001','MEP Contractors Ltd','Full M&E Package','Placed',1,'Item',1850000],
    ['03.001','Piling & Ground Ltd','Piling Works','Placed',1,'Item',320000],
    ['01.003','Earthworks Ltd','Bulk Excavation','Placed',1,'Item',145000],
    ['02.003','Demo Contractors','Demolition Works','Placed',1,'Item',158000],
  ]
  for (const [code, supplier, desc, status, qty, unit, total] of committedLines) {
    if (!cm[code]) continue
    await db.execute({
      sql: 'INSERT INTO committed_lines VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      args: [cuid(), projectId, cm[code], supplier, desc, status, qty, unit, null, total, null],
    })
  }

  // Forecast lines
  let fSort = 1
  const forecastLines: [string, string, string, number][] = [
    ['16.001','Burke PM Ltd','Final',252000],
    ['16.002','Site Solutions','Final',216000],
    ['16.004','QS Partners Ltd','Final',180000],
    ['16.006','Safety First Ltd','Estimate',68000],
    ['16.010','Portakabin Ltd','Final',38500],
    ['04.001','Mulligan Concrete','Final',820000],
    ['04.007','Steel Structures Ltd','Final',285000],
    ['04.011','Murphy Civil','Estimate',185000],
    ['05.001','Facade Contractors Ltd','Final',680000],
    ['05.006','Masonry Ltd','Estimate',145000],
    ['06.001','Glazing Systems Ltd','Final',540000],
    ['07.001','Roofing Solutions Ltd','Quote',295000],
    ['08.001','Partition Co','Estimate',285000],
    ['09.001','Door Supplies Ltd','Estimate',125000],
    ['11.001','Fit Out Contractors','Estimate',580000],
    ['12.001','MEP Contractors Ltd','Final',1850000],
    ['12.005','Sprinkler Systems Ltd','Estimate',185000],
    ['13.001','FFE Suppliers Ltd','Estimate',280000],
    ['15.001','Landscaping Ltd','Estimate',185000],
    ['03.001','Piling & Ground Ltd','Final',320000],
    ['01.003','Earthworks Ltd','Final',145000],
    ['02.003','Demo Contractors','Final',158000],
    ['10.001','Fire Protection Ltd','Estimate',82000],
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
    ['Site Management','16.001','Project Manager / Contracts Manager',     180000,0,0,1,'Weeks',2500,100,1,72,null],
    ['Site Management','16.002','Site Manager / General Foreman',         144000,0,0,1,'Weeks',2000,100,1,72,null],
    ['Site Management','16.004',"Contractor's Quantity Surveyor",         108000,0,0,1,'Weeks',1500,100,1,72,null],
    ['Site Management','16.005','Site Engineer and Setting Out',           72000,0,0,1,'Weeks',1000,100,1,72,null],
    ['Site Management','16.006','Safety Officer / PSCS Representative',    54000,0,0,1,'Weeks',750, 100,1,72,null],
    ['Welfare & Offices','16.010','Site Office Units',                     21600,0,0,1,'Weeks',300, 100,1,72,null],
    ['Welfare & Offices','16.011','Welfare Facilities',                    14400,0,0,1,'Weeks',200, 100,1,72,null],
    ['Welfare & Offices','16.012','Site Office Furniture',                  3600,0,0,1,'Weeks', 50, 100,1,72,null],
    ['Running Costs','16.015','Stationery and Consumables',                 3600,0,0,1,'Weeks', 50, 100,1,72,null],
    ['Bond & Insurance','16.074','Contractor All Risks Insurance',         48000,0,0,1,'nr',48000,100,1,1,null],
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
    ['Site Management',  '16.001', 'Project Manager / Contracts Manager',   'Weeks'],
    ['Site Management',  '16.002', 'Site Manager / General Foreman',        'Weeks'],
    ['Site Management',  '16.004', "Contractor's Quantity Surveyor",        'Weeks'],
    ['Site Management',  '16.005', 'Site Engineer and Setting Out',         'Weeks'],
    ['Site Management',  '16.006', 'Safety Officer / PSCS Representative', 'Weeks'],
    ['Welfare & Offices','16.010', 'Site Office Units',                     'Weeks'],
    ['Welfare & Offices','16.011', 'Welfare Facilities',                    'Weeks'],
    ['Welfare & Offices','16.012', 'Site Office Furniture',                 'Weeks'],
    ['Running Costs',    '16.015', 'Stationery and Consumables',            'Weeks'],
    ['Bond & Insurance', '16.074', 'Contractor All Risks Insurance',        'nr'],
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

  const globalElements = [
    'Groundworks','Concrete Works','Steelwork','Cladding',
    'MEP','Fit Out','External Works','Landscaping','Preliminaries','Contingency',
  ]
  const globalTradesList = [
    'Civil','Structural','Mechanical','Electrical','Plumbing',
    'Facade','Groundworks','Fit Out','External','Project Management',
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
