# ExtraOver v42 - Subcontractor register

## Subcontractor accounts (new page, Cost ledger section)
One account per subcontractor, created individually or in one click from the
suppliers already on the Committed sheet. Each account carries retention %,
RCT rate (0/20/35), tax clearance and insurance expiry dates, notes and a
final account status, with order value pulled live from committed lines.

## Payment certs with the Irish deduction cascade
Certs are entered cumulatively per sub (number auto-increments) and each
shows the full cascade: period gross, less retention, less RCT on the
balance, net payable — previewed live as you type before certifying. Certs
can be coded to a cost code and tagged to a variation (same coding
dimension as v39), and marked paid with a paid date. Latest unpaid cert can
be deleted. Every movement is audited.

## Compliance gate (lifted from Costline)
Certifying or paying a sub with expired tax clearance is blocked server-side
with a clear message; expired insurance proceeds but warns. Compliance chips
show on every account row.

## Retention position
The register's dark strip and the dashboard's WIP/Cash section now show
retention held by the employer against you (asset), retention you hold
against subs (liability), and the net retention position.

## Suggested accruals on Cost to Date
Where sub certs are coded to a cost code, certified-less-posted appears as a
one-click suggested accrual chip above the grid — the most error-prone
manual number in the CVR, now derived.

## New health checks
- Certified beyond order value on any sub account (error)
- Tax clearance expired on subs with money certified (warning)

## Schema
New tables subcontractors and sub_certs, created automatically on cold
start. No Turso reseed required.
