import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean slate
  await prisma.periodSnapshot.deleteMany()
  await prisma.sCurveRow.deleteMany()
  await prisma.valuePeriod.deleteMany()
  await prisma.costLine.deleteMany()
  await prisma.committedLine.deleteMany()
  await prisma.forecastLine.deleteMany()
  await prisma.costCode.deleteMany()
  await prisma.trade.deleteMany()
  await prisma.reportPeriod.deleteMany()
  await prisma.project.deleteMany()

  const project = await prisma.project.create({
    data: {
      name: 'Barnaleen Solar Substation',
      code: '101436',
      client: 'EirGrid / SSE Renewables',
      contractType: 'Design & Build (NEC3 ECC)',
      preparedBy: 'Martin Burke',
      contractSum: 10_766_782,
      approvedVars: 85_000,
      originalBudget: 10_350_000,
      originalMargin: 416_782,
      contractStart: new Date('2026-07-03'),
      contractFinish: new Date('2027-08-18'),
      revisedStart: new Date('2026-07-03'),
      revisedFinish: new Date('2027-09-30'),
    },
  })

  // Report period
  const period = await prisma.reportPeriod.create({
    data: {
      projectId: project.id,
      label: 'March 2026',
      periodDate: new Date('2026-03-31'),
      isCurrent: true,
    },
  })

  // Trades
  const tradeData = [
    { name: 'Preliminaries', codePrefix: 'PRE', sortOrder: 1, valueCertified: 1_280_000, varsNotAgreed: 28_500, adjustments: -45_000 },
    { name: 'Design', codePrefix: 'DES', sortOrder: 2, valueCertified: 285_000, varsNotAgreed: 0, adjustments: 0 },
    { name: 'Civil Works', codePrefix: 'CIV', sortOrder: 3, valueCertified: 620_000, varsNotAgreed: 0, adjustments: -22_000 },
    { name: 'Electrical Works', codePrefix: 'ELE', sortOrder: 4, valueCertified: 1_850_000, varsNotAgreed: 14_200, adjustments: 0 },
    { name: 'Mechanical Works', codePrefix: 'MEC', sortOrder: 5, valueCertified: 185_000, varsNotAgreed: 0, adjustments: 0 },
    { name: 'Commissioning', codePrefix: 'COM', sortOrder: 6, valueCertified: 0, varsNotAgreed: 0, adjustments: 0 },
    { name: 'Other / Contingency', codePrefix: 'OTH', sortOrder: 7, valueCertified: 0, varsNotAgreed: 0, adjustments: 0 },
  ]
  for (const t of tradeData) {
    await prisma.trade.create({ data: { projectId: project.id, ...t } })
  }

  // Cost Codes
  const codes = [
    // PRELIMS
    { code: 'PRE-001', description: 'Bond & Insurance', trade: 'Preliminaries', category: 'Indirect' },
    { code: 'PRE-010', description: 'Project Manager (Incl. T&A)', trade: 'Preliminaries', category: 'Labour' },
    { code: 'PRE-011', description: 'Construction Manager (Incl. T&A)', trade: 'Preliminaries', category: 'Labour' },
    { code: 'PRE-012', description: 'Contract Manager (Incl. T&A)', trade: 'Preliminaries', category: 'Labour' },
    { code: 'PRE-013', description: 'Site Engineer (Incl. T&A)', trade: 'Preliminaries', category: 'Labour' },
    { code: 'PRE-014', description: 'Health & Safety Manager (Incl. T&A)', trade: 'Preliminaries', category: 'Labour' },
    { code: 'PRE-015', description: 'Senior Quantity Surveyor (Incl. T&A)', trade: 'Preliminaries', category: 'Labour' },
    { code: 'PRE-016', description: 'Project Quantity Surveyor (Incl. T&A)', trade: 'Preliminaries', category: 'Labour' },
    { code: 'PRE-020', description: 'Electrical Site Management', trade: 'Preliminaries', category: 'Labour' },
    { code: 'PRE-030', description: 'Site Office & Welfare – Hire', trade: 'Preliminaries', category: 'Plant' },
    { code: 'PRE-031', description: 'Canteen Facilities', trade: 'Preliminaries', category: 'Plant' },
    { code: 'PRE-032', description: 'Toilet Block – Hire', trade: 'Preliminaries', category: 'Plant' },
    { code: 'PRE-034', description: 'Generator – Hire & Fuel', trade: 'Preliminaries', category: 'Plant' },
    { code: 'PRE-035', description: 'Teleporter – Hire incl. Driver', trade: 'Preliminaries', category: 'Plant' },
    { code: 'PRE-040', description: 'Temporary Site Fencing & Compound', trade: 'Preliminaries', category: 'Materials' },
    { code: 'PRE-041', description: 'H&S Signage & PPE Consumables', trade: 'Preliminaries', category: 'Materials' },
    { code: 'PRE-050', description: 'Office Expenses, Stationery & Printing', trade: 'Preliminaries', category: 'Indirect' },
    { code: 'PRE-051', description: 'Water & Utilities', trade: 'Preliminaries', category: 'Indirect' },
    { code: 'PRE-052', description: 'Waste Disposal', trade: 'Preliminaries', category: 'Indirect' },
    { code: 'PRE-053', description: 'Site Security', trade: 'Preliminaries', category: 'Indirect' },
    { code: 'PRE-060', description: 'Surveys & Setting Out', trade: 'Preliminaries', category: 'Subcontractor' },
    { code: 'PRE-070', description: 'Planning Compliance', trade: 'Preliminaries', category: 'Indirect' },
    // DESIGN
    { code: 'DES-001', description: 'Structural Design', trade: 'Design', category: 'Subcontractor' },
    { code: 'DES-002', description: 'Electrical Design', trade: 'Design', category: 'Subcontractor' },
    { code: 'DES-003', description: 'Civil & Geotechnical Design', trade: 'Design', category: 'Subcontractor' },
    { code: 'DES-005', description: 'Design Management', trade: 'Design', category: 'Labour' },
    // CIVIL
    { code: 'CIV-001', description: 'Excavation & Earthworks', trade: 'Civil Works', category: 'Subcontractor' },
    { code: 'CIV-002', description: 'Geotextile & Formation', trade: 'Civil Works', category: 'Materials' },
    { code: 'CIV-003', description: 'Filling – Clause 804 Stone', trade: 'Civil Works', category: 'Materials' },
    { code: 'CIV-004', description: 'Filling – Clause 6F2 Stone', trade: 'Civil Works', category: 'Materials' },
    { code: 'CIV-005', description: 'Concrete Works – Substructure', trade: 'Civil Works', category: 'Subcontractor' },
    { code: 'CIV-007', description: 'Drainage Works', trade: 'Civil Works', category: 'Subcontractor' },
    { code: 'CIV-008', description: 'Access Road & Paving', trade: 'Civil Works', category: 'Subcontractor' },
    { code: 'CIV-009', description: 'Fencing & Gates', trade: 'Civil Works', category: 'Subcontractor' },
    { code: 'CIV-020', description: 'Civil Labour – Direct', trade: 'Civil Works', category: 'Labour' },
    { code: 'CIV-030', description: 'Plant – Civil', trade: 'Civil Works', category: 'Plant' },
    // ELECTRICAL
    { code: 'ELE-001', description: 'Grid Transformer (120 MVA)', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-002', description: 'Switchgear (2500A)', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-003', description: 'Circuit Breaker', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-004', description: 'Disconnectors & Earthing Switches', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-005', description: 'Surge Arrestors', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-006', description: 'CT/VT Equipment', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-007', description: 'DC Chargers & Battery Systems', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-008', description: 'Tubular Busbar', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-009', description: 'House Transformer', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-010', description: 'NER / NEC Equipment', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-011', description: 'Post Insulators', trade: 'Electrical Works', category: 'Materials' },
    { code: 'ELE-020', description: 'HV Cable Supply & Installation', trade: 'Electrical Works', category: 'Subcontractor' },
    { code: 'ELE-021', description: 'LV Cable Supply & Installation', trade: 'Electrical Works', category: 'Subcontractor' },
    { code: 'ELE-022', description: 'Earthing System', trade: 'Electrical Works', category: 'Subcontractor' },
    { code: 'ELE-023', description: 'Protection & Control', trade: 'Electrical Works', category: 'Subcontractor' },
    { code: 'ELE-024', description: 'SCADA / Communications', trade: 'Electrical Works', category: 'Subcontractor' },
    { code: 'ELE-025', description: 'Electrical Installation – Labour', trade: 'Electrical Works', category: 'Labour' },
    // MECHANICAL
    { code: 'MEC-001', description: 'Modular Buildings – Supply & Install', trade: 'Mechanical Works', category: 'Subcontractor' },
    { code: 'MEC-002', description: 'HVAC Works', trade: 'Mechanical Works', category: 'Subcontractor' },
    // COMMISSIONING
    { code: 'COM-001', description: 'Electrical Testing & Commissioning', trade: 'Commissioning', category: 'Subcontractor' },
    { code: 'COM-002', description: 'Civil / Structural Commissioning', trade: 'Commissioning', category: 'Subcontractor' },
    { code: 'COM-003', description: 'SCADA Commissioning', trade: 'Commissioning', category: 'Subcontractor' },
    { code: 'COM-004', description: 'Commissioning – Labour', trade: 'Commissioning', category: 'Labour' },
    // OTHER
    { code: 'OTH-001', description: 'Contingency – Civil', trade: 'Other / Contingency', category: 'Indirect' },
    { code: 'OTH-002', description: 'Contingency – Electrical', trade: 'Other / Contingency', category: 'Indirect' },
    { code: 'OTH-003', description: 'General Contingency', trade: 'Other / Contingency', category: 'Indirect' },
    { code: 'OTH-010', description: 'Unapproved Variations', trade: 'Other / Contingency', category: 'Indirect' },
  ]
  const codeMap: Record<string, string> = {}
  for (const c of codes) {
    const cc = await prisma.costCode.create({ data: { projectId: project.id, ...c } })
    codeMap[c.code] = cc.id
  }

  // Cost Lines
  const ctdData = [
    ['PRE-001', 82_430, 0, 0], ['PRE-010', 112_800, 8_500, 0], ['PRE-011', 75_200, 8_500, 0],
    ['PRE-012', 28_400, 4_250, 0], ['PRE-013', 55_600, 7_200, 0], ['PRE-014', 83_400, 8_500, 0],
    ['PRE-015', 21_300, 3_600, 0], ['PRE-016', 28_400, 3_600, 0], ['PRE-030', 18_900, 2_100, 0],
    ['PRE-031', 9_450, 1_050, 0], ['PRE-032', 12_600, 1_400, 0], ['PRE-034', 38_220, 4_250, 0],
    ['PRE-035', 19_890, 2_210, 0], ['PRE-040', 8_750, 0, 0], ['PRE-050', 7_480, 830, 0],
    ['PRE-051', 5_640, 625, 0], ['PRE-052', 4_200, 465, 0], ['PRE-060', 18_500, 0, 0],
    ['DES-001', 95_000, 15_000, 0], ['DES-002', 148_500, 22_000, 0], ['DES-003', 42_000, 8_000, 0],
    ['DES-005', 18_750, 2_500, 0],
    ['CIV-001', 185_400, 28_000, 0], ['CIV-002', 24_300, 0, 0], ['CIV-003', 38_600, 0, 0],
    ['CIV-004', 29_800, 0, 0], ['CIV-005', 248_500, 45_000, -8_200], ['CIV-007', 62_300, 12_000, 0],
    ['CIV-008', 88_400, 15_000, 0], ['CIV-009', 41_200, 0, 0], ['CIV-020', 54_800, 6_500, 0],
    ['ELE-001', 1_640_000, 0, 0], ['ELE-002', 344_541, 0, 0], ['ELE-003', 73_150, 0, 0],
    ['ELE-004', 22_888, 0, 0], ['ELE-005', 25_875, 0, 0], ['ELE-006', 31_500, 0, 0],
    ['ELE-007', 142_623, 0, 0], ['ELE-008', 29_793, 0, 0], ['ELE-009', 20_400, 0, 0],
    ['ELE-010', 16_788, 0, 0], ['ELE-011', 11_445, 0, 0], ['ELE-025', 84_500, 12_000, 0],
    ['MEC-001', 142_000, 28_000, 0],
    ['COM-001', 0, 35_000, 0], ['COM-004', 0, 4_500, 0],
    ['OTH-001', 8_500, 5_000, 0], ['OTH-002', 0, 12_000, 0],
  ] as [string, number, number, number][]

  for (const [code, posted, accruals, subRecon] of ctdData) {
    if (!codeMap[code]) continue
    await prisma.costLine.create({
      data: {
        projectId: project.id,
        periodId: period.id,
        costCodeId: codeMap[code],
        postedCost: posted,
        accruals,
        subRecon,
      },
    })
  }

  // Committed Lines
  const committedData = [
    ['PRE-001', 'Aon Ireland', 'All Risks & PI Insurance', 'Placed', null, null, 82_430],
    ['PRE-010', 'TLI Group', 'Project Manager – 60wk @ €2,500pw', 'Placed', 60, 'Wks', null],
    ['PRE-011', 'TLI Group', 'Construction Manager – 60wk', 'Placed', 60, 'Wks', null],
    ['PRE-030', 'Algeco Ireland', 'Site Office – 60wk hire', 'Placed', 60, 'Wks', null],
    ['PRE-060', 'GEO Survey Ireland', 'Topographic & Setting Out Survey', 'Placed', null, null, 18_500],
    ['DES-001', 'Arup Ireland', 'Structural Design – Substation', 'Placed', null, null, 185_000],
    ['DES-002', 'ESB International', 'Electrical Design & Drawings', 'Placed', null, null, 290_000],
    ['DES-003', 'Hydrock', 'Civil & Geotechnical Design', 'Placed', null, null, 82_000],
    ['CIV-001', 'Murphy Civil Eng.', 'Earthworks & Excavation', 'Placed', null, null, 385_000],
    ['CIV-005', 'Walls Construction', 'Substation Building – Concrete', 'Placed', null, null, 720_000],
    ['CIV-007', 'Murphy Civil Eng.', 'Drainage Works', 'Placed', null, null, 148_000],
    ['CIV-008', 'Murphy Civil Eng.', 'Access Road & Paving', 'Placed', null, null, 195_000],
    ['CIV-009', 'Thornton Fencing', 'Security Fencing & Gates – 500m', 'Placed', 500, 'm', null],
    ['ELE-001', 'Green Transfo / MR', '120 MVA Grid Transformer', 'Placed', 1, 'nr', null],
    ['ELE-002', 'Siemens Energy', '2500A Switchgear', 'Placed', 1, 'nr', null],
    ['ELE-003', 'GE Grid Solutions', 'Circuit Breaker POW', 'Placed', 1, 'nr', null],
    ['ELE-007', 'Secure Power', '24V & 48V DC Chargers', 'Placed', 1, 'nr', null],
    ['ELE-020', 'Sisk Electrical', 'HV Cable Supply & Installation', 'Placed', null, null, 385_000],
    ['ELE-021', 'Sisk Electrical', 'LV Cable Supply & Installation', 'Placed', null, null, 95_000],
    ['ELE-022', 'Sisk Electrical', 'Earthing System', 'Placed', null, null, 68_000],
    ['ELE-023', 'Sisk Electrical', 'Protection & Control', 'Placed', null, null, 125_000],
    ['ELE-024', 'Sisk Electrical', 'SCADA / Communications', 'Pending', null, null, 85_000],
    ['MEC-001', 'Portakabin Ireland', 'Modular Substation Building', 'Placed', null, null, 350_000],
    ['COM-001', 'Sisk Electrical', 'Electrical Testing & Commissioning', 'Provisional', null, null, 148_000],
    ['OTH-001', 'TLI Group', 'Civil Contingency 5%', 'Forecast', null, null, 65_000],
    ['OTH-002', 'TLI Group', 'Electrical Contingency 3%', 'Forecast', null, null, 95_000],
    ['OTH-010', 'TLI Group', 'Unapproved Variation – VOI 001', 'Pending', null, null, 28_500],
    ['OTH-010', 'TLI Group', 'Unapproved Variation – VOI 002', 'Pending', null, null, 14_200],
  ] as [string, string, string, string, number | null, string | null, number | null][]

  const unitRates: Record<string, number> = {
    'PRE-010': 2_500, 'PRE-011': 2_600, 'PRE-030': 380,
    'CIV-009': 185, 'ELE-001': 1_640_000, 'ELE-002': 344_541,
    'ELE-003': 73_150, 'ELE-007': 142_623,
  }

  for (const [code, supplier, desc, status, qty, unit, lump] of committedData) {
    if (!codeMap[code]) continue
    const rate = unitRates[code] ?? (lump ? null : 1)
    const total = lump ?? (qty && unitRates[code] ? qty * unitRates[code] : lump ?? 0)
    await prisma.committedLine.create({
      data: {
        projectId: project.id,
        costCodeId: codeMap[code],
        supplier, description: desc, status,
        quantity: qty ?? null,
        unit: unit ?? null,
        unitRate: rate ?? null,
        total: total ?? 0,
      },
    })
  }

  // Forecast Lines
  const forecastData = [
    ['PRE-001', 'Aon Ireland', 'Final', null, null, null, 82_430],
    ['PRE-010', 'TLI Group', 'Final', null, 60, 2_500, null],
    ['PRE-011', 'TLI Group', 'Final', null, 60, 2_600, null],
    ['PRE-012', 'TLI Group', 'Final', 0.2, 60, 1_780, null],
    ['PRE-013', 'TLI Group', 'Final', 0.6, 60, 2_200, null],
    ['PRE-014', 'TLI Group', 'Final', null, 60, 2_650, null],
    ['PRE-015', 'TLI Group', 'Final', 0.2, 60, 1_800, null],
    ['PRE-016', 'TLI Group', 'Final', 0.3, 60, 1_820, null],
    ['PRE-030', 'Algeco Ireland', 'Final', null, 60, 380, null],
    ['PRE-060', 'GEO Survey Ireland', 'Final', null, null, 18_500, null],
    ['DES-001', 'Arup Ireland', 'Final', null, null, 185_000, null],
    ['DES-002', 'ESB International', 'Final', null, null, 290_000, null],
    ['DES-003', 'Hydrock', 'Final', null, null, 82_000, null],
    ['CIV-001', 'Murphy Civil Eng.', 'Quote', null, null, 385_000, null],
    ['CIV-005', 'Walls Construction', 'Quote', null, null, 720_000, null],
    ['CIV-007', 'Murphy Civil Eng.', 'Quote', null, null, 148_000, null],
    ['CIV-008', 'Murphy Civil Eng.', 'Quote', null, null, 195_000, null],
    ['CIV-009', 'Thornton Fencing', 'Final', null, 500, 185, null],
    ['CIV-020', 'TLI Group', 'Estimate', null, null, 95_000, null],
    ['ELE-001', 'Green Transfo / MR', 'Final', null, 1, 1_640_000, null],
    ['ELE-002', 'Siemens Energy', 'Final', null, 1, 344_541, null],
    ['ELE-003', 'GE Grid Solutions', 'Final', null, 1, 73_150, null],
    ['ELE-007', 'Secure Power', 'Final', null, 1, 142_623, null],
    ['ELE-020', 'Sisk Electrical', 'Quote', null, null, 395_000, null],
    ['ELE-021', 'Sisk Electrical', 'Quote', null, null, 95_000, null],
    ['ELE-022', 'Sisk Electrical', 'Quote', null, null, 68_000, null],
    ['ELE-023', 'Sisk Electrical', 'Quote', null, null, 125_000, null],
    ['ELE-024', 'Sisk Electrical', 'Estimate', null, null, 85_000, null],
    ['ELE-025', 'TLI Group', 'Estimate', null, null, 155_000, null],
    ['MEC-001', 'Portakabin Ireland', 'Quote', null, null, 350_000, null],
    ['COM-001', 'Sisk Electrical', 'Estimate', null, null, 148_000, null],
    ['COM-002', 'Walls Construction', 'Estimate', null, null, 18_000, null],
    ['COM-003', 'Sisk Electrical', 'Estimate', null, null, 32_000, null],
    ['COM-004', 'TLI Group', 'Estimate', null, null, 28_500, null],
    ['OTH-001', 'TLI Group', 'Contingency', null, null, 65_000, null],
    ['OTH-002', 'TLI Group', 'Contingency', null, null, 95_000, null],
    ['OTH-003', 'TLI Group', 'Contingency', null, null, 45_000, null],
    ['OTH-010', 'TLI Group', 'Variation - Recoverable', null, null, 28_500, null],
    ['OTH-010', 'TLI Group', 'Variation - Recoverable', null, null, 14_200, null],
  ] as [string, string, string, number | null, number | null, number | null, number | null][]

  for (let i = 0; i < forecastData.length; i++) {
    const [code, supplier, status, factor, qty, rate, lump] = forecastData[i]
    if (!codeMap[code]) continue
    let total = 0
    if (lump) total = lump
    else if (factor && qty && rate) total = factor * qty * rate
    else if (qty && rate) total = qty * rate
    else if (rate) total = rate
    await prisma.forecastLine.create({
      data: {
        projectId: project.id,
        costCodeId: codeMap[code],
        sortOrder: i,
        supplier, status,
        factor: factor ?? null,
        quantity: qty ?? null,
        rate: lump ?? rate ?? null,
        total,
      },
    })
  }

  // Value Period
  await prisma.valuePeriod.create({
    data: {
      projectId: project.id,
      periodId: period.id,
      cumulClaimed: 4_180_000,
      cumulCertified: 4_100_000,
      frontLoading: -120_000,
      unapprovedClaims: 42_700,
      revenuReceived: 3_485_000,
      totalPaid: 3_485_000,
      riskValue: -28_000,
      opportunityValue: 55_000,
    },
  })

  // S-Curve data
  const sCurveData = [
    ['Jul-26', '2026-07-31', 0, 0, 85_000],
    ['Aug-26', '2026-08-31', 320_000, 295_000, 480_000],
    ['Sep-26', '2026-09-30', 680_000, 620_000, 890_000],
    ['Oct-26', '2026-10-31', 1_150_000, 1_050_000, 1_380_000],
    ['Nov-26', '2026-11-30', 1_720_000, 1_580_000, 2_010_000],
    ['Dec-26', '2026-12-31', 2_280_000, 2_100_000, 2_650_000],
    ['Jan-27', '2027-01-31', 2_950_000, 2_720_000, 3_320_000],
    ['Feb-27', '2027-02-28', 3_540_000, 3_420_000, 3_945_000],
    ['Mar-27', '2027-03-31', 4_220_000, 4_100_000, 4_634_000],
  ] as [string, string, number, number, number][]

  for (let i = 0; i < sCurveData.length; i++) {
    const [label, date, claimed, cert, cost] = sCurveData[i]
    await prisma.sCurveRow.create({
      data: {
        projectId: project.id,
        monthLabel: label,
        monthDate: new Date(date),
        sortOrder: i,
        cumulClaimed: claimed,
        cumulCertified: cert,
        cumulCost: cost,
      },
    })
  }

  // Period snapshot (previous period = Feb 2026)
  await prisma.periodSnapshot.create({
    data: {
      periodId: period.id,
      efc: 10_427_700,
      forecastMargin: 424_082,
      totalCTD: 3_610_200,
      totalClaimed: 3_540_000,
      cashPosition: 112_000,
      overUnderClaim: -70_200,
      tradePL: JSON.stringify({
        'Preliminaries': { projPL: -18_500, efc: 1_162_000 },
        'Design': { projPL: 12_200, efc: 578_000 },
        'Civil Works': { projPL: -9_800, efc: 1_695_000 },
        'Electrical Works': { projPL: -22_400, efc: 3_345_000 },
        'Mechanical Works': { projPL: -4_100, efc: 406_000 },
        'Commissioning': { projPL: 8_200, efc: 222_000 },
        'Other / Contingency': { projPL: -5_600, efc: 218_700 },
      }),
    },
  })

  console.log('✅ Seed complete — Barnaleen Solar project loaded')
}

main().catch(console.error).finally(() => prisma.$disconnect())
