# ExtraOver v40 - Costline design system

Full visual reskin to the Costline style guide. No functional changes.

- IBM Plex Sans body type, IBM Plex Mono for codes, refs, timestamps and
  section labels; tabular figures globally so money aligns to the cent
- Light statement aesthetic: white surfaces on #f6f7f9 ground, #e7e9ee
  borders, 12px card radius
- Single blue accent #1c4ed8 for action, selection and focus. Editable grid
  cells are now soft blue (#eef2ff), not yellow, blue means "you can act here"
- Colour is semantic only: green #0a8a54 = money-positive, red #c8412a =
  money-negative, amber #b6740a = caution
- Sidebar rebuilt: light rail, nav grouped under mono section labels
  (Reporting / Commercial / Cost ledger / Governance), active item gets a
  3px blue bar and soft blue fill
- Tables restyled to the statement pattern: #fbfbfc mono uppercase headers,
  hairline dividers, heavy-bordered bold total rows
- Dark summary strips retained as the guide's "ledger panel" (#1a1d23)
- Excel export = solid blue primary button, PDF export = secondary
  (white, blue-soft border), colour no longer decorates actions
- PDF report and status chips remapped to the same palette

Applied centrally via Tailwind tokens + globals.css, plus a semantic hex
sweep across 33 components, so future components inherit the system.
