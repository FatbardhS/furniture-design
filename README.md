# Closet Studio — 3D Closet & Cabinet Configurator + Cost Estimator

A browser-based configurator for wardrobes and cabinets. Set the size, lay out the interior, choose doors, hardware and finishes, and get a live 3D preview, bill of materials, cut list and price quote, which you can export as a PDF.

**Stack:** React 19 · TypeScript · Vite · Three.js · Tailwind CSS v4 · jsPDF + autotable · Vitest

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # domain/math unit tests
npm run build      # typecheck + production build into dist/
```

## Features

| Area | What you get |
|---|---|
| **3D view** | Orbit / zoom / pan, animated hinged & sliding doors, drawers that slide out, hide-doors toggle, dimension annotations, soft shadows and environment reflections |
| **Finishes** | Oak, Walnut, Pine, Grey Ash (procedural tileable wood grain with bump), High-Gloss White MDF, Matte White, Matte Black, Anthracite Gray, Cashmere. Separate front / carcass finishes, each with a colour tint and a glossiness slider |
| **Structure** | W × H × D (mm or cm), board thickness, HDF back thickness, plinth height, 1–8 vertical columns |
| **Interior** | Per column: add / remove / position shelves, hanging rods and drawers (with front height); auto-placement into free space, even shelf spacing, copy a layout to all columns, mini elevation |
| **Doors & hardware** | Open, hinged (1–8) or sliding (2–4) doors; bar / knob / push-to-open; chrome / black / brass; standard or soft-close hinges; ball-bearing or soft-close undermount slides |
| **BOM** | m² per material (carcass, fronts, HDF), waste-adjusted area and sheet count, edge banding metres, hinges, slide pairs, handles, rods + mounts, shelf pins, sliding track & rollers |
| **Pricing** | Editable price per m² for every board, HDF, banding per metre, every hardware unit price, labor as % / per m² / fixed, installation fee, VAT, currency symbol |
| **Validation** | Overlapping or out-of-range items, sagging shelf spans, over-wide hinged doors, heavy sliding doors, insufficient slide depth |
| **Export** | A4 PDF: 3D snapshot, spec sheet, interior layout, priced quote, board & hardware BOM, full cut list, design notes |

Configuration and prices are saved in `localStorage`.

## Project structure

```
src/
├── domain/               Framework-free business logic (unit-tested)
│   ├── types.ts          Config, pricing, Part, Layout types
│   ├── catalog.ts        Material library, defaults, standard sizes
│   ├── layout.ts         Config → physical parts + fixtures + warnings  ← single source of truth
│   ├── interior.ts       Item intervals, free-space placement, shelf distribution
│   ├── bom.ts            Areas, edge banding, hardware counts, cut list
│   ├── pricing.ts        Material / hardware / labor / VAT totals
│   ├── units.ts          mm ↔ cm helpers
│   └── domain.test.ts
├── three/
│   ├── CabinetRenderer.ts  Scene, camera, OrbitControls, meshes, door/drawer animation, snapshot
│   └── textures.ts         Procedural seamless wood grain (colour + bump)
├── state/useConfigurator.ts  State, persistence, memoised layout → BOM → quote
├── components/           Tailwind UI: viewport, config panels, quote / BOM / cut list / prices
├── pdf/exportPdf.ts      Report generator (lazy-loaded)
└── App.tsx               Three-pane layout
```

### Design

`buildLayout(config)` turns the configuration into a list of **parts**. Each part has cut dimensions (length along the grain, width, thickness), banded edges, a material role, and a 3D box placement, plus an optional motion (hinge pivot, drawer travel, sliding offset). The renderer draws exactly these parts and the BOM is summed from the same list, so what you see in 3D is always what gets priced.

Coordinates are in millimetres: x = 0 at the cabinet centre, y = 0 on the floor, +z towards the front.

### Construction rules (all in `layout.ts` / `bom.ts`)

- Sides run full height; top, bottom, dividers and shelves sit between them. The back is HDF, surface-mounted, and split into strips if it won't fit on a 2800 × 2070 sheet.
- Overall depth includes the doors: the carcass depth is reduced by 20 mm for hinged doors and 2T + 16 mm for a two-track sliding system.
- Shelves are set back 20 mm. Inner drawers behind doors are set back 30 mm so their handles clear the doors.
- Drawer slide length is the largest standard size (250–650 mm) that fits. Box width = column width − 2 × side clearance (12.5 mm for ball-bearing slides, 5 mm for undermount). Box height = front height − 50 mm.
- **Hinges per door** = max(height rule, ⌈weight / 5 kg⌉, 2), where the height rule is ≤900 → 2, ≤1600 → 3, ≤2000 → 4, ≤2400 → 5, otherwise 6. Weight = door volume × material density.
- **Edge banding**: front edges of carcass parts, shelves and dividers; all four edges of doors and drawer fronts; top edges of drawer boxes; plus 30 mm trim allowance per banded edge.
- Hardware counts: 4 pins per shelf, 2 mounts per rod, 1 slide pair per drawer, 1 handle (or push latch) per door and drawer, 1 roller set per sliding door, track length = cabinet width.

## Extending

- **New material:** add an entry to `MATERIALS` in `catalog.ts`. Add a `STYLES` entry in `textures.ts` for custom grain.
- **New interior item** (e.g. pull-out shoe rack): extend `ItemType`, its interval in `interior.ts`, its parts in `layout.ts`, and its hardware in `bom.ts`.
- **Unequal column widths:** replace the equal `cw` in `buildLayout` with per-column widths stored on `Column`.
