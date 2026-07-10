# ExtraOver v43 - Committed convention made explicit

## The convention (decided during the Riverbank test run)
Committed means REMAINING COMMITMENT: the value of orders still to be
invoiced, reduced by the QS as costs land on Cost to Date. The EFC formula
is unchanged: EFC = Cost to Date + Committed (remaining) + Uncommitted.
Entering full order values on Committed alongside invoiced cost on Cost to
Date will double count and overstate the EFC, this is now stated on the
page itself.

- Committed page subtitle now reads: "Remaining commitment, reduce each
  line as costs are invoiced. EFC = Cost to Date + Committed + Uncommitted"

## Sub register: standing order value decoupled
Because committed lines decay under this convention, the subcontractor
register no longer derives order value from them live. Each account now
carries its own standing order value: snapshotted from committed lines at
import time, editable on the account settings row, audited on change.
Percentage certified and the over-certification check run against it.
- New order_value column on subcontractors, migrated automatically.

## Elements import: default cost codes
Importing elements now auto-creates a <PREFIX>-GEN cost code for any
element that has none, so Cost to Date and Committed entry work immediately
after a fresh import (fixes the empty cost-code register found in testing).

## Housekeeping
Version label to v43.
