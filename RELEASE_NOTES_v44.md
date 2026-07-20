# ExtraOver v44 - Reconciliation fixes from the Riverbank test run

Three joins fixed, all found when the dashboard was reconciled against the
test pack's expected results (the calculation engine itself reconciled to
the euro).

1. Adjusted contract sum is now driven by the variations register. Once a
   project has any variations, approved income sums live from the register;
   the settings field only applies to register-less projects. Approved
   Variations on the Financial Position table shows the same figure, one
   source of truth.

2. Trade Performance panel now classifies profit and overrun positions by
   budget vs EFC variance instead of certified-minus-EFC, so trades without
   per-trade certified values no longer all appear as full-EFC overruns.
   Trades with no EFC are excluded.

3. The over-certification health check now uses the standing order value on
   the subcontractor account (falling back to the committed-lines sum only
   when no order value is set), matching the register itself. Under the
   remaining-commitment convention the committed sum decays, which was
   producing false over-certification alerts.
