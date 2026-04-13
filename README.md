# CVR Cost Reporting System

A full-stack web application for construction cost reporting — converted from the Excel CVR template. Built with Next.js 14, TypeScript, Tailwind CSS, and SQLite.

## Pages

| Page | Description |
|---|---|
| **Dashboard** | Executive KPI summary — Financial Position, Claims & Cash, Trade P/L, Programme |
| **CVR Trade** | Trade-level breakdown table — Budget → Value → CTD → EFC → P/L, inline editable |
| **Forecast** | Projected costs with nested parent/child line items, EFC summary bar |
| **Cost to Date** | Line-by-line posted costs and accruals, auto-populates from Cost Code master |
| **Committed** | Orders and subcontract register with status tracking |
| **Value / Claims** | Application & Certificate tracker, Cash Position, Risk & Opportunity |
| **S-Curve** | Monthly cumulative Claimed/Certified/Cost chart with editable data table |
| **Cost Codes** | Master CRUD table — the driver for all cost allocation across the system |
| **Checks** | 10 automated data quality checks with ✔/✖/⚠ status |
| **Settings** | Project details, contract financials, programme dates, Lock Period |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Seed database with Barnaleen Solar demo data
npx tsx src/lib/seed.ts

# 3. Run development server
npm run dev
# → http://localhost:3000
```

The app auto-redirects to the first project's dashboard. If no project exists, you'll see the Setup page.

## How Cost Codes Drive Everything

The **Cost Codes** page is the master reference. Every line in Cost to Date, Committed, and Forecast must have a valid Cost Code. When you enter a code:

1. **Description, Trade and Category auto-populate** via VLOOKUP (SUMIF in the server)
2. **CVR Trade** aggregates posted costs, committed orders and forecast by Trade using `SUMIF(trade_col, trade_name, amount_col)`
3. **Dashboard KPIs** sum across all trades

## Lock Period (End of Month)

1. Finalise all data (CTD, Committed, Forecast, Value)
2. Review the Checks page — resolve any ✖ issues
3. Go to **Settings → Lock Period**
4. The system saves a `PeriodSnapshot` — EFC, Margin, CTD, Claimed, Cash, and per-trade P/L
5. These become the "Previous Period" column on Dashboard and CVR Trade, enabling movement tracking

## Database

Uses [LibSQL](https://github.com/tursodatabase/libsql) (SQLite-compatible, file-based). Database file: `cvr.db` in the project root.

To re-seed with demo data (Barnaleen Solar Substation):
```bash
npx tsx src/lib/seed.ts
```

To start fresh with a new project, delete `cvr.db` and run the app — you'll be redirected to the Setup page.

## Tech Stack

- **Next.js 14** (App Router, Server Components, Server Actions)
- **TypeScript** — strict mode
- **Tailwind CSS** — with custom brand colour palette
- **LibSQL** — SQLite file database, no external DB needed
- **Recharts** — S-Curve line chart
- **Lucide React** — icons

## Project Structure

```
src/
├── app/
│   ├── [id]/              # Per-project pages (all dynamic routes)
│   │   ├── layout.tsx     # Sidebar nav
│   │   ├── dashboard/     # KPI dashboard
│   │   ├── trade/         # CVR trade table
│   │   ├── forecast/      # Nested forecast
│   │   ├── cost-to-date/  # CTD register
│   │   ├── committed/     # Committed register
│   │   ├── value/         # Application & cert
│   │   ├── s-curve/       # Chart + monthly data
│   │   ├── cost-codes/    # Master CRUD
│   │   ├── checks/        # Data quality
│   │   └── settings/      # Project settings
│   ├── api/projects/[id]/ # REST API routes
│   └── setup/             # First-run setup
├── lib/
│   ├── db.ts              # LibSQL client + schema init
│   ├── seed.ts            # Demo data seed
│   ├── calculations.ts    # KPI aggregation engine
│   └── utils.ts           # Formatting + constants
└── components/
    └── ui.tsx             # Shared components
```

## Adding a New Project

1. Go to `/setup` (or delete `cvr.db` and restart)
2. Fill in project details
3. Go to **Cost Codes** and add your cost code register
4. Add forecast lines, committed orders and cost-to-date entries
5. Enter value certified on the **CVR Trade** page

## Colour Coding

- 🟡 Yellow background = user input cell
- 🟢 Green background = auto-populated from Cost Code master (SUMIF)
- 🔵 Blue background = calculated formula
- ⬜ White = display value
