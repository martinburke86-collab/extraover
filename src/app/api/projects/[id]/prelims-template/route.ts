import { NextResponse } from 'next/server'
import { db, initDB, cuid } from '@/lib/db'
import { requireProjectApi } from '@/lib/apiAuth'

// The standard prelims template based on Revised_1.xlsx
// Section codes PR100-PR900, subsections, and all line items
// Each item carries its own cost code (PR101, PR102... within its stage) so
// Cost to Date and Committed can be linked to it. Codes are fixed here, not
// derived from position, so editing the template never renumbers them.
const TEMPLATE: Array<{
  code: string; stage: string; section: string; description: string
  unit: string; rate: number; qty: number | null
}> = [
  // ── PR100 MANAGEMENT AND STAFF ──────────────────────────────────────────
  { code:'PR101', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Director Levy',                              unit:'Weeks', rate:6000, qty:null },
  { code:'PR102', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Contracts Manager',                          unit:'Weeks', rate:1500, qty:null },
  { code:'PR103', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Project Manager',                             unit:'Weeks', rate:1200, qty:null },
  { code:'PR104', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Site Manager / Foreman',                      unit:'Weeks', rate:1350, qty:null },
  { code:'PR105', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Site Manager External',                       unit:'Weeks', rate:1350, qty:null },
  { code:'PR106', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Senior Engineer / Setting Out Engineer',      unit:'Weeks', rate:1200, qty:null },
  { code:'PR107', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Health & Safety Officer',                     unit:'Weeks', rate:1200, qty:null },
  { code:'PR108', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Finishing Foreman 1',                         unit:'Weeks', rate:1250, qty:null },
  { code:'PR109', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Finishing Foreman 2',                         unit:'Weeks', rate:1250, qty:null },
  { code:'PR110', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Senior QS',                                   unit:'Weeks', rate:1250, qty:null },
  { code:'PR111', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Junior QS',                                   unit:'Weeks', rate:900,  qty:null },
  { code:'PR112', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'M&E / Commissioning Manager',                 unit:'Weeks', rate:1300, qty:null },
  { code:'PR113', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'BIM Manager / Design Manager',                unit:'Weeks', rate:1100, qty:null },
  { code:'PR114', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Service Coordinator',                         unit:'Weeks', rate:1000, qty:null },
  { code:'PR115', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Quality Lead',                                unit:'Weeks', rate:1000, qty:null },
  { code:'PR116', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'General Labourer',                            unit:'Weeks', rate:1040, qty:null },
  { code:'PR117', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Handyman',                                    unit:'Weeks', rate:1280, qty:null },
  { code:'PR118', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Slinger / Signaller',                         unit:'Weeks', rate:1040, qty:null },
  { code:'PR119', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Gateman',                                     unit:'Weeks', rate:1040, qty:null },
  { code:'PR120', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Cleaners – welfare & accommodation',          unit:'Weeks', rate:800,  qty:null },
  { code:'PR121', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'PSCS (Project Supervisor Construction Stage)', unit:'item',  rate:0,    qty:1    },
  { code:'PR122', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Document Controller',                         unit:'Weeks', rate:0,    qty:null },
  { code:'PR123', stage:'PR100 – Management and Staff', section:'Project Specific Management & Staff', description:'Site Administrator',                          unit:'Weeks', rate:0,    qty:null },
  { code:'PR124', stage:'PR100 – Management and Staff', section:'Visiting Management & Staff',         description:'Visiting Director – periodic visits',         unit:'visits',rate:0,    qty:null },
  { code:'PR125', stage:'PR100 – Management and Staff', section:'Visiting Management & Staff',         description:'Managing Surveyor – periodic visits',         unit:'Weeks', rate:2300, qty:null },
  { code:'PR126', stage:'PR100 – Management and Staff', section:'Staff Expenses',                      description:'Staff Travel Allowance',                      unit:'Weeks', rate:0,    qty:null },
  { code:'PR127', stage:'PR100 – Management and Staff', section:'Staff Expenses',                      description:'Staff Accommodation Allowance',               unit:'Weeks', rate:0,    qty:null },
  { code:'PR128', stage:'PR100 – Management and Staff', section:'Staff Expenses',                      description:'Staff Vehicles',                              unit:'Weeks', rate:0,    qty:null },

  // ── PR200 SITE ESTABLISHMENT ─────────────────────────────────────────────
  { code:'PR201', stage:'PR200 – Site Establishment', section:'Site Offices',               description:'Site Set Up – Compound, Roadways, Walkways',                  unit:'item',  rate:0,    qty:1    },
  { code:'PR202', stage:'PR200 – Site Establishment', section:'Site Offices',               description:'Main Contractor Office Cabins',                               unit:'Weeks', rate:50,   qty:null },
  { code:'PR203', stage:'PR200 – Site Establishment', section:'Site Offices',               description:'Office Cabin Mob & Demob',                                    unit:'item',  rate:5000, qty:1    },
  { code:'PR204', stage:'PR200 – Site Establishment', section:'Site Offices',               description:'Client / ER Office Cabin',                                    unit:'Weeks', rate:50,   qty:null },
  { code:'PR205', stage:'PR200 – Site Establishment', section:'Site Offices',               description:'Storage Cabin',                                               unit:'Weeks', rate:50,   qty:null },
  { code:'PR206', stage:'PR200 – Site Establishment', section:'Site Offices',               description:'Site Sign / Name Board (Aluminium)',                           unit:'item',  rate:3500, qty:1    },
  { code:'PR207', stage:'PR200 – Site Establishment', section:'Welfare Facilities',         description:'Welfare Units',                                               unit:'Weeks', rate:0,    qty:null },
  { code:'PR208', stage:'PR200 – Site Establishment', section:'Welfare Facilities',         description:'Canteen',                                                     unit:'Weeks', rate:0,    qty:null },
  { code:'PR209', stage:'PR200 – Site Establishment', section:'Welfare Facilities',         description:'Drying Room',                                                 unit:'Weeks', rate:0,    qty:null },
  { code:'PR210', stage:'PR200 – Site Establishment', section:'Welfare Facilities',         description:'SA & RC Toilets',                                             unit:'Weeks', rate:0,    qty:null },
  { code:'PR211', stage:'PR200 – Site Establishment', section:'Welfare Facilities',         description:'Toilet – Client / ER',                                        unit:'Weeks', rate:55,   qty:null },
  { code:'PR212', stage:'PR200 – Site Establishment', section:'Welfare Facilities',         description:'Temporary Electrical Supply to Site Offices & Welfare',        unit:'Weeks', rate:0,    qty:null },
  { code:'PR213', stage:'PR200 – Site Establishment', section:'Welfare Facilities',         description:'Temporary Water Supply to Welfare Facilities',                 unit:'Weeks', rate:0,    qty:null },
  { code:'PR214', stage:'PR200 – Site Establishment', section:'Furniture, Equipment and IT',description:'Office Furniture & Equipment (incl. ER)',                      unit:'item',  rate:0,    qty:1    },
  { code:'PR215', stage:'PR200 – Site Establishment', section:'Furniture, Equipment and IT',description:'Computers, Phones & iPads',                                    unit:'item',  rate:1500, qty:1    },
  { code:'PR216', stage:'PR200 – Site Establishment', section:'Furniture, Equipment and IT',description:'Printer / Photocopier Hire',                                   unit:'item',  rate:0,    qty:1    },
  { code:'PR217', stage:'PR200 – Site Establishment', section:'Furniture, Equipment and IT',description:'Broadband / Wi-Fi',                                            unit:'Weeks', rate:0,    qty:null },
  { code:'PR218', stage:'PR200 – Site Establishment', section:'Furniture, Equipment and IT',description:'Autodesk / AutoCAD / Revit Licences',                          unit:'item',  rate:0,    qty:1    },
  { code:'PR219', stage:'PR200 – Site Establishment', section:'Furniture, Equipment and IT',description:'IT Support Costs',                                             unit:'item',  rate:0,    qty:1    },
  { code:'PR220', stage:'PR200 – Site Establishment', section:'Consumables & Sundries',     description:'Stationery & Postage',                                         unit:'Weeks', rate:30,   qty:null },
  { code:'PR221', stage:'PR200 – Site Establishment', section:'Consumables & Sundries',     description:'Tea, Coffee & Water',                                          unit:'Weeks', rate:0,    qty:null },
  { code:'PR222', stage:'PR200 – Site Establishment', section:'Consumables & Sundries',     description:'First Aid & Hygiene Supplies',                                 unit:'Weeks', rate:0,    qty:null },
  { code:'PR223', stage:'PR200 – Site Establishment', section:'Consumables & Sundries',     description:'Misc. Printing of Drawings',                                   unit:'item',  rate:0,    qty:1    },
  { code:'PR224', stage:'PR200 – Site Establishment', section:'Consumables & Sundries',     description:'Courier Charges',                                              unit:'item',  rate:0,    qty:1    },
  { code:'PR225', stage:'PR200 – Site Establishment', section:'Consumables & Sundries',     description:'Notice Boards / Information Displays',                         unit:'item',  rate:0,    qty:1    },

  // ── PR300 SECURITY, HOARDINGS AND FENCING ────────────────────────────────
  { code:'PR301', stage:'PR300 – Security, Hoardings and Fencing', section:'On-Site Security',            description:'Security Staff / Standing Guard',           unit:'Weeks', rate:0,   qty:null },
  { code:'PR302', stage:'PR300 – Security, Hoardings and Fencing', section:'On-Site Security',            description:'Mobile Patrols',                            unit:'Weeks', rate:0,   qty:null },
  { code:'PR303', stage:'PR300 – Security, Hoardings and Fencing', section:'CCTV & Site Lighting',        description:'CCTV – Installation',                       unit:'item',  rate:0,   qty:1    },
  { code:'PR304', stage:'PR300 – Security, Hoardings and Fencing', section:'CCTV & Site Lighting',        description:'CCTV – Monitoring (weekly)',                 unit:'Weeks', rate:210, qty:null },
  { code:'PR305', stage:'PR300 – Security, Hoardings and Fencing', section:'CCTV & Site Lighting',        description:'CCTV – Dismantle',                          unit:'item',  rate:0,   qty:1    },
  { code:'PR306', stage:'PR300 – Security, Hoardings and Fencing', section:'CCTV & Site Lighting',        description:'Time-Lapse CCTV',                           unit:'Weeks', rate:30,  qty:null },
  { code:'PR307', stage:'PR300 – Security, Hoardings and Fencing', section:'CCTV & Site Lighting',        description:'Site Lighting – Installation & Running',    unit:'item',  rate:3000,qty:1    },
  { code:'PR308', stage:'PR300 – Security, Hoardings and Fencing', section:'Hoardings & Fencing',         description:'Herras Fencing – Hire',                     unit:'m',     rate:0,   qty:null },
  { code:'PR309', stage:'PR300 – Security, Hoardings and Fencing', section:'Hoardings & Fencing',         description:'Plywood Hoarding 2.4m – Labour',            unit:'m',     rate:0,   qty:null },
  { code:'PR310', stage:'PR300 – Security, Hoardings and Fencing', section:'Hoardings & Fencing',         description:'Plywood Hoarding 2.4m – Materials',         unit:'m',     rate:90,  qty:null },
  { code:'PR311', stage:'PR300 – Security, Hoardings and Fencing', section:'Hoardings & Fencing',         description:'Internal Laminate Seal Hoarding',           unit:'m',     rate:120, qty:null },
  { code:'PR312', stage:'PR300 – Security, Hoardings and Fencing', section:'Hoardings & Fencing',         description:'Debris Net to Hoarding',                    unit:'m',     rate:10,  qty:null },
  { code:'PR313', stage:'PR300 – Security, Hoardings and Fencing', section:'Gates & Signage',             description:'Main Site Gate',                            unit:'item',  rate:0,   qty:1    },
  { code:'PR314', stage:'PR300 – Security, Hoardings and Fencing', section:'Gates & Signage',             description:'Pedestrian Gate',                           unit:'item',  rate:0,   qty:1    },
  { code:'PR315', stage:'PR300 – Security, Hoardings and Fencing', section:'Gates & Signage',             description:'Graphics / Signage to Hoarding',            unit:'item',  rate:0,   qty:1    },
  { code:'PR316', stage:'PR300 – Security, Hoardings and Fencing', section:'Gates & Signage',             description:'General Signage',                           unit:'item',  rate:0,   qty:1    },
  { code:'PR317', stage:'PR300 – Security, Hoardings and Fencing', section:'Gates & Signage',             description:'Access Control System / Turnstile',         unit:'item',  rate:0,   qty:null },
  { code:'PR318', stage:'PR300 – Security, Hoardings and Fencing', section:'Road Sweeper & Pest Control', description:'Road Sweeper – Visits',                     unit:'no.',   rate:300, qty:null },
  { code:'PR319', stage:'PR300 – Security, Hoardings and Fencing', section:'Road Sweeper & Pest Control', description:'Pest Control',                              unit:'item',  rate:0,   qty:1    },

  // ── PR400 SAFETY AND ENVIRONMENTAL PROTECTION ────────────────────────────
  { code:'PR401', stage:'PR400 – Safety and Environmental Protection', section:'PPE & H&S Equipment', description:'PPE – Personal Protective Equipment',             unit:'item',  rate:0,    qty:1    },
  { code:'PR402', stage:'PR400 – Safety and Environmental Protection', section:'PPE & H&S Equipment', description:'Misc. PPE Equipment',                             unit:'item',  rate:0,    qty:1    },
  { code:'PR403', stage:'PR400 – Safety and Environmental Protection', section:'PPE & H&S Equipment', description:'H&S Equipment (general)',                         unit:'item',  rate:0,    qty:1    },
  { code:'PR404', stage:'PR400 – Safety and Environmental Protection', section:'PPE & H&S Equipment', description:'H&S Training',                                    unit:'item',  rate:0,    qty:1    },
  { code:'PR405', stage:'PR400 – Safety and Environmental Protection', section:'PPE & H&S Equipment', description:'Safety Signage',                                  unit:'item',  rate:1500, qty:1    },
  { code:'PR406', stage:'PR400 – Safety and Environmental Protection', section:'PPE & H&S Equipment', description:'Drug & Alcohol Testing',                          unit:'item',  rate:0,    qty:null },
  { code:'PR407', stage:'PR400 – Safety and Environmental Protection', section:'PPE & H&S Equipment', description:'SafePass / CSCS Compliance & Cards',              unit:'item',  rate:0,    qty:null },
  { code:'PR408', stage:'PR400 – Safety and Environmental Protection', section:'Fire Safety',          description:'Fire Alarms (temporary)',                         unit:'item',  rate:0,    qty:1    },
  { code:'PR409', stage:'PR400 – Safety and Environmental Protection', section:'Fire Safety',          description:'Fire Extinguishers',                              unit:'item',  rate:0,    qty:1    },
  { code:'PR410', stage:'PR400 – Safety and Environmental Protection', section:'Edge Protection',      description:'Guard Rails & Edge Protection',                   unit:'item',  rate:0,    qty:1    },
  { code:'PR411', stage:'PR400 – Safety and Environmental Protection', section:'Edge Protection',      description:'Protective Walkways & Barriers',                  unit:'item',  rate:0,    qty:1    },
  { code:'PR412', stage:'PR400 – Safety and Environmental Protection', section:'Edge Protection',      description:'Double Handrail to Roof',                         unit:'m',     rate:21,   qty:null },
  { code:'PR413', stage:'PR400 – Safety and Environmental Protection', section:'Environmental',        description:'Bunded Fuel Tank',                                unit:'item',  rate:0,    qty:1    },
  { code:'PR414', stage:'PR400 – Safety and Environmental Protection', section:'Environmental',        description:'Dust / Noise / Vibration Monitoring',             unit:'Weeks', rate:24,   qty:null },
  { code:'PR415', stage:'PR400 – Safety and Environmental Protection', section:'Environmental',        description:'Waste Management Plan',                           unit:'item',  rate:0,    qty:1    },
  { code:'PR416', stage:'PR400 – Safety and Environmental Protection', section:'Environmental',        description:'Environmental Protection Measures (general)',      unit:'item',  rate:0,    qty:1    },
  { code:'PR417', stage:'PR400 – Safety and Environmental Protection', section:'Environmental',        description:'Ecology / Invasive Plant Survey',                  unit:'item',  rate:1000, qty:1    },
  { code:'PR418', stage:'PR400 – Safety and Environmental Protection', section:'Environmental',        description:'Spill Kits & Absorbents',                         unit:'item',  rate:0,    qty:null },
  { code:'PR419', stage:'PR400 – Safety and Environmental Protection', section:'Environmental',        description:'Acoustic Hoarding / Noise Barriers',              unit:'item',  rate:0,    qty:null },

  // ── PR500 CONTROL AND PROTECTION ─────────────────────────────────────────
  { code:'PR501', stage:'PR500 – Control and Protection', section:'Surveys & Setting Out',  description:'Topographical Survey',                          unit:'item',  rate:0,    qty:1    },
  { code:'PR502', stage:'PR500 – Control and Protection', section:'Surveys & Setting Out',  description:'Services Scan – GPR Survey',                    unit:'item',  rate:5000, qty:1    },
  { code:'PR503', stage:'PR500 – Control and Protection', section:'Surveys & Setting Out',  description:'CCTV Drain Survey',                             unit:'item',  rate:5000, qty:1    },
  { code:'PR504', stage:'PR500 – Control and Protection', section:'Surveys & Setting Out',  description:'Dilapidation Survey on Start',                  unit:'item',  rate:0,    qty:1    },
  { code:'PR505', stage:'PR500 – Control and Protection', section:'Surveys & Setting Out',  description:'As-Built Survey on Completion',                 unit:'item',  rate:0,    qty:1    },
  { code:'PR506', stage:'PR500 – Control and Protection', section:'Surveys & Setting Out',  description:'Setting Out Equipment – Hire',                  unit:'Weeks', rate:140,  qty:null },
  { code:'PR507', stage:'PR500 – Control and Protection', section:'Surveys & Setting Out',  description:'Calibration / Servicing of Surveying Equipment',unit:'item',  rate:0,    qty:1    },
  { code:'PR508', stage:'PR500 – Control and Protection', section:'Testing',                description:'Cube / Concrete Testing',                       unit:'item',  rate:2500, qty:1    },
  { code:'PR509', stage:'PR500 – Control and Protection', section:'Testing',                description:'Air Tightness Testing',                         unit:'item',  rate:5000, qty:1    },
  { code:'PR510', stage:'PR500 – Control and Protection', section:'Testing',                description:'Acoustic Testing',                              unit:'item',  rate:0,    qty:1    },
  { code:'PR511', stage:'PR500 – Control and Protection', section:'Testing',                description:'Roof Testing – Flood / Electronic Test',        unit:'item',  rate:0,    qty:1    },
  { code:'PR512', stage:'PR500 – Control and Protection', section:'Testing',                description:'Window / Curtain Walling Testing – Hose Test',  unit:'item',  rate:0,    qty:1    },
  { code:'PR513', stage:'PR500 – Control and Protection', section:'Testing',                description:'Foul & Storm System Testing',                   unit:'item',  rate:0,    qty:1    },
  { code:'PR514', stage:'PR500 – Control and Protection', section:'Testing',                description:'Radon Barrier Testing',                         unit:'item',  rate:0,    qty:1    },
  { code:'PR515', stage:'PR500 – Control and Protection', section:'Testing',                description:'Asbestos Sampling',                             unit:'no.',   rate:300,  qty:null },
  { code:'PR516', stage:'PR500 – Control and Protection', section:'Testing',                description:'Misc. Fees and Testing',                        unit:'item',  rate:0,    qty:1    },
  { code:'PR517', stage:'PR500 – Control and Protection', section:'Testing',                description:'Structural / Settlement Monitoring',            unit:'Weeks', rate:0,    qty:null },
  { code:'PR518', stage:'PR500 – Control and Protection', section:'Testing',                description:'Pressure Testing of Pipework',                  unit:'item',  rate:0,    qty:null },
  { code:'PR519', stage:'PR500 – Control and Protection', section:'Testing',                description:'BER Assessment / EPC Certificates',             unit:'item',  rate:0,    qty:null },
  { code:'PR520', stage:'PR500 – Control and Protection', section:'Protection of Works',    description:'Protection of Works – General',                 unit:'item',  rate:0,    qty:1    },
  { code:'PR521', stage:'PR500 – Control and Protection', section:'Protection of Works',    description:'Protection of Floor Finishes',                  unit:'m²',    rate:8,    qty:null },
  { code:'PR522', stage:'PR500 – Control and Protection', section:'Protection of Works',    description:'Protection of Roof Finishes',                   unit:'item',  rate:0,    qty:1    },
  { code:'PR523', stage:'PR500 – Control and Protection', section:'Protection of Works',    description:'Protection of FFE',                             unit:'item',  rate:0,    qty:1    },
  { code:'PR524', stage:'PR500 – Control and Protection', section:'Protection of Works',    description:'Temporary Waterproofing – Roof',                unit:'item',  rate:0,    qty:1    },
  { code:'PR525', stage:'PR500 – Control and Protection', section:'Protection of Works',    description:'Temporary Waterproofing – Façade',              unit:'item',  rate:0,    qty:1    },
  { code:'PR526', stage:'PR500 – Control and Protection', section:'Protection of Works',    description:'Dust Containment / Internal Screens',           unit:'item',  rate:0,    qty:1    },
  { code:'PR527', stage:'PR500 – Control and Protection', section:'Wheel Wash and Site Roads',description:'Wheel Wash – Weekly Hire',                    unit:'Weeks', rate:350,  qty:null },
  { code:'PR528', stage:'PR500 – Control and Protection', section:'Wheel Wash and Site Roads',description:'Wheel Wash – Setup',                          unit:'item',  rate:3000, qty:1    },
  { code:'PR529', stage:'PR500 – Control and Protection', section:'Wheel Wash and Site Roads',description:'Roads Setup & Maintenance',                    unit:'item',  rate:0,    qty:1    },
  { code:'PR530', stage:'PR500 – Control and Protection', section:'Wheel Wash and Site Roads',description:'Tree Protection & Removal',                    unit:'item',  rate:0,    qty:1    },
  { code:'PR531', stage:'PR500 – Control and Protection', section:'Samples and Mockups',    description:'Sample Boards',                                 unit:'item',  rate:0,    qty:1    },
  { code:'PR532', stage:'PR500 – Control and Protection', section:'Samples and Mockups',    description:'Mock-Up Units',                                 unit:'item',  rate:0,    qty:1    },

  // ── PR600 PLANT AND EQUIPMENT ─────────────────────────────────────────────
  { code:'PR601', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Tower Crane – Hire (Zone A)',                            unit:'Weeks', rate:520,  qty:null },
  { code:'PR602', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Tower Crane – Hire (Zone B)',                            unit:'Weeks', rate:520,  qty:null },
  { code:'PR603', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Tower Crane Driver (Zone A)',                            unit:'Weeks', rate:1500, qty:null },
  { code:'PR604', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Tower Crane Driver (Zone B)',                            unit:'Weeks', rate:1500, qty:null },
  { code:'PR605', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Tower Crane – Erect & Dismantle',                       unit:'item',  rate:0,    qty:1    },
  { code:'PR606', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Tower Crane – Inspections',                             unit:'no.',   rate:0,    qty:null },
  { code:'PR607', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Banksman (Zone A)',                                     unit:'Weeks', rate:1000, qty:null },
  { code:'PR608', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Banksman (Zone B)',                                     unit:'Weeks', rate:1000, qty:null },
  { code:'PR609', stage:'PR600 – Plant and Equipment', section:'Cranes',                       description:'Mobile Crane – Hire (incl. driver & banksman)',          unit:'visits',rate:1100, qty:null },
  { code:'PR610', stage:'PR600 – Plant and Equipment', section:'Teleporter',                   description:'Teleporter & Driver',                                   unit:'Weeks', rate:1200, qty:null },
  { code:'PR611', stage:'PR600 – Plant and Equipment', section:'Teleporter',                   description:'Teleporter – External',                                 unit:'Weeks', rate:350,  qty:null },
  { code:'PR612', stage:'PR600 – Plant and Equipment', section:'Teleporter',                   description:'Forks Brush Attachment',                                unit:'Weeks', rate:50,   qty:null },
  { code:'PR613', stage:'PR600 – Plant and Equipment', section:'Excavator and Earthworks Plant',description:'Excavator – 1 Tonne',                                  unit:'Weeks', rate:0,    qty:null },
  { code:'PR614', stage:'PR600 – Plant and Equipment', section:'Excavator and Earthworks Plant',description:'Excavator – 5 Tonne',                                  unit:'Weeks', rate:0,    qty:null },
  { code:'PR615', stage:'PR600 – Plant and Equipment', section:'Excavator and Earthworks Plant',description:'Excavator – 13 Tonne',                                 unit:'Weeks', rate:0,    qty:null },
  { code:'PR616', stage:'PR600 – Plant and Equipment', section:'Excavator and Earthworks Plant',description:'Excavator – 21 Tonne',                                 unit:'Weeks', rate:0,    qty:null },
  { code:'PR617', stage:'PR600 – Plant and Equipment', section:'Excavator and Earthworks Plant',description:'Dumper',                                               unit:'Weeks', rate:0,    qty:null },
  { code:'PR618', stage:'PR600 – Plant and Equipment', section:'Excavator and Earthworks Plant',description:'Tracked Dumper',                                       unit:'Weeks', rate:0,    qty:null },
  { code:'PR619', stage:'PR600 – Plant and Equipment', section:'Generators and Fuel',          description:'Generator – 110 kVA',                                   unit:'Weeks', rate:250,  qty:null },
  { code:'PR620', stage:'PR600 – Plant and Equipment', section:'Generators and Fuel',          description:'Genset Compound',                                       unit:'Weeks', rate:190,  qty:null },
  { code:'PR621', stage:'PR600 – Plant and Equipment', section:'Generators and Fuel',          description:'Fuel – General',                                        unit:'Weeks', rate:150,  qty:null },
  { code:'PR622', stage:'PR600 – Plant and Equipment', section:'Generators and Fuel',          description:'Fuel – Plant',                                          unit:'Weeks', rate:100,  qty:null },
  { code:'PR623', stage:'PR600 – Plant and Equipment', section:'Generators and Fuel',          description:'HVO Fuel Surcharge / Premium over White Diesel',         unit:'Weeks', rate:0,    qty:null },
  { code:'PR624', stage:'PR600 – Plant and Equipment', section:'Utility Consumption',          description:'Electricity Consumption – Site (ESB ongoing)',           unit:'Weeks', rate:0,    qty:null },
  { code:'PR625', stage:'PR600 – Plant and Equipment', section:'Utility Consumption',          description:'Water Consumption – Site (ongoing)',                     unit:'Weeks', rate:0,    qty:null },
  { code:'PR626', stage:'PR600 – Plant and Equipment', section:'Utility Consumption',          description:'Gas Consumption – Site (ongoing)',                       unit:'Weeks', rate:0,    qty:null },
  { code:'PR627', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Small Tools (incl. external hire)',                      unit:'Weeks', rate:150,  qty:null },
  { code:'PR628', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Mixers, Block Grabs etc.',                               unit:'Weeks', rate:0,    qty:null },
  { code:'PR629', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Heaters / Dehumidifiers for Drying Out',                 unit:'Weeks', rate:500,  qty:null },
  { code:'PR630', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Water Pumps',                                            unit:'item',  rate:0,    qty:1    },
  { code:'PR631', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Concrete Pump',                                          unit:'item',  rate:950,  qty:1    },
  { code:'PR632', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Concrete Skip Hire',                                     unit:'Weeks', rate:0,    qty:null },
  { code:'PR633', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Plant Damages / Losses / Punctures',                     unit:'item',  rate:1500, qty:1    },
  { code:'PR634', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Compressor',                                             unit:'Weeks', rate:0,    qty:null },
  { code:'PR635', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Road Plates',                                            unit:'item',  rate:0,    qty:null },
  { code:'PR636', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Site Van / Welfare Vehicle',                             unit:'Weeks', rate:0,    qty:null },
  { code:'PR637', stage:'PR600 – Plant and Equipment', section:'General Plant and Small Tools',description:'Temporary Electrical Distribution Boards & Cabling',     unit:'item',  rate:0,    qty:null },

  // ── PR700 ACCESS AND TEMPORARY WORKS ─────────────────────────────────────
  { code:'PR701', stage:'PR700 – Access and Temporary Works', section:'External Scaffolding',    description:'External Scaffold – Erection',                          unit:'item',  rate:0,    qty:1    },
  { code:'PR702', stage:'PR700 – Access and Temporary Works', section:'External Scaffolding',    description:'External Scaffold – Hire (weekly)',                     unit:'Weeks', rate:0,    qty:null },
  { code:'PR703', stage:'PR700 – Access and Temporary Works', section:'External Scaffolding',    description:'External Scaffold – Dismantle',                        unit:'item',  rate:0,    qty:1    },
  { code:'PR704', stage:'PR700 – Access and Temporary Works', section:'External Scaffolding',    description:'External Scaffold – Adaptations',                      unit:'item',  rate:0,    qty:1    },
  { code:'PR705', stage:'PR700 – Access and Temporary Works', section:'External Scaffolding',    description:'External Scaffold – Inspections / Sign Off',           unit:'no.',   rate:0,    qty:null },
  { code:'PR706', stage:'PR700 – Access and Temporary Works', section:'Internal Scaffolding',    description:'Internal Scaffold – Supply & Erect',                   unit:'item',  rate:0,    qty:1    },
  { code:'PR707', stage:'PR700 – Access and Temporary Works', section:'Internal Scaffolding',    description:'Internal Scaffold – Adaptations',                      unit:'item',  rate:0,    qty:1    },
  { code:'PR708', stage:'PR700 – Access and Temporary Works', section:'Internal Scaffolding',    description:'Internal Scaffold – Dismantle',                        unit:'item',  rate:0,    qty:1    },
  { code:'PR709', stage:'PR700 – Access and Temporary Works', section:'MEWP / Platforms',        description:'Cherry Picker / MEWP – Weekly Hire',                   unit:'Weeks', rate:550,  qty:null },
  { code:'PR710', stage:'PR700 – Access and Temporary Works', section:'MEWP / Platforms',        description:'Scissor Lift – Weekly Hire',                           unit:'Weeks', rate:250,  qty:null },
  { code:'PR711', stage:'PR700 – Access and Temporary Works', section:'MEWP / Platforms',        description:'Suspended Access Platform (Gondola) – Hire',           unit:'Weeks', rate:0,    qty:null },
  { code:'PR712', stage:'PR700 – Access and Temporary Works', section:'Hoists',                  description:'Mast Hoist – Hire',                                    unit:'item',  rate:450,  qty:1    },
  { code:'PR713', stage:'PR700 – Access and Temporary Works', section:'Hoists',                  description:'Mast Hoist – Erect / Dismantle / Commission',          unit:'item',  rate:5200, qty:1    },
  { code:'PR714', stage:'PR700 – Access and Temporary Works', section:'Hoists',                  description:'Beneficial Use of Lift',                               unit:'item',  rate:0,    qty:1    },
  { code:'PR715', stage:'PR700 – Access and Temporary Works', section:'Temporary Works Design',  description:'Temporary Works Design Fees',                          unit:'item',  rate:7500, qty:1    },
  { code:'PR716', stage:'PR700 – Access and Temporary Works', section:'Temporary Works Design',  description:'Traffic Management Design & Plans',                    unit:'item',  rate:6300, qty:1    },
  { code:'PR717', stage:'PR700 – Access and Temporary Works', section:'Temporary Works Design',  description:'Traffic Management – Setup Costs',                     unit:'item',  rate:0,    qty:1    },
  { code:'PR718', stage:'PR700 – Access and Temporary Works', section:'Excavation Support',      description:'Sheet Piling – Temporary',                             unit:'item',  rate:0,    qty:1    },
  { code:'PR719', stage:'PR700 – Access and Temporary Works', section:'Excavation Support',      description:'Shoring & Propping',                                   unit:'item',  rate:0,    qty:1    },
  { code:'PR720', stage:'PR700 – Access and Temporary Works', section:'Excavation Support',      description:'Dewatering & Settlement Tank',                         unit:'item',  rate:0,    qty:1    },
  { code:'PR721', stage:'PR700 – Access and Temporary Works', section:'Excavation Support',      description:'Temporary Drainage Installation',                      unit:'item',  rate:0,    qty:1    },

  // ── PR800 SITE RECORDS, CLEANING AND COMPLETION ──────────────────────────
  { code:'PR801', stage:'PR800 – Site Records, Cleaning and Completion', section:'Waste & Ongoing Cleaning', description:'Skip Hire – General (ongoing)',                 unit:'Weeks', rate:500,  qty:null },
  { code:'PR802', stage:'PR800 – Site Records, Cleaning and Completion', section:'Waste & Ongoing Cleaning', description:'12m Skip – Mixed Waste',                        unit:'no.',   rate:0,    qty:null },
  { code:'PR803', stage:'PR800 – Site Records, Cleaning and Completion', section:'Waste & Ongoing Cleaning', description:'8m Skip – Mixed Waste',                         unit:'no.',   rate:0,    qty:null },
  { code:'PR804', stage:'PR800 – Site Records, Cleaning and Completion', section:'Waste & Ongoing Cleaning', description:'1.5m Skip – Mixed Waste',                       unit:'no.',   rate:0,    qty:null },
  { code:'PR805', stage:'PR800 – Site Records, Cleaning and Completion', section:'Waste & Ongoing Cleaning', description:'Special / Contaminated Waste',                  unit:'item',  rate:0,    qty:1    },
  { code:'PR806', stage:'PR800 – Site Records, Cleaning and Completion', section:'Waste & Ongoing Cleaning', description:'Removal of Waste from Welfare Facilities',      unit:'Weeks', rate:0,    qty:null },
  { code:'PR807', stage:'PR800 – Site Records, Cleaning and Completion', section:'Waste & Ongoing Cleaning', description:'Weekly Site Cleaning',                          unit:'Weeks', rate:80,   qty:null },
  { code:'PR808', stage:'PR800 – Site Records, Cleaning and Completion', section:'Waste & Ongoing Cleaning', description:'Misc. Cleaning & Welfare Materials',            unit:'Weeks', rate:0,    qty:null },
  { code:'PR809', stage:'PR800 – Site Records, Cleaning and Completion', section:'Cleaning of the Works',    description:'Final / Builders Clean',                        unit:'item',  rate:0,    qty:1    },
  { code:'PR810', stage:'PR800 – Site Records, Cleaning and Completion', section:'Cleaning of the Works',    description:'Sparkle / Hygienic Clean',                      unit:'item',  rate:0,    qty:1    },
  { code:'PR811', stage:'PR800 – Site Records, Cleaning and Completion', section:'Cleaning of the Works',    description:'External Façade Clean',                         unit:'item',  rate:7500, qty:1    },
  { code:'PR812', stage:'PR800 – Site Records, Cleaning and Completion', section:'Snagging and Defects',     description:'Snagging / Defects Allowance',                  unit:'item',  rate:0,    qty:1    },
  { code:'PR813', stage:'PR800 – Site Records, Cleaning and Completion', section:'Snagging and Defects',     description:'Post-Completion Maintenance',                    unit:'item',  rate:0,    qty:1    },
  { code:'PR814', stage:'PR800 – Site Records, Cleaning and Completion', section:'O&M Manual & Records',     description:'O&M Manuals / Safety File',                     unit:'item',  rate:0,    qty:1    },
  { code:'PR815', stage:'PR800 – Site Records, Cleaning and Completion', section:'O&M Manual & Records',     description:'Digital Manuals',                               unit:'item',  rate:20000,qty:1    },
  { code:'PR816', stage:'PR800 – Site Records, Cleaning and Completion', section:'O&M Manual & Records',     description:'Progress Photos',                               unit:'Weeks', rate:0,    qty:null },
  { code:'PR817', stage:'PR800 – Site Records, Cleaning and Completion', section:'O&M Manual & Records',     description:'Photography / Drone on Completion',             unit:'item',  rate:0,    qty:1    },

  // ── PR900 FEES, INSURANCE, BONDS AND STATUTORY CHARGES ───────────────────
  { code:'PR901', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Fees to Statutory Bodies',         description:'Road Open Licence',                                         unit:'item',  rate:1250, qty:1    },
  { code:'PR902', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Fees to Statutory Bodies',         description:'Hoarding Licence',                                          unit:'item',  rate:0,    qty:1    },
  { code:'PR903', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Fees to Statutory Bodies',         description:'National Monument Licence & Reporting',                     unit:'item',  rate:400,  qty:1    },
  { code:'PR904', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Fees to Statutory Bodies',         description:'Scaffolding Permits & Charges',                             unit:'item',  rate:0,    qty:1    },
  { code:'PR905', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Fees to Statutory Bodies',         description:'Planning / LA Charges (misc.)',                             unit:'item',  rate:0,    qty:1    },
  { code:'PR906', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Fees to Statutory Bodies',         description:'CIF / CITB Levy',                                           unit:'item',  rate:0,    qty:null },
  { code:'PR907', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Fees to Statutory Bodies',         description:'EPA Waste Disposal Levy',                                   unit:'item',  rate:0,    qty:null },
  { code:'PR908', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Temporary Services - Connection Fees', description:'ESB Temporary Connection Fees',                         unit:'item',  rate:5000, qty:1    },
  { code:'PR909', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Temporary Services - Connection Fees', description:'Temporary Substation Costs',                             unit:'item',  rate:0,    qty:1    },
  { code:'PR910', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Temporary Services - Connection Fees', description:'Water Connection Fees',                                 unit:'item',  rate:0,    qty:1    },
  { code:'PR911', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Temporary Services - Connection Fees', description:'Gas Networks Ireland Connection Fee',                    unit:'item',  rate:0,    qty:null },
  { code:'PR912', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Insurance',                        description:'Employers Liability (EL) Insurance',                        unit:'item',  rate:0,    qty:1    },
  { code:'PR913', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Insurance',                        description:'Public Liability (PL) Insurance',                           unit:'item',  rate:0,    qty:1    },
  { code:'PR914', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Insurance',                        description:'Contractors All Risk (CAR) Insurance',                      unit:'item',  rate:0,    qty:1    },
  { code:'PR915', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Insurance',                        description:'Professional Indemnity Insurance',                          unit:'item',  rate:0,    qty:1    },
  { code:'PR916', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Insurance',                        description:'Latent Defects Insurance',                                  unit:'item',  rate:0,    qty:null },
  { code:'PR917', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Bonds & Guarantees',               description:'Performance Bond',                                         unit:'item',  rate:0,    qty:1    },
  { code:'PR918', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Bonds & Guarantees',               description:'Homebond / Warranty',                                       unit:'item',  rate:0,    qty:1    },
  { code:'PR919', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Bonds & Guarantees',               description:'Parent Company Guarantee',                                  unit:'item',  rate:0,    qty:1    },
  { code:'PR920', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Bonds & Guarantees',               description:'Retention Bond / Maintenance Bond',                         unit:'item',  rate:0,    qty:null },
  { code:'PR921', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Design & Consultancy Fees',        description:'PQS Fees',                                                  unit:'item',  rate:0,    qty:1    },
  { code:'PR922', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Design & Consultancy Fees',        description:'Acoustic Consultant',                                       unit:'item',  rate:0,    qty:1    },
  { code:'PR923', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Design & Consultancy Fees',        description:'Fire Consultant',                                           unit:'item',  rate:0,    qty:1    },
  { code:'PR924', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Design & Consultancy Fees',        description:'Misc. Engineering Costs',                                   unit:'item',  rate:0,    qty:1    },
  { code:'PR925', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Design & Consultancy Fees',        description:'BCAR Management (BCMS Portal & Ancillary Certificates)',     unit:'item',  rate:0,    qty:null },
  { code:'PR926', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Miscellaneous',                    description:'Out-of-Hours Working Allowance',                             unit:'item',  rate:0,    qty:1    },
  { code:'PR927', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Miscellaneous',                    description:'Overtime Allowance',                                         unit:'item',  rate:0,    qty:1    },
  { code:'PR928', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Miscellaneous',                    description:'Archaeology / Monitoring',                                   unit:'item',  rate:4800, qty:1    },
  { code:'PR929', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Miscellaneous',                    description:'Decant Works',                                               unit:'item',  rate:0,    qty:1    },
  { code:'PR930', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Miscellaneous',                    description:'Unbudgeted / Provisional Costs',                             unit:'item',  rate:0,    qty:1    },
  { code:'PR931', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Miscellaneous',                    description:'Community Liaison Officer',                                  unit:'Weeks', rate:0,    qty:null },
  { code:'PR932', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Miscellaneous',                    description:'Social Value / Apprenticeship Reporting',                   unit:'item',  rate:0,    qty:null },
  { code:'PR933', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Miscellaneous',                    description:'Carbon Footprint / Embodied Carbon Tracking (One Click LCA)',unit:'item',  rate:0,    qty:null },
  { code:'PR934', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Head Office Overheads',            description:'Head Office Overheads',                                      unit:'item',  rate:0,    qty:1    },
  { code:'PR935', stage:'PR900 – Fees, Insurance, Bonds and Statutory Charges', section:'Head Office Overheads',            description:'Department Overheads',                                       unit:'item',  rate:0,    qty:1    },
]

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectApi(params.id, 'editor')
  if (!guard.ok) return guard.res
  await initDB()

  // Check if prelims already exist — don't overwrite
  const existing = await db.execute({
    sql: 'SELECT COUNT(*) as n FROM prelim_items WHERE project_id=?',
    args: [params.id],
  })
  const count = Number((existing.rows[0] as any)?.n ?? 0)

  // Only seed if empty, or force=true is sent
  const body = await _.json?.().catch(() => ({})) ?? {}

  if (count > 0 && !(body as any).force) {
    return NextResponse.json({ skipped: true, count, message: 'Prelims already exist. Pass force:true to overwrite.' })
  }

  if ((body as any).force) {
    await db.execute({ sql: 'DELETE FROM prelim_items WHERE project_id=?', args: [params.id] })
  }

  // Register the template's codes under the project's Preliminaries trade so
  // costs can be posted to them; existing codes are left exactly as they are
  const tradeR = await db.execute({
    sql: `SELECT name FROM trades WHERE project_id=? AND (forecast_method='prelims' OR LOWER(name) LIKE 'prelim%')
          ORDER BY (forecast_method='prelims') DESC LIMIT 1`,
    args: [params.id],
  })
  const prelimsTrade = tradeR.rows.length ? String((tradeR.rows[0] as any).name) : 'Preliminaries'
  const category: Record<string, string> = { '1': 'Labour', '3': 'Subcontractor', '6': 'Plant', '7': 'Subcontractor' }

  let sortOrder = 0, codesAdded = 0
  for (const item of TEMPLATE) {
    const r = await db.execute({
      sql: `INSERT OR IGNORE INTO cost_codes (id, project_id, code, description, trade, category, notes)
            VALUES (?,?,?,?,?,?,'Prelims template')`,
      args: [cuid(), params.id, item.code, item.description, prelimsTrade, category[item.code[2]] ?? 'Indirect'],
    })
    codesAdded += r.rowsAffected
    await db.execute({
      sql: `INSERT INTO prelim_items
              (id, project_id, sort_order, stage, section, description, cost_code, budget,
               ctd, committed, utilisation_pct, qty, unit, rate, start_week, finish_week, notes)
            VALUES (?,?,?,?,?,?,?,0,0,0,100,?,?,?,NULL,NULL,NULL)`,
      args: [cuid(), params.id, sortOrder++, item.stage, item.section, item.description, item.code,
             item.qty, item.unit, item.rate],
    })
  }

  return NextResponse.json({ ok: true, inserted: TEMPLATE.length, codesAdded })
}
